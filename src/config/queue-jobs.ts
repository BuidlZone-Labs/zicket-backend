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
  ANALYTICS: 'analytics-queue',
} as const;
