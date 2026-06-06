import mongoose, { Document, Schema } from 'mongoose';

export interface IContractEvent extends Document {
  contractAddress: string;
  eventName: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  topics: string[];
  data: string;
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
  }
);

// Compound index for idempotency
contractEventSchema.index({ transactionHash: 1, logIndex: 1 }, { unique: true });

export default mongoose.models.ContractEvent ||
  mongoose.model<IContractEvent>('ContractEvent', contractEventSchema);
