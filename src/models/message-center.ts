import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMessageCenter extends Document {
  _id: Types.ObjectId;
  title: string;
  content: string;
  audience: string[];
  status: 'sent' | 'pending' | 'failed';
  sentAt?: Date;
  scheduledAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const messageCenterSchema = new Schema<IMessageCenter>(
  {
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
