/**
 * Email Job Types and Payload Interfaces
 */

export enum EmailJobType {
  SEND_VERIFICATION_OTP = 'SEND_VERIFICATION_OTP',
  SEND_MAGIC_LINK = 'SEND_MAGIC_LINK',
  SEND_EMAIL = 'SEND_EMAIL',
  SEND_TICKET_PURCHASE_NOTIFICATION = 'SEND_TICKET_PURCHASE_NOTIFICATION',
  SEND_TICKET_UPDATE_NOTIFICATION = 'SEND_TICKET_UPDATE_NOTIFICATION',
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

/**
 * Union type for all email job payloads
 */
export type EmailJobPayload =
  | SendVerificationOtpPayload
  | SendMagicLinkPayload
  | SendEmailPayload
  | SendTicketPurchaseNotificationPayload
  | SendTicketUpdateNotificationPayload;

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
 * Queue names
 */
export const QUEUE_NAMES = {
  EMAIL: 'email-queue',
  RECONCILIATION: 'reconciliation-queue',
  ANALYTICS: 'analytics-queue',
} as const;
