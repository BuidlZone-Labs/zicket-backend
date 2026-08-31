import mongoose from 'mongoose';
import TicketOrder, { ITicketOrder } from '../models/ticket-order';
import EventTicket from '../models/event-ticket';
import User from '../models/user';
import zkEmailNotificationService from './zk-email-notification.service';
import WaitlistService from './waitlist.service';
import {
  encodePaginationCursor,
  PaginationCursor,
} from '../utils/pagination-cursor';
import logger from '../utils/logger';

export interface PaginatedTicketOrdersResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  nextCursor?: string | null;
  orders: ITicketOrder[];
}

export class TicketOrderService {
  /**
   * Fetches paginated ticket orders for a specific user
   */
  static async getUserOrders(
    userId: string,
    page: number = 1,
    limit: number = 10,
    cursor?: PaginationCursor,
  ): Promise<PaginatedTicketOrdersResponse> {
    try {
      const validPage = Math.max(1, page);
      const validLimit = Math.max(1, Math.min(limit, 50));
      const useCursor = Boolean(cursor);
      const baseFilter = { user: new (mongoose.Types.ObjectId as any)(userId) };
      const cursorFilter = cursor
        ? {
            $or: [
              { datePurchased: { $lt: cursor.sortValue } },
              {
                datePurchased: cursor.sortValue,
                _id: { $lt: new mongoose.Types.ObjectId(cursor.id) },
              },
            ],
          }
        : {};

      const filter = {
        ...baseFilter,
        ...cursorFilter,
      };

      let query = TicketOrder.find(filter).sort({
        datePurchased: -1,
        _id: -1,
      });

      if (useCursor) {
        query = query.limit(validLimit + 1);
      } else {
        const skip = (validPage - 1) * validLimit;
        query = query.skip(skip).limit(validLimit);
      }

      const [orders, total] = await Promise.all([
        query.lean(),
        TicketOrder.countDocuments(baseFilter),
      ]);

      const paginatedOrders = useCursor ? orders.slice(0, validLimit) : orders;
      const hasNextPage = useCursor && orders.length > validLimit;
      const nextCursor =
        hasNextPage && paginatedOrders.length > 0
          ? encodePaginationCursor(
              new Date(
                (paginatedOrders[paginatedOrders.length - 1] as any)
                  .datePurchased,
              ),
              String((paginatedOrders[paginatedOrders.length - 1] as any)._id),
            )
          : null;

      return {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
        nextCursor,
        orders: paginatedOrders as unknown as ITicketOrder[],
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch user ticket orders: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Fetches paginated ticket orders for an organizer's events
   */
  static async getOrganizerOrders(
    organizerId: string,
    page: number = 1,
    limit: number = 10,
    cursor?: PaginationCursor,
  ): Promise<PaginatedTicketOrdersResponse> {
    try {
      const validPage = Math.max(1, page);
      const validLimit = Math.max(1, Math.min(limit, 50));
      const useCursor = Boolean(cursor);

      // 1. Find all events organized by this user
      const events = await EventTicket.find({
        organizedBy: new (mongoose.Types.ObjectId as any)(organizerId),
      })
        .select('_id')
        .lean();

      if (!events || events.length === 0) {
        return {
          page: validPage,
          limit: validLimit,
          total: 0,
          totalPages: 0,
          nextCursor: null,
          orders: [],
        };
      }

      const eventIds = events.map((event) => event._id);

      // 2. Find all orders for those events
      const baseFilter = { eventTicket: { $in: eventIds } };
      const cursorFilter = cursor
        ? {
            $or: [
              { datePurchased: { $lt: cursor.sortValue } },
              {
                datePurchased: cursor.sortValue,
                _id: { $lt: new mongoose.Types.ObjectId(cursor.id) },
              },
            ],
          }
        : {};

      const filter = {
        ...baseFilter,
        ...cursorFilter,
      };

      let query = TicketOrder.find(filter).sort({
        datePurchased: -1,
        _id: -1,
      });

      if (useCursor) {
        query = query.limit(validLimit + 1);
      } else {
        const skip = (validPage - 1) * validLimit;
        query = query.skip(skip).limit(validLimit);
      }

      const [orders, total] = await Promise.all([
        query.lean(),
        TicketOrder.countDocuments(baseFilter),
      ]);

      const paginatedOrders = useCursor ? orders.slice(0, validLimit) : orders;
      const hasNextPage = useCursor && orders.length > validLimit;
      const nextCursor =
        hasNextPage && paginatedOrders.length > 0
          ? encodePaginationCursor(
              new Date(
                (paginatedOrders[paginatedOrders.length - 1] as any)
                  .datePurchased,
              ),
              String((paginatedOrders[paginatedOrders.length - 1] as any)._id),
            )
          : null;

      return {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
        nextCursor,
        orders: paginatedOrders as unknown as ITicketOrder[],
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch organizer ticket orders: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Creates a new ticket order entry (typically called after a successful payment)
   */
  static async createOrder(
    orderData: Partial<ITicketOrder>,
  ): Promise<ITicketOrder> {
    try {
      const order = await TicketOrder.create(orderData);
      return order;
    } catch (error) {
      throw new Error(
        `Failed to create ticket order entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Creates a new ticket order and sends purchase notification
   * Retrieves user to respect privacy preferences
   */
  static async createOrderWithNotification(
    orderData: Partial<ITicketOrder>,
  ): Promise<{ order: ITicketOrder; notificationJobId: string | null }> {
    try {
      const order = await TicketOrder.create(orderData);

      // Fetch user to check notification preferences and send notification
      if (order.user) {
        const user = await User.findById(order.user);
        if (user) {
          const notificationJobId =
            await zkEmailNotificationService.notifyTicketPurchase(user, order);
          return { order, notificationJobId };
        }
      }

      return { order, notificationJobId: null };
    } catch (error) {
      throw new Error(
        `Failed to create ticket order with notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Updates ticket order status and sends status update notification
   */
  static async updateOrderStatusWithNotification(
    orderId: string,
    newStatus: number,
  ): Promise<{ order: ITicketOrder | null; notificationJobId: string | null }> {
    const existingOrder = await TicketOrder.findById(orderId);
    const wasAlreadyTerminalCancel = existingOrder
      ? [2, 4].includes(existingOrder.status)
      : false;
    const isNowTerminalCancel = [2, 4].includes(newStatus);
    try {
      const order = await TicketOrder.findByIdAndUpdate(
        orderId,
        { status: newStatus },
        { new: true },
      );

      if (!order) {
        throw new Error(`Ticket order ${orderId} not found`);
      }
      // #168: On a first-time transition into cancelled/refunded, restore
      // the freed inventory and notify the next person(s) on the waitlist.
      if (isNowTerminalCancel && !wasAlreadyTerminalCancel) {
        try {
          const freedEvent = await EventTicket.findById(order.eventTicket);
          if (freedEvent && freedEvent.eventStatus !== 'cancelled') {
            freedEvent.availableTickets += order.quantity;
            freedEvent.soldTickets = Math.max(
              0,
              freedEvent.soldTickets - order.quantity,
            );
            await freedEvent.save();

            await WaitlistService.processNextForEvent(
              (freedEvent._id as mongoose.Types.ObjectId).toString(),
              order.quantity,
            );
          }
        } catch (waitlistError) {
          logger.error(
            'Failed to process waitlist after order cancellation/refund:',
            waitlistError,
          );
        }
      }

      // Fetch user and send notification
      if (order.user) {
        const user = await User.findById(order.user);
        if (user) {
          const notificationJobId =
            await zkEmailNotificationService.notifyTicketUpdate(user, order);
          return { order, notificationJobId };
        }
      }

      return { order, notificationJobId: null };
    } catch (error) {
      throw new Error(
        `Failed to update ticket order status with notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
