import mongoose, { Schema, Document } from 'mongoose';

export interface INews extends Document {
  title: string;
  slug: string;
  content: string; // content contains html formatted string for rich text representation of the news article
  category: string;
  imageUrl?: string;
  publishAvatarUrl?: string;
  publishedBy?: string;
  readCount?: number;
  timeSpentReading?: number;
  deviceStats?: { [deviceType: string]: number };
  isDeleted?: boolean;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const newsSchema = new Schema<INews>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    content: { type: String, required: true },
    category: { type: String, required: true },
    imageUrl: { type: String, required: false },
    publishAvatarUrl: { type: String, required: false },
    publishedBy: { type: String, required: false },
    readCount: { type: Number, required: false, default: 0 },
    timeSpentReading: { type: Number, required: false, default: 0 },
    deviceStats: { type: Map, of: Number, required: false, default: {} },
    isDeleted: { type: Boolean, required: false, default: false },
    deletedAt: { type: Date, required: false },
  },
  { timestamps: true },
);

const News = mongoose.model<INews>('News', newsSchema);
export default News;
