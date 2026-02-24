import mongoose, { Schema, Document } from 'mongoose';

export interface IMessageCenter extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  audience: string[];
  status: 'sent' | 'pending' | 'failed';
  sentAt?: Date;
  scheduledAt?: Date;
}

const messageCenterSchema = new Schema<IMessageCenter>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    audience: { type: [String], required: true },
    status: {
      type: String,
      required: true,
      enum: ['sent', 'pending', 'failed'],
    },
    sentAt: { type: Date, required: false },
    scheduledAt: { type: Date, required: false },
  },
  { timestamps: true },
);

const MessageCenter = mongoose.model<IMessageCenter>(
  'MessageCenter',
  messageCenterSchema,
);
export default MessageCenter;
