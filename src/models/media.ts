import mongoose, { Schema, Document } from 'mongoose';

export interface IMedia extends Document {
  publicId: string;
  userId: mongoose.Types.ObjectId;
}

const mediaSchema = new Schema<IMedia>(
  {
    publicId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

const Media = mongoose.model<IMedia>('Media', mediaSchema);
export default Media;
