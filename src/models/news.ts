import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INews extends Document {
  _id: Types.ObjectId;
  title: string;
  content: string;
import mongoose, { Schema, Document } from 'mongoose';

export interface INews extends Document {
  title: string;
  content: string; // content contains html formatted string for rich text representation of the news article
  category: string;
  imageUrl?: string; // optional field for an image associated with the news
  publishAvatarUrl?: string; // optional field for an avatar or image associated with the news
  publishedBy?: string; // optional field to indicate the source or author of the news
  readCount?: number; // optional field to track how many times the news article has been read
  timeSpentReading?: number; // optional field to track the average time spent reading the news article in seconds
  deviceStats?: { [deviceType: string]: number }; // optional field to track the number of readers by device type (e.g., mobile: 10, desktop: 5, tablet: 2)
  createdAt?: Date;
  updatedAt?: Date;
}

const newsSchema = new Schema<INews>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: { type: String, required: true },
    imageUrl: { type: String, required: false },
    publishAvatarUrl: { type: String, required: false },
    publishedBy: { type: String, required: false },
    readCount: { type: Number, required: false, default: 0 },
    timeSpentReading: { type: Number, required: false, default: 0 },
    deviceStats: { type: Map, of: Number, required: false, default: {} },
  },
  { timestamps: true },
);

const News = mongoose.model<INews>('News', newsSchema);
const News = mongoose.model<INews>(
  'News',
  newsSchema,
);
export default News;
