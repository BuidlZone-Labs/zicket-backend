import mongoose, { Schema, Document } from 'mongoose';

/**
 * Interface for TicketOrder Model
 * transparency between Users and Organizers regarding ticket purchases and payments
 */
export interface ITicketOrder extends Document {
  user: mongoose.Types.ObjectId;
  eventTicket: mongoose.Types.ObjectId;
  ticketType: string;
  eventName: string;
  status: number; // 0 for pending, 1 for completed, 3 for failed
  quantity: number;
  amount: number;
  zkIdMatch: boolean;
  privacyLevel: string;
  hasReceipt: boolean;
  datePurchased: Date;
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
      enum: [0, 1, 3],
      default: 0,
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    zkIdMatch: { type: Boolean, default: false },
    privacyLevel: { type: String, required: true },
    hasReceipt: { type: Boolean, default: false },
    datePurchased: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Indexes for faster lookups
ticketOrderSchema.index({ user: 1, datePurchased: -1 });
ticketOrderSchema.index({ eventTicket: 1, datePurchased: -1 });

const TicketOrder = mongoose.model<ITicketOrder>(
  'TicketOrder',
  ticketOrderSchema,
);
export default TicketOrder;
