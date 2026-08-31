import mongoose, { Schema, Document } from 'mongoose';

export interface IPrivacyAuditLog extends Document {
  /** The event whose attendee PII was redacted. */
  eventId: mongoose.Types.ObjectId;
  eventName: string;
  /** Number of ticket orders scanned for this event (not necessarily modified). */
  ordersScanned: number;
  /** Number of associated user documents whose PII was cleared. */
  usersRedacted: number;
  /** Fields that were replaced (e.g. ['email', 'phone', 'displayName']). */
  fieldsRedacted: string[];
  /** The method used: 'sha256' replaces with hash, 'placeholder' truncates. */
  method: 'sha256' | 'placeholder';
  /** Why the redaction was triggered. */
  trigger: 'retention_expired' | 'manual';
  /** ISO timestamp of when the redaction ran. */
  executedAt: Date;
  /** Summary for human/auditor review. */
  summary: string;
  createdAt: Date;
  updatedAt: Date;
}

const privacyAuditLogSchema = new Schema<IPrivacyAuditLog>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'EventTicket',
      required: true,
      index: true,
    },
    eventName: { type: String, required: true },
    ordersScanned: { type: Number, required: true, min: 0 },
    usersRedacted: { type: Number, required: true, min: 0 },
    fieldsRedacted: [{ type: String }],
    method: {
      type: String,
      required: true,
      enum: ['sha256', 'placeholder'],
    },
    trigger: {
      type: String,
      required: true,
      enum: ['retention_expired', 'manual'],
    },
    executedAt: { type: Date, required: true },
    summary: { type: String, required: true },
  },
  { timestamps: true },
);

// Index for compliance queries: find all audit entries for a given event,
// and lookups by execution date range.
privacyAuditLogSchema.index({ executedAt: -1 });
privacyAuditLogSchema.index({ eventId: 1, executedAt: -1 });

const PrivacyAuditLog = mongoose.model<IPrivacyAuditLog>(
  'PrivacyAuditLog',
  privacyAuditLogSchema,
);
export default PrivacyAuditLog;
