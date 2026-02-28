import mongoose from 'mongoose';
import TicketOrder, {
  ITicketOrder,
  TICKET_ORDER_STATUS,
  type TicketOrderStatusValue,
} from '../models/ticket-order';
import EventTicket from '../models/event-ticket';

export interface TicketOrderResponse {
  id: string;
  ticketType: string;
  eventName: string;
  status: number;
  quantity: number;
  amount: number;
  zkIdMatch: boolean;
  privacyLevel: string;
  hasReceipt: boolean;
  datePurchased: string;
  transactionId?: string;
}

export interface PaginatedOrdersResponse {
  page: number;
  limit: number;
  total: number;
  orders: TicketOrderResponse[];
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function toOrderResponse(doc: ITicketOrder): TicketOrderResponse {
  return {
    id: (doc._id as mongoose.Types.ObjectId).toString(),
    ticketType: doc.ticketType,
    eventName: doc.eventName,
    status: doc.status,
    quantity: doc.quantity,
    amount: doc.amount,
    zkIdMatch: doc.zkIdMatch,
    privacyLevel: doc.privacyLevel,
    hasReceipt: doc.hasReceipt,
    datePurchased: doc.datePurchased.toISOString(),
    ...(doc.transactionId && { transactionId: doc.transactionId }),
  };
}

/** Maps event privacy level number to display string */
export function privacyLevelToString(level: number): string {
  switch (level) {
    case 0:
      return 'anonymous';
    case 1:
      return 'wallet-required';
    case 2:
      return 'verified-access';
    default:
      return 'unknown';
  }
}

export interface CreateOrderInput {
  userId: string;
  eventTicketId: string;
  ticketType: string;
  quantity: number;
  amount: number;
  status?: TicketOrderStatusValue;
  zkIdMatch?: boolean;
  hasReceipt?: boolean;
  transactionId?: string;
}

export class TicketOrderService {
  /**
   * Create a ticket order (call from payment flow after purchase).
   * Fetches event name and privacy level from EventTicket.
   */
  static async createOrder(input: CreateOrderInput): Promise<ITicketOrder> {
    const event = await EventTicket.findById(input.eventTicketId).lean();
    if (!event) throw new Error('Event ticket not found');

    const order = await TicketOrder.create({
      user: new mongoose.Types.ObjectId(input.userId),
      eventTicket: new mongoose.Types.ObjectId(input.eventTicketId),
      ticketType: input.ticketType,
      eventName: event.name,
      status: input.status ?? TICKET_ORDER_STATUS.PENDING,
      quantity: input.quantity,
      amount: input.amount,
      zkIdMatch: input.zkIdMatch ?? false,
      privacyLevel: privacyLevelToString(event.privacyLevel),
      hasReceipt: input.hasReceipt ?? false,
      datePurchased: new Date(),
      transactionId: input.transactionId,
    });
    return order;
  }

  /**
   * Get ticket orders for a user (buyer) – "my orders"
   */
  static async getOrdersForUser(
    userId: string,
    page: number = 1,
    limit: number = DEFAULT_LIMIT,
  ): Promise<PaginatedOrdersResponse> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
    const skip = (validPage - 1) * validLimit;

    const [orders, total] = await Promise.all([
      TicketOrder.find({ user: new mongoose.Types.ObjectId(userId) })
        .sort({ datePurchased: -1 })
        .skip(skip)
        .limit(validLimit)
        .lean(),
      TicketOrder.countDocuments({ user: new mongoose.Types.ObjectId(userId) }),
    ]);

    return {
      page: validPage,
      limit: validLimit,
      total,
      orders: orders.map((o) => toOrderResponse(o as ITicketOrder)),
    };
  }

  /**
   * Get ticket orders for an organizer – orders for events they organize
   */
  static async getOrdersForOrganizer(
    organizerId: string,
    page: number = 1,
    limit: number = DEFAULT_LIMIT,
  ): Promise<PaginatedOrdersResponse> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
    const skip = (validPage - 1) * validLimit;

    const eventIds = await EventTicket.find({
      organizedBy: new mongoose.Types.ObjectId(organizerId),
    })
      .select('_id')
      .lean();
    const eventIdList = eventIds.map((e) => e._id);

    const [orders, total] = await Promise.all([
      TicketOrder.find({ eventTicket: { $in: eventIdList } })
        .sort({ datePurchased: -1 })
        .skip(skip)
        .limit(validLimit)
        .lean(),
      TicketOrder.countDocuments({ eventTicket: { $in: eventIdList } }),
    ]);

    return {
      page: validPage,
      limit: validLimit,
      total,
      orders: orders.map((o) => toOrderResponse(o as ITicketOrder)),
    };
  }
}
