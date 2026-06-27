import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { PaymentVerificationService } from '../src/verification/payment-verification.service';
import Transaction from '../src/models/transaction';
import TicketOrder from '../src/models/ticket-order';
import EventTicket from '../src/models/event-ticket';
import User from '../src/models/user';
import InventoryService from '../src/services/inventory.service';

jest.mock('../src/services/paymentVerification.service', () => ({
  PaymentVerificationService: {
    verify: jest
      .fn<any>()
      .mockImplementation(async () => ({ confirmations: 2 })),
  },
}));

jest.mock('../src/state-machine/transaction.state-machine', () => ({
  TransactionStateMachine: {
    apply: jest.fn<any>().mockResolvedValue(true),
  },
}));

jest.mock('../src/services/inventory.service', () => ({
  __esModule: true,
  default: {
    reserveInventoryTransactional: jest
      .fn<any>()
      .mockResolvedValue({ success: true }),
  },
}));

// Create in-memory stores for mocks
let mockTransactions: any[] = [];
let mockOrders: any[] = [];

jest.mock('../src/models/transaction', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn<any>().mockImplementation(async (query: any) => {
      if (query.idempotencyKey)
        return (
          mockTransactions.find(
            (t) => t.idempotencyKey === query.idempotencyKey,
          ) || null
        );
      if (query.transactionId)
        return (
          mockTransactions.find(
            (t) => t.transactionId === query.transactionId,
          ) || null
        );
      return null;
    }),
    create: jest.fn<any>().mockImplementation(async (docs: any[]) => {
      const created = docs.map((d: any) => ({ ...d, _id: 'mock-tx-id' }));
      mockTransactions.push(...created);
      return created;
    }),
    find: jest.fn<any>().mockImplementation(async (query: any) => {
      if (query.transactionId)
        return mockTransactions.filter(
          (t) => t.transactionId === query.transactionId,
        );
      return [];
    }),
  },
}));

jest.mock('../src/models/ticket-order', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn<any>().mockImplementation(async (query: any) => {
      if (query.idempotencyKey)
        return (
          mockOrders.find((o) => o.idempotencyKey === query.idempotencyKey) ||
          null
        );
      return null;
    }),
    create: jest.fn<any>().mockImplementation(async (docs: any[]) => {
      const created = docs.map((d: any) => ({ ...d, _id: 'mock-order-id' }));
      mockOrders.push(...created);
      return created;
    }),
    find: jest.fn<any>().mockImplementation(async (query: any) => {
      if (query.idempotencyKey)
        return mockOrders.filter(
          (o) => o.idempotencyKey === query.idempotencyKey,
        );
      return [];
    }),
  },
}));

jest.mock('../src/models/event-ticket', () => ({
  __esModule: true,
  default: {
    findById: jest.fn<any>().mockResolvedValue({
      _id: 'mock-event-id',
      name: 'Duplicate Prevention Test Event',
      allowAnonymous: true,
      requiresVerification: false,
      privacyLevel: 'public',
      offerReceipts: true,
    }),
  },
}));

jest.mock('../src/models/user', () => ({
  __esModule: true,
  default: {
    findById: jest.fn<any>().mockReturnValue({
      select: jest.fn<any>().mockReturnValue({
        lean: jest
          .fn<any>()
          .mockResolvedValue({
            _id: 'mock-user-id',
            emailVerifiedAt: new Date(),
          }),
      }),
    }),
  },
}));

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose') as any;
  return {
    ...actual,
    startSession: jest.fn<any>().mockResolvedValue({
      startTransaction: jest.fn<any>(),
      commitTransaction: jest.fn<any>(),
      abortTransaction: jest.fn<any>(),
      endSession: jest.fn<any>(),
    }),
    isValidObjectId: jest.fn<any>().mockReturnValue(true),
  };
});

describe('Duplicate Payment Prevention', () => {
  let testUserId = '507f1f77bcf86cd799439011';
  let testEventTicketId = '507f1f77bcf86cd799439012';
  const testTxHash = '0x' + 'a'.repeat(64);
  const testAmount = 100;

  beforeEach(() => {
    mockTransactions = [];
    mockOrders = [];
    jest.clearAllMocks();
  });

  describe('Replay Attack Prevention (txHash)', () => {
    it('should reject duplicate txHash on second attempt without idempotency key', async () => {
      const result1 = await PaymentVerificationService.verifyAndIssueTicket(
        testTxHash,
        testUserId,
        testEventTicketId,
        'General',
        1,
        testAmount,
      );

      expect(result1.success).toBe(true);

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

      expect(result2.success).toBe(true);
      expect(result2.isRetry).toBe(true);
    });
  });

  describe('No Double Charges', () => {
    it('should only charge once even with multiple webhook deliveries', async () => {
      const txHash = '0x' + 'f'.repeat(64);
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440005';

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

      expect(
        mockTransactions.filter((t) => t.transactionId === txHash),
      ).toHaveLength(1);
      expect(
        mockOrders.filter((o) => o.idempotencyKey === idempotencyKey),
      ).toHaveLength(1);
    });
  });
});
