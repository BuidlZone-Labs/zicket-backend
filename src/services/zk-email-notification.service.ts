import queueService from './queue.service';
import { IUser } from '../models/user';
import { ITicketOrder } from '../models/ticket-order';
import { IEventTicket } from '../models/event-ticket';

/**
 * ZkEmailNotificationService - Privacy-preserving notification service
 * Manages ticket purchase and update notifications with user privacy settings
 */
class ZkEmailNotificationService {
  /**
   * Send ticket purchase notification
   * Respects user notification preferences and privacy level
   */
  async notifyTicketPurchase(
    user: IUser,
    order: ITicketOrder,
  ): Promise<string | null> {
    try {
      // Check user notification preference
      if (!user.notificationPreferences?.emailOnTicketPurchase) {
        console.log(
          `Skipping purchase notification for ${user.email} - notifications disabled`,
        );
        return null;
      }

      const jobId = await queueService.enqueueTicketPurchaseNotification({
        userEmail: user.email,
        userName: user.name,
        ticketType: order.ticketType,
        eventName: order.eventName,
        quantity: order.quantity,
        amount: order.amount,
        privacyLevel: order.privacyLevel,
        orderId: order._id.toString(),
      });

      console.log(
        `Ticket purchase notification queued for ${user.email}, Job ID: ${jobId}`,
      );
      return jobId;
    } catch (error: any) {
      console.error(
        'Error queuing ticket purchase notification:',
        error.message,
      );
      throw new Error('Failed to queue ticket purchase notification');
    }
  }

  /**
   * Send ticket update notification
   * Notifies user of ticket status changes while respecting preferences
   */
  async notifyTicketUpdate(
    user: IUser,
    order: ITicketOrder,
  ): Promise<string | null> {
    try {
      // Check user notification preference
      if (!user.notificationPreferences?.emailOnTicketUpdate) {
        console.log(
          `Skipping update notification for ${user.email} - notifications disabled`,
        );
        return null;
      }

      const jobId = await queueService.enqueueTicketUpdateNotification({
        userEmail: user.email,
        userName: user.name,
        eventName: order.eventName,
        status: order.status,
        orderId: order._id.toString(),
        privacyLevel: order.privacyLevel,
      });

      console.log(
        `Ticket update notification queued for ${user.email}, Job ID: ${jobId}`,
      );
      return jobId;
    } catch (error: any) {
      console.error('Error queuing ticket update notification:', error.message);
      throw new Error('Failed to queue ticket update notification');
    }
  }

  /**
   * Send event cancellation notification
   * Notifies participants that an event has been cancelled and refunds are being processed
   */
  async notifyEventCancellation(
    user: IUser,
    event: IEventTicket,
    reason?: string,
  ): Promise<string | null> {
    try {
      // Cancellation notifications are critical, so we might bypass preference 
      // check if the event is cancelled, but let's stick to update preference for now
      if (!user.notificationPreferences?.emailOnTicketUpdate) {
        console.log(
          `Skipping cancellation notification for ${user.email} - notifications disabled`,
        );
        return null;
      }

      const jobId = await queueService.enqueueEventCancellationNotification({
        userEmail: user.email,
        userName: user.name,
        eventName: event.name,
        reason,
      });

      console.log(
        `Event cancellation notification queued for ${user.email}, Job ID: ${jobId}`,
      );
      return jobId;
    } catch (error: any) {
      console.error('Error queuing event cancellation notification:', error.message);
      throw new Error('Failed to queue event cancellation notification');
    }
  }
}

export default new ZkEmailNotificationService();
