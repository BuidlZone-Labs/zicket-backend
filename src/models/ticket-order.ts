import mongoose, { Schema, Document } from 'mongoose';

/** Order/payment status: 0 = pending, 1 = completed, 3 = failed */
export const TICKET_ORDER_STATUS = {
  PENDING: 0,
  COMPLETED: 1,
  FAILED: 3,
} as const;

export type TicketOrderStatusValue =
  (typeof TICKET_ORDER_STATUS)[keyof typeof TICKET_ORDER_STATUS];

export interface ITicketOrder extends Document {
  /** Buyer (User) */
  user: mongoose.Types.ObjectId;
  /** Event (EventTicket) this order belongs to */
  eventTicket: mongoose.Types.ObjectId;
  /** Ticket type name, e.g. "free", "paid", "vip" */
  ticketType: string;
  /** Event name (denormalized for display) */
  eventName: string;
  /** 0 = pending, 1 = completed, 3 = failed */
  status: TicketOrderStatusValue;
  /** Number of tickets in this order */
  quantity: number;
  /** Total amount (decimal) */
  amount: number;
  /** Whether ZK identity was matched for this order */
  zkIdMatch: boolean;
  /** Privacy level label, e.g. "anonymous", "wallet-required", "verified-access" */
  privacyLevel: string;
  /** Whether a receipt was generated */
  hasReceipt: boolean;
  /** When the order was placed/paid */
  datePurchased: Date;
  /** Optional external payment/transaction id from gateway */
  transactionId?: string;
}

const ticketOrderSchema = new Schema<ITicketOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    eventTicket: {
      type: Schema.Types.ObjectId,
      ref: 'EventTicket',
      required: true,
    },
    ticketType: { type: String, required: true },
    eventName: { type: String, required: true },
    status: {
      type: Number,
      required: true,
      enum: [0, 1, 3],
      default: TICKET_ORDER_STATUS.PENDING,
    },
    quantity: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    zkIdMatch: { type: Boolean, required: true, default: false },
    privacyLevel: { type: String, required: true },
    hasReceipt: { type: Boolean, required: true, default: false },
    datePurchased: { type: Date, required: true, default: Date.now },
    transactionId: { type: String, required: false },
  },
  { timestamps: true },
);

// Indexes for common queries: user orders, organizer orders (via eventTicket)
ticketOrderSchema.index({ user: 1, datePurchased: -1 });
ticketOrderSchema.index({ eventTicket: 1, datePurchased: -1 });

const TicketOrder = mongoose.model<ITicketOrder>(
  'TicketOrder',
  ticketOrderSchema,
);
export default TicketOrder;
