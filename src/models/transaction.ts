import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
    user: mongoose.Types.ObjectId; // reference to User model
    eventTicket: mongoose.Types.ObjectId; // reference to EventTicket model
    amount: number; // transaction amount
    transactionDate: Date; // date of the transaction
    status: string; // e.g., pending, completed, failed
    transactionId: string; // unique identifier from service gateway
}

const transactionSchema = new Schema<ITransaction>({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    eventTicket: { type: Schema.Types.ObjectId, ref: 'EventTicket', required: true },
    amount: { type: Number, required: true, min: 0 },
    transactionDate: { type: Date, required: true, default: Date.now },
    status: { type: String, required: true, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    transactionId: { type: String, required: true, unique: true },
}, { timestamps: true });

const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
export default Transaction;
