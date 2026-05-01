import mongoose, { Schema, Document } from 'mongoose';

export interface IAnonymizationJob extends Document {
  targetUserId: mongoose.Types.ObjectId;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const anonymizationJobSchema = new Schema<IAnonymizationJob>(
  {
    targetUserId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true },
);

// TTL index: automatically expire anonymization records after 90 days
anonymizationJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const AnonymizationJob = mongoose.model<IAnonymizationJob>(
  'AnonymizationJob',
  anonymizationJobSchema,
);
export default AnonymizationJob;
