import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  user: mongoose.Types.ObjectId; // reference to User model
  eventTicket: mongoose.Types.ObjectId; // reference to EventTicket model
  amount: number; // transaction amount
  transactionDate: Date; // date of the transaction
  /**
   * Canonical state managed by TransactionStateMachine.
   * Valid transitions: pending → confirmed | failed
   * Terminal states (confirmed, failed) cannot be overwritten.
   */
  status: 'pending' | 'confirmed' | 'failed' | 'cancelled' | 'refunded';
  transactionId: string; // blockchain tx hash — unique identifier
  idempotencyKey?: string; // unique idempotency key for safe retries
  // ── Blockchain-specific fields ──────────────────────────────────────────────
  blockNumber?: number; // block in which the tx was mined
  confirmations?: number; // confirmation count at last check
  lastCheckedAt?: Date; // timestamp of last on-chain status check
}

const transactionSchema = new Schema<ITransaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    eventTicket: {
      type: Schema.Types.ObjectId,
      ref: 'EventTicket',
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    transactionDate: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'confirmed', 'failed', 'cancelled', 'refunded'],
      default: 'pending',
    },
    transactionId: { type: String, required: true, unique: true },
    idempotencyKey: { type: String, sparse: true, unique: true },
    // Blockchain metadata — populated by the state machine on each transition
    blockNumber: { type: Number, default: null },
    confirmations: { type: Number, default: 0 },
    lastCheckedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Compound index for duplicate detection: (user + eventTicket + transactionId)
transactionSchema.index({ user: 1, eventTicket: 1, transactionId: 1 }, { unique: true });
// Index for reconciliation queries (find stale pending transactions quickly)
transactionSchema.index({ status: 1, transactionDate: 1 });

const Transaction = mongoose.model<ITransaction>(
  'Transaction',
  transactionSchema,
);
export default Transaction;
