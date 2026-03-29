/**
 * Email Job Types and Payload Interfaces
 */

export enum EmailJobType {
  SEND_VERIFICATION_OTP = 'SEND_VERIFICATION_OTP',
  SEND_MAGIC_LINK = 'SEND_MAGIC_LINK',
  SEND_EMAIL = 'SEND_EMAIL',
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

/**
 * Union type for all email job payloads
 */
export type EmailJobPayload =
  | SendVerificationOtpPayload
  | SendMagicLinkPayload
  | SendEmailPayload;

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
export const QUEUE_NAMES = {
  EMAIL: 'email-queue',
  ZKEMAIL: 'zkemail-queue',
  RECONCILIATION: 'reconciliation-queue',
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
