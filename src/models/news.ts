import mongoose, { Schema, Document } from 'mongoose';

export interface INews extends Document {
  title: string;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const newsSchema = new Schema<INews>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
  },
  { timestamps: true },
);

const News = mongoose.model<INews>('News', newsSchema);
export default News;
