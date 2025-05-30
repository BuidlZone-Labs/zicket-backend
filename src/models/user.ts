import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    name: string;
    email: string;
    password?: string;
    googleId?: string;
    provider: 'local' | 'google';
    otp?: number;
    otpExpires?: number;
    emailVerifiedAt?: Date;
}

const userSchema = new Schema<IUser>({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    password: { type: String, required: false },
    googleId: { type: String, required: false },
    provider: { type: String, required: true, enum: ['local', 'google'], default: 'local' },
    otp: { type: Number, required: false },
    otpExpires: { type: Number, required: false },
    emailVerifiedAt: { type: Date, required: false },
}, { timestamps: true });

const User = mongoose.model<IUser>('User', userSchema);
export default User;