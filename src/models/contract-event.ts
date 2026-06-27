import mongoose, { Document, Schema } from 'mongoose';

export interface IContractEvent extends Document {
  contractAddress: string;
  eventName: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  topics: string[];
  data: string;
  /**
   * Parsed event arguments. For privacy-stripped events (e.g.
   * `AnonEventRegistration`), `args` MUST NOT contain attendee
   * identifiers — no `payer`, no `user`, no `attendeeId`, no
   * commitment hash that can be reverse-correlated to a user.
   *
   * Schema-level guarantee: this model intentionally carries NO
   * `user`, `userId`, `attendeeId`, or `session` field. Any future
   * contributor adding such a field is undoing contract-layer privacy
   * guarantees and should NOT merge.
   */
  args?: Record<string, any>;
  timestamp: Date;
  createdAt: Date;
}

const contractEventSchema = new Schema<IContractEvent>(
  {
    contractAddress: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
    },
    eventName: {
      type: String,
      required: true,
      index: true,
    },
    blockNumber: {
      type: Number,
      required: true,
      index: true,
    },
    transactionHash: {
      type: String,
      required: true,
      index: true,
    },
    logIndex: {
      type: Number,
      required: true,
    },
    topics: {
      type: [String],
      required: true,
    },
    data: {
      type: String,
      required: true,
    },
    args: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for idempotency
contractEventSchema.index(
  { transactionHash: 1, logIndex: 1 },
  { unique: true },
);

export default mongoose.models.ContractEvent ||
  mongoose.model<IContractEvent>('ContractEvent', contractEventSchema);
