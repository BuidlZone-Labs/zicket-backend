/**
 * Email Job Types and Payload Interfaces
 */

export enum EmailJobType {
  SEND_VERIFICATION_OTP = 'SEND_VERIFICATION_OTP',
  SEND_MAGIC_LINK = 'SEND_MAGIC_LINK',
  SEND_EMAIL = 'SEND_EMAIL',
  SEND_TICKET_PURCHASE_NOTIFICATION = 'SEND_TICKET_PURCHASE_NOTIFICATION',
  SEND_TICKET_UPDATE_NOTIFICATION = 'SEND_TICKET_UPDATE_NOTIFICATION',
  SEND_EVENT_CANCELLATION_NOTIFICATION = 'SEND_EVENT_CANCELLATION_NOTIFICATION',
}

export interface SendVerificationOtpPayload {
  email: string;
  otp: number;
}

export interface SendMagicLinkPayload {
  email: string;
  token: string;
}

export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendTicketPurchaseNotificationPayload {
  userEmail: string;
  userName: string;
  ticketType: string;
  eventName: string;
  quantity: number;
  amount: number;
  privacyLevel: string;
  orderId: string;
}

export interface SendTicketUpdateNotificationPayload {
  userEmail: string;
  userName: string;
  eventName: string;
  status: number; // 0: pending, 1: completed, 3: failed
  orderId: string;
  privacyLevel: string;
}

export interface SendEventCancellationNotificationPayload {
  userEmail: string;
  userName: string;
  eventName: string;
  reason?: string;
}

/**
 * Union type for all email job payloads
 */
export type EmailJobPayload =
  | SendVerificationOtpPayload
  | SendMagicLinkPayload
  | SendEmailPayload
  | SendTicketPurchaseNotificationPayload
  | SendTicketUpdateNotificationPayload
  | SendEventCancellationNotificationPayload;

/**
 * Email job result
 */
export interface EmailJobResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
}

// ─── #81 + #78: Payment & Reconciliation Jobs ────────────────────────────────

/**
 * #81 — Payment queue job types
 */
export enum PaymentJobType {
  PROCESS_WEBHOOK_EVENT = 'PROCESS_WEBHOOK_EVENT',
}

/**
 * Payload for PROCESS_WEBHOOK_EVENT.
 * Mirrors WebhookPaymentEvent from webhook.service.ts — keep in sync.
 */
export interface ProcessWebhookEventPayload {
  txHash: string;
  from: string;
  to: string;
  valueWei: string;
  blockNumber: number;
  confirmations: number;
  status: 'confirmed' | 'failed';
  timestamp: number;
}

export type PaymentJobPayload = ProcessWebhookEventPayload;

/**
 * zkEmail Job Types and Payload Interfaces
 */

export enum ZkEmailJobType {
  ZK_EMAIL_HOOK = 'ZK_EMAIL_HOOK',
}

export interface ZkEmailHookPayload {
  hashedEmail: string;
}

export type ZkEmailJobPayload = ZkEmailHookPayload;

export interface ZkEmailJobResult {
  success: boolean;
  jobId?: string;
  error?: string;
  timestamp: Date;
}

/**
 * Queue names
 */
// Queue names are defined in the consolidated QUEUE_NAMES object below.
// (Removed duplicate partial QUEUE_NAMES definition.)

/**
 * #78 — Reconciliation queue job types
 */
export enum ReconciliationJobType {
  RECONCILE_PENDING = 'RECONCILE_PENDING',
}

export interface ReconcilePayload {
  triggeredBy: 'schedule' | 'manual';
  timestamp: number;
}

export type ReconciliationJobPayload = ReconcilePayload;

/**
 * Queue names — centralised so nothing is hard-coded elsewhere
 */
export const QUEUE_NAMES = {
  EMAIL: 'email-queue',
  PAYMENT: 'payment-queue', // #81
  RECONCILIATION: 'reconciliation-queue', // #78
  ANALYTICS: 'analytics-queue',
  ZKEMAIL: 'zkemail-queue',
} as const;

/**
 * Repeatable job keys — used to register / cancel scheduled jobs
 */
export const REPEATABLE_JOBS = {
  RECONCILE_PENDING: {
    name: ReconciliationJobType.RECONCILE_PENDING,
    opts: {
      repeat: {
        // Run every 15 minutes.  Adjust via RECONCILIATION_CRON in .env.
        pattern: process.env.RECONCILIATION_CRON || '*/15 * * * *',
      },
      attempts: 2,
      backoff: { type: 'fixed' as const, delay: 30_000 },
    },
  },
} as const;
