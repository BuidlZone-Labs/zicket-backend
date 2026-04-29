import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import mongoose from 'mongoose';
import Transaction from '../models/transaction';
import TicketOrder from '../models/ticket-order';
import EventTicket from '../models/event-ticket';
import User from '../models/user';
import { PaymentVerificationService } from '../verification/payment-verification.service';

/**
 * Duplicate Payment Prevention Tests
 *
 * These tests verify that the system properly prevents:
 * 1. No double charges (same txHash rejected)
 * 2. Safe retries with idempotency keys (same key returns cached result)
 * 3. Compound uniqueness (user + event + transaction)
 */

describe('Duplicate Payment Prevention', () => {
  let testUserId: string;
  let testEventTicketId: string;
  const testTxHash = '0x' + 'a'.repeat(64); // Mock tx hash
  const testAmount = 100;

  beforeAll(async () => {
    // Create test user
    const user = new User({
      email: 'test-duplicate@example.com',
      walletAddress: '0x' + '1'.repeat(40),
      emailVerifiedAt: new Date(),
    });
    await user.save();
    testUserId = user._id.toString();

    // Create test event
    const event = new EventTicket({
      name: 'Duplicate Prevention Test Event',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      location: 'Test Location',
      description: 'Test event for duplicate prevention',
      organizer: testUserId,
      availableTickets: 100,
      soldTickets: 0,
      totalTickets: 100,
      ticketTypes: ['General', 'VIP'],
      privacyLevel: 'public',
      allowAnonymous: true,
      requiresVerification: false,
      offerReceipts: true,
    });
    await event.save();
    testEventTicketId = event._id.toString();
  });

  afterAll(async () => {
    // Cleanup
    await User.deleteMany({ email: 'test-duplicate@example.com' });
    await EventTicket.deleteMany({
      name: 'Duplicate Prevention Test Event',
    });
    await Transaction.deleteMany({ transactionId: testTxHash });
    await TicketOrder.deleteMany({});
  });

  describe('Replay Attack Prevention (txHash)', () => {
    it('should reject duplicate txHash on second attempt without idempotency key', async () => {
      // First attempt - should succeed
      const result1 = await PaymentVerificationService.verifyAndIssueTicket(
        testTxHash,
        testUserId,
        testEventTicketId,
        'General',
        1,
        testAmount,
      );

      expect(result1.success).toBe(true);
      expect(result1.transactionId).toBeDefined();

      // Second attempt with same txHash - should fail
      const result2 = await PaymentVerificationService.verifyAndIssueTicket(
        testTxHash,
        testUserId,
        testEventTicketId,
        'General',
        1,
        testAmount,
      );

      expect(result2.success).toBe(false);
      expect(result2.message).toContain('replay');
    });
  });

  describe('Idempotency Key Support (Safe Retries)', () => {
    it('should return cached result on retry with same idempotency key', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440001';
      const uniqueTxHash = '0x' + 'b'.repeat(64);

      // First attempt
      const result1 = await PaymentVerificationService.verifyAndIssueTicket(
        uniqueTxHash,
        testUserId,
        testEventTicketId,
        'VIP',
        2,
        testAmount,
        idempotencyKey,
      );

      expect(result1.success).toBe(true);
      const transactionId1 = result1.transactionId;

      // Retry with same idempotency key - should get same result
      const result2 = await PaymentVerificationService.verifyAndIssueTicket(
        uniqueTxHash,
        testUserId,
        testEventTicketId,
        'VIP',
        2,
        testAmount,
        idempotencyKey,
      );

      expect(result2.success).toBe(true);
      expect(result2.transactionId).toBe(transactionId1);
      expect(result2.isRetry).toBe(true);
      expect(result2.message).toContain('idempotency match');
    });

    it('should reject different idempotency key with same txHash', async () => {
      const uniqueTxHash = '0x' + 'c'.repeat(64);
      const idempotencyKey1 = '550e8400-e29b-41d4-a716-446655440002';
      const idempotencyKey2 = '550e8400-e29b-41d4-a716-446655440003';

      // First request with key1
      const result1 = await PaymentVerificationService.verifyAndIssueTicket(
        uniqueTxHash,
        testUserId,
        testEventTicketId,
        'General',
        1,
        testAmount,
        idempotencyKey1,
      );

      expect(result1.success).toBe(true);

      // Second request with different key but same txHash - should fail
      const result2 = await PaymentVerificationService.verifyAndIssueTicket(
        uniqueTxHash,
        testUserId,
        testEventTicketId,
        'General',
        1,
        testAmount,
        idempotencyKey2,
      );

      expect(result2.success).toBe(false);
      expect(result2.message).toContain('replay detected');
    });
  });

  describe('Uniqueness Constraints', () => {
    it('should enforce unique transaction idempotency key', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440004';
      const txHash1 = '0x' + 'd'.repeat(64);

      // First payment
      const result1 = await PaymentVerificationService.verifyAndIssueTicket(
        txHash1,
        testUserId,
        testEventTicketId,
        'General',
        1,
        testAmount,
        idempotencyKey,
      );

      expect(result1.success).toBe(true);

      // Attempting to use same idempotency key with different txHash should fail
      const txHash2 = '0x' + 'e'.repeat(64);
      const result2 = await PaymentVerificationService.verifyAndIssueTicket(
        txHash2,
        testUserId,
        testEventTicketId,
        'General',
        1,
        testAmount,
        idempotencyKey,
      );

      // Should return cached result from first payment (idempotency semantics)
      expect(result2.success).toBe(true);
      expect(result2.isRetry).toBe(true);
    });
  });

  describe('No Double Charges', () => {
    it('should only charge once even with multiple webhook deliveries', async () => {
      const txHash = '0x' + 'f'.repeat(64);
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440005';

      // First webhook delivery
      const result1 = await PaymentVerificationService.verifyAndIssueTicket(
        txHash,
        testUserId,
        testEventTicketId,
        'General',
        1,
        testAmount,
        idempotencyKey,
      );

      expect(result1.success).toBe(true);

      // Simulate webhook retry
      const result2 = await PaymentVerificationService.verifyAndIssueTicket(
        txHash,
        testUserId,
        testEventTicketId,
        'General',
        1,
        testAmount,
        idempotencyKey,
      );

      expect(result2.success).toBe(true);
      expect(result2.transactionId).toBe(result1.transactionId);

      // Verify only one transaction was created
      const transactions = await Transaction.find({ transactionId: txHash });
      expect(transactions).toHaveLength(1);

      // Verify only one ticket order was created
      const orders = await TicketOrder.find({ idempotencyKey });
      expect(orders).toHaveLength(1);
    });
  });
});
