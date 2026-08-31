import mongoose from 'mongoose';
import Waitlist, { IWaitlist } from '../models/waitlist';
import EventTicket from '../models/event-ticket';
import User from '../models/user';
import queueService from './queue.service';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../errors/AppError';
import logger from '../utils/logger';

const HOLD_MINUTES_ENV = process.env.WAITLIST_HOLD_MINUTES;
const HOLD_MINUTES =
  HOLD_MINUTES_ENV !== undefined && !Number.isNaN(Number(HOLD_MINUTES_ENV))
    ? Number(HOLD_MINUTES_ENV)
    : 15;

export interface WaitlistStatusResponse {
  status: WaitlistStatusValue;
  position: number | null;
  holdExpiresAt: Date | null;
}

export type WaitlistStatusValue =
  | 'not_waitlisted'
  | 'waiting'
  | 'notified'
  | 'converted'
  | 'expired'
  | 'cancelled';

/**
 * #168 - Event Waitlist Service
 *
 * Lets users join a waitlist for sold-out events, and automatically fills
 * cancelled/refunded spots by notifying the next person in line with a
 * time-limited hold before moving on.
 */
export class WaitlistService {
  /**
   * Join the waitlist for a sold-out event.
   */
  static async join(userId: string, eventId: string): Promise<IWaitlist> {
    const event = await EventTicket.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }
    if (
      event.eventStatus === 'cancelled' ||
      event.eventStatus === 'completed'
    ) {
      throw new ValidationError(
        'Cannot join the waitlist for a cancelled or completed event',
      );
    }
    if (event.availableTickets > 0) {
      throw new ValidationError(
        'Tickets are still available for this event; the waitlist is only for sold-out events',
      );
    }

    const existing = await Waitlist.findOne({
      user: userId,
      eventTicket: eventId,
      status: { $in: ['waiting', 'notified'] },
    });
    if (existing) {
      throw new ConflictError('You are already on the waitlist for this event');
    }

    try {
      return await Waitlist.create({
        user: userId,
        eventTicket: eventId,
        status: 'waiting',
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictError(
          'You are already on the waitlist for this event',
        );
      }
      throw error;
    }
  }

  /**
   * Leave the waitlist while waiting, or give up a held (notified) spot.
   */
  static async leave(userId: string, eventId: string): Promise<void> {
    const entry = await Waitlist.findOne({
      user: userId,
      eventTicket: eventId,
      status: { $in: ['waiting', 'notified'] },
    });
    if (!entry) {
      throw new NotFoundError('No active waitlist entry found for this event');
    }

    const wasNotified = entry.status === 'notified';
    entry.status = 'cancelled';
    await entry.save();

    // Giving up a held spot immediately frees it for the next person,
    // rather than making them wait out the rest of the expired hold.
    if (wasNotified) {
      await WaitlistService.processNextForEvent(eventId, 1);
    }
  }

  /**
   * Current waitlist status + 1-based position (among waiting entries only)
   * for a user on a given event.
   */
  static async getStatus(
    userId: string,
    eventId: string,
  ): Promise<WaitlistStatusResponse> {
    const entry = await Waitlist.findOne({
      user: userId,
      eventTicket: eventId,
      status: { $in: ['waiting', 'notified'] },
    });

    if (!entry) {
      return { status: 'not_waitlisted', position: null, holdExpiresAt: null };
    }

    let position: number | null = null;
    if (entry.status === 'waiting') {
      position =
        (await Waitlist.countDocuments({
          eventTicket: eventId,
          status: 'waiting',
          createdAt: { $lt: entry.createdAt },
        })) + 1;
    }

    return {
      status: entry.status as WaitlistStatusValue,
      position,
      holdExpiresAt: entry.holdExpiresAt ?? null,
    };
  }

  /**
   * Notify the next `count` waiting users that a spot has freed up, and
   * give each a time-limited hold before moving on to the next person.
   */
  static async processNextForEvent(
    eventId: string,
    count: number = 1,
  ): Promise<void> {
    if (count <= 0) return;

    const event = await EventTicket.findById(eventId);
    if (!event || event.eventStatus === 'cancelled') {
      return;
    }

    const candidates = await Waitlist.find({
      eventTicket: eventId,
      status: 'waiting',
    })
      .sort({ createdAt: 1 })
      .limit(count);

    for (const entry of candidates) {
      const user = await User.findById(entry.user);
      if (!user?.email) {
        // No usable contact - skip rather than leave a dead hold nobody
        // can ever convert.
        entry.status = 'expired';
        await entry.save();
        continue;
      }

      const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000);
      entry.status = 'notified';
      entry.notifiedAt = new Date();
      entry.holdExpiresAt = holdExpiresAt;
      await entry.save();

      await queueService.enqueueWaitlistSpotAvailable({
        userEmail: user.email,
        userName: user.name,
        eventName: event.name,
        eventId: (event._id as mongoose.Types.ObjectId).toString(),
        holdMinutes: HOLD_MINUTES,
      });

      await queueService.enqueueExpireWaitlistHold(
        (entry._id as mongoose.Types.ObjectId).toString(),
        HOLD_MINUTES * 60_000,
      );
    }
  }

  /**
   * Called by the delayed EXPIRE_HOLD job. If the user never converted
   * their held spot into a purchase within the hold window, expire it and
   * move on to the next person in line.
   */
  static async expireHold(waitlistId: string): Promise<void> {
    const entry = await Waitlist.findById(waitlistId);
    if (!entry || entry.status !== 'notified') {
      // Already converted, cancelled, or expired elsewhere - nothing to do.
      return;
    }

    entry.status = 'expired';
    await entry.save();

    await WaitlistService.processNextForEvent(entry.eventTicket.toString(), 1);
  }

  /**
   * Mark all active waitlist entries for an event as cancelled. Called when
   * the whole event is cancelled - there is nothing left to notify anyone
   * about, since no new tickets will ever go on sale for it.
   */
  static async cancelForEvent(eventId: string): Promise<void> {
    await Waitlist.updateMany(
      { eventTicket: eventId, status: { $in: ['waiting', 'notified'] } },
      { $set: { status: 'cancelled' } },
    );
  }

  /**
   * Mark a user's held/waiting entry as converted after they successfully
   * purchase a ticket. Best-effort - a purchase must never fail because of
   * a bookkeeping error here.
   */
  static async markConverted(userId: string, eventId: string): Promise<void> {
    try {
      await Waitlist.updateOne(
        {
          user: userId,
          eventTicket: eventId,
          status: { $in: ['waiting', 'notified'] },
        },
        { $set: { status: 'converted' } },
      );
    } catch (error) {
      logger.error(
        `Failed to mark waitlist entry converted for user ${userId}, event ${eventId}:`,
        error,
      );
    }
  }
}

export default WaitlistService;
