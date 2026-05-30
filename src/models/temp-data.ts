import mongoose, { Schema, Document } from 'mongoose';

export interface ITempData extends Document {
  key: string;
  value: any;
  createdAt: Date;
  updatedAt: Date;
}

const tempDataSchema = new Schema<ITempData>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

// TTL index: automatically expire temporary data after 7 days
tempDataSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 },
);

const TempData = mongoose.model<ITempData>('TempData', tempDataSchema);
export default TempData;
