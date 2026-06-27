import { RequestHandler } from 'express';
import mongoose from 'mongoose';
import EventTicket from '../models/event-ticket';
import { OrganizerBalanceService } from '../services/organizer-balance.service';
import { UserAuthenticatedReq } from '../utils/types';
import { AppError } from '../errors/AppError';

/**
 * GET /event-tickets/:eventId/organizer-balance
 * Returns proportional withdrawable/refund amounts sourced from contract storage.
 */
export const getOrganizerBalance: RequestHandler = async (
  req: UserAuthenticatedReq,
  res,
) => {
  try {
    const userId = req.user?._id || (req.user as { id?: string })?.id;
    const { eventId: rawEventId } = req.params;
    const eventId = Array.isArray(rawEventId) ? rawEventId[0] : rawEventId;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    }

    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid event ID',
      });
    }

    const event = await EventTicket.findById(eventId).lean();

    if (!event) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Event not found',
      });
    }

    if (event.organizedBy.toString() !== userId.toString()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the event organizer can view this balance',
      });
    }

    if (!event.onChainEventId) {
      return res.status(400).json({
        error: 'Not configured',
        message: 'Event has no on-chain identifier linked',
      });
    }

    if (event.eventStatus !== 'cancelled') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Proportional balance is only available for cancelled events',
      });
    }

    const balance = await OrganizerBalanceService.getOrganizerBalanceForEvent(
      event.onChainEventId,
      event.eventStatus,
    );

    return res.status(200).json({
      success: true,
      data: balance,
    });
  } catch (error) {
    console.error('Error fetching organizer balance:', error);

    if (error instanceof AppError && error.isOperational) {
      return res.status(error.statusCode).json({
        error: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch organizer balance',
    });
  }
};
