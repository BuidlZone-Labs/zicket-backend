import crypto from 'crypto';
import mongoose from 'mongoose';
import EventTicket from '../models/event-ticket';
import TicketOrder from '../models/ticket-order';
import User from '../models/user';
import PrivacyAuditLog from '../models/privacy-audit';

/**
 * #179 — Post-Event Anonymization Service
 *
 * For completed events past the retention period, automatically redact
 * sensitive attendee PII (email, display name) from User documents and
 * preserve non-identifying transaction metadata for accounting.
 *
 * Active, ongoing, or disputed (cancelled but < retention) events are
 * never touched.
 */

/** Default number of days after event completion before PII is redacted. */
export const DEFAULT_RETENTION_DAYS = 30;

const ANONYMIZED_EMAIL_DOMAIN = 'anonymized.zicket.local';

/** Fields we consider sensitive PII on the User model. */
const PII_FIELDS = ['email', 'name'] as const;

export interface AnonymizeReport {
  eventsScanned: number;
  eventsEligible: number;
  eventsSkippedActive: number;
  ordersScanned: number;
  usersRedacted: number;
  usersSkippedActive: number;
  auditLogsCreated: number;
  durationMs: number;
}

/**
 * SHA-256 hash of a value for deterministic redaction.
 * The original value is unrecoverable from the hash alone.
 */
export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Truncated placeholder: first 4 chars of hash + fixed suffix.
 * Useful for display-level redaction where a recognizable pattern is needed.
 */
export function truncatedPlaceholder(value: string): string {
  const hash = sha256(value);
  return `${hash.slice(0, 8)}...[redacted]`;
}

/**
 * Determines if an event is eligible for post-event anonymization.
 * - Must be in 'completed' status.
 * - Must have eventDate + retentionDays in the past.
 * - Cancelled events within the retention window are skipped.
 */
export function isEligibleForAnonymization(
  eventDate: Date,
  retentionDays: number,
  eventStatus: string,
): boolean {
  if (eventStatus !== 'completed') {
    return false;
  }
  const cutoff = new Date(eventDate.getTime() + retentionDays * 86_400_000);
  return Date.now() >= cutoff.getTime();
}

/**
 * Core anonymization logic for a single event past retention.
 * Replaces PII on User docs with SHA-256 hashes.
 * Returns the number of orders and users touched.
 */
async function anonymizeEventAttendees(
  eventId: mongoose.Types.ObjectId,
  eventName: string,
  method: 'sha256' | 'placeholder',
  trigger: 'retention_expired' | 'manual',
): Promise<{
  ordersScanned: number;
  usersRedacted: number;
  usersSkippedActive: number;
}> {
  // 1. Find completed ticket orders for this event (status 1 = completed)
  const orders = await TicketOrder.find({
    eventTicket: eventId,
    status: 1,
  }).lean();

  if (orders.length === 0) {
    return { ordersScanned: 0, usersRedacted: 0, usersSkippedActive: 0 };
  }

  // 2. Collect unique user IDs from these orders
  const userIds = [...new Set(orders.map((o) => o.user.toString()))];

  // 3. Filter out users who already have been anonymized or are currently
  //    associated with active (upcoming/ongoing) events.
  const activeUserIds = await findUsersWithActiveEvents(userIds);
  const eligibleUserIds = userIds.filter((id) => !activeUserIds.has(id));

  if (eligibleUserIds.length === 0) {
    return {
      ordersScanned: orders.length,
      usersRedacted: 0,
      usersSkippedActive: activeUserIds.size,
    };
  }

  // 4. Anonymize each eligible user's PII
  let usersRedacted = 0;

  for (const userId of eligibleUserIds) {
    const user = await User.findById(userId);
    if (!user || user.anonymizedAt) {
      continue;
    }

    // Save original values for the hash (deterministic audit trail)
    const originalEmail = user.email;
    const originalName = user.name;

    if (method === 'sha256') {
      user.email = `redacted+${sha256(originalEmail)}@${ANONYMIZED_EMAIL_DOMAIN}`;
      user.name = truncatedPlaceholder(originalName);
    } else {
      user.email = `redacted+${truncatedPlaceholder(originalEmail)}@${ANONYMIZED_EMAIL_DOMAIN}`;
      user.name = '[redacted]';
    }

    // Clear authentication-related fields
    user.password = undefined;
    user.googleId = undefined;
    user.otp = undefined;
    user.otpExpires = undefined;
    user.magicToken = undefined;
    user.magicTokenExpires = undefined;
    user.zkEmail = undefined;
    user.zkPassport = undefined;
    user.zkEmailVerified = false;
    user.zkPassportVerified = false;

    // Mark user as anonymized to prevent re-processing
    user.anonymizedAt = new Date();

    await user.save();
    usersRedacted++;
  }

  // 5. Create audit log
  await PrivacyAuditLog.create({
    eventId,
    eventName,
    ordersScanned: orders.length,
    usersRedacted,
    fieldsRedacted: [...PII_FIELDS],
    method,
    trigger,
    executedAt: new Date(),
    summary:
      `Anonymized ${usersRedacted}/${userIds.length} attendee(s) for event "${eventName}". ` +
      `${userIds.length - usersRedacted} user(s) skipped (active on other events or already anonymized).`,
  });

  return {
    ordersScanned: orders.length,
    usersRedacted,
    usersSkippedActive: activeUserIds.size,
  };
}

/**
 * Finds which user IDs from the given list currently have orders for
 * active (upcoming/ongoing) events. These users must NOT be anonymized.
 */
async function findUsersWithActiveEvents(
  userIds: string[],
): Promise<Set<string>> {
  if (userIds.length === 0) {
    return new Set();
  }

  const activeEventIds = await EventTicket.find({
    eventStatus: { $in: ['upcoming', 'ongoing'] },
  })
    .select('_id')
    .lean();

  if (activeEventIds.length === 0) {
    return new Set();
  }

  const activeEventIdSet = new Set(activeEventIds.map((e) => e._id.toString()));

  // Find orders linking these users to active events
  const activeOrders = await TicketOrder.find({
    user: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
    eventTicket: {
      $in: activeEventIds.map((e) => e._id),
    },
  })
    .select('user')
    .lean();

  const activeUserIds = new Set<string>();
  for (const order of activeOrders) {
    activeUserIds.add(order.user.toString());
  }

  return activeUserIds;
}

/**
 * Main entry point: find all eligible events and anonymize their attendees.
 * Called by the BullMQ worker on schedule.
 */
export async function runPostEventAnonymization(
  retentionDays: number = DEFAULT_RETENTION_DAYS,
  trigger: 'retention_expired' | 'manual' = 'retention_expired',
): Promise<AnonymizeReport> {
  const startTime = Date.now();
  const now = new Date();

  // Cutoff date: events completed before this date are eligible
  const cutoffDate = new Date(now.getTime() - retentionDays * 86_400_000);

  // 1. Find completed events whose eventDate is before the cutoff
  const eligibleEvents = await EventTicket.find({
    eventStatus: 'completed',
    eventDate: { $lte: cutoffDate },
  })
    .select('_id name eventDate eventStatus privacyLevel')
    .lean();

  // 2. Also identify active/ongoing events for reporting
  const activeEvents = await EventTicket.find({
    eventStatus: { $in: ['upcoming', 'ongoing'] },
  })
    .select('_id')
    .lean();

  let ordersScanned = 0;
  let usersRedacted = 0;
  let usersSkippedActive = 0;
  let auditLogsCreated = 0;

  // 3. Process each eligible event
  for (const event of eligibleEvents) {
    const {
      ordersScanned: o,
      usersRedacted: u,
      usersSkippedActive: s,
    } = await anonymizeEventAttendees(event._id, event.name, 'sha256', trigger);

    ordersScanned += o;
    usersRedacted += u;
    usersSkippedActive += s;
    if (u > 0) {
      auditLogsCreated++;
    }
  }

  return {
    eventsScanned: eligibleEvents.length + activeEvents.length,
    eventsEligible: eligibleEvents.length,
    eventsSkippedActive: activeEvents.length,
    ordersScanned,
    usersRedacted,
    usersSkippedActive,
    auditLogsCreated,
    durationMs: Date.now() - startTime,
  };
}
