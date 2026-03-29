import mongoose from 'mongoose';
import TicketOrder, { ITicketOrder } from '../models/ticket-order';
import EventTicket from '../models/event-ticket';
import User from '../models/user';
import zkEmailNotificationService from './zk-email-notification.service';

export interface PaginatedTicketOrdersResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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
  ): Promise<PaginatedTicketOrdersResponse> {
    try {
      const validPage = Math.max(1, page);
      const validLimit = Math.max(1, Math.min(limit, 50));
      const skip = (validPage - 1) * validLimit;

      const filter = { user: new mongoose.Types.ObjectId(userId) };

      const [orders, total] = await Promise.all([
        TicketOrder.find(filter)
          .sort({ datePurchased: -1 })
          .skip(skip)
          .limit(validLimit)
          .lean(),
        TicketOrder.countDocuments(filter),
      ]);

      return {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
        orders: orders as unknown as ITicketOrder[],
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
  ): Promise<PaginatedTicketOrdersResponse> {
    try {
      const validPage = Math.max(1, page);
      const validLimit = Math.max(1, Math.min(limit, 50));
      const skip = (validPage - 1) * validLimit;

      // 1. Find all events organized by this user
      const events = await EventTicket.find({
        organizedBy: new mongoose.Types.ObjectId(organizerId),
      })
        .select('_id')
        .lean();

      if (!events || events.length === 0) {
        return {
          page: validPage,
          limit: validLimit,
          total: 0,
          totalPages: 0,
          orders: [],
        };
      }

      const eventIds = events.map((event) => event._id);

      // 2. Find all orders for those events
      const filter = { eventTicket: { $in: eventIds } };

      const [orders, total] = await Promise.all([
        TicketOrder.find(filter)
          .sort({ datePurchased: -1 })
          .skip(skip)
          .limit(validLimit)
          .lean(),
        TicketOrder.countDocuments(filter),
      ]);

      return {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
        orders: orders as unknown as ITicketOrder[],
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
    try {
      const order = await TicketOrder.findByIdAndUpdate(
        orderId,
        { status: newStatus },
        { new: true },
      );

      if (!order) {
        throw new Error(`Ticket order ${orderId} not found`);
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
