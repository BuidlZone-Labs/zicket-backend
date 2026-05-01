import mongoose, { Schema, Document } from 'mongoose';

export interface ILog extends Document {
  level: string;
  message: string;
  meta?: any;
  createdAt: Date;
  updatedAt: Date;
}

const logSchema = new Schema<ILog>(
  {
    level: { type: String, required: true },
    message: { type: String, required: true },
    meta: { type: Schema.Types.Mixed, required: false },
  },
  { timestamps: true },
);

// TTL index: automatically expire logs after 30 days
logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const Log = mongoose.model<ILog>('Log', logSchema);
export default Log;
