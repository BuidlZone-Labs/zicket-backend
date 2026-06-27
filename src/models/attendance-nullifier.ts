import mongoose, { Schema, Document } from 'mongoose';

export interface IAttendanceNullifier extends Document {
  eventId: mongoose.Types.ObjectId;
  nullifier: string;
  onChainTxHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceNullifierSchema = new Schema<IAttendanceNullifier>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'EventTicket',
      index: true,
    },
    nullifier: { type: String, required: true, index: true },
    onChainTxHash: { type: String },
  },
  { timestamps: true },
);

// Same nullifier may attend different events; per-event reuse is rejected.
attendanceNullifierSchema.index({ eventId: 1, nullifier: 1 }, { unique: true });

const AttendanceNullifier = mongoose.model<IAttendanceNullifier>(
  'AttendanceNullifier',
  attendanceNullifierSchema,
);

export default AttendanceNullifier;
