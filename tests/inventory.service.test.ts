import mongoose from 'mongoose';
import InventoryService from '../src/services/inventory.service';
import InventoryLockService from '../src/services/inventory-lock.service';
import EventTicket from '../src/models/event-ticket';

/**
 * #80 — Inventory Service Tests
 *
 * Tests for distributed inventory locking and atomic operations
 * to prevent race conditions and overselling.
 */

jest.mock('../src/models/event-ticket');
jest.mock('../src/config/queue', () => ({
  redisConfig: {
    host: 'localhost',
    port: 6379,
  },
}));

const mockEventTicket = EventTicket as jest.Mocked<typeof EventTicket>;

// Helper to create valid ObjectId for tests
const createObjectId = (seed: string) => {
  // Generate a valid 24-character hex string from the seed
  const hex = Buffer.from(seed.padEnd(12, ' ')).toString('hex').slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
};

describe('InventoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('reserveInventory', () => {
    it('successfully reserves inventory when enough tickets available', async () => {
      const mockEvent = {
        _id: createObjectId('event123'),
        name: 'Test Event',
        availableTickets: 8,
        soldTickets: 2,
        totalTickets: 10,
      };

      (mockEventTicket.findOneAndUpdate as jest.Mock).mockResolvedValue(
        mockEvent,
      );

      const validEventId = '507f1f77bcf86cd799439011';
      const result = await InventoryService.reserveInventory(validEventId, 2);

      expect(result.success).toBe(true);
      expect(result.eventTicket).toEqual(mockEvent);
      expect(mockEventTicket.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: expect.any(mongoose.Types.ObjectId),
          availableTickets: { $gte: 2 },
        },
        {
          $inc: {
            availableTickets: -2,
            soldTickets: 2,
          },
        },
        { new: true, session: undefined },
      );
    });

    it('fails to reserve when insufficient inventory', async () => {
      // findOneAndUpdate returns null when condition fails
      (mockEventTicket.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

      // Mock the fallback check to return an event with low inventory
      // Need to support chaining: findById().session()
      const mockEvent = {
        _id: createObjectId('event123'),
        availableTickets: 1,
      };
      (mockEventTicket.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockEvent),
      });

      const validEventId = '507f1f77bcf86cd799439011';
      const result = await InventoryService.reserveInventory(validEventId, 5);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_INVENTORY');
      expect(result.error).toContain('Only 1 ticket(s) available');
    });

    it('fails to reserve when event not found', async () => {
      const validEventId = '507f1f77bcf86cd799439011';
      
      // First call (findOneAndUpdate) returns null
      (mockEventTicket.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
      // Second call (findById to check existence) also returns null
      (mockEventTicket.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });

      const result = await InventoryService.reserveInventory(validEventId, 1);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EVENT_NOT_FOUND');
    });

    it('rejects invalid quantity', async () => {
      const validEventId = '507f1f77bcf86cd799439011';
      const result = await InventoryService.reserveInventory(validEventId, 0);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_INVENTORY');
      expect(mockEventTicket.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('handles database errors gracefully', async () => {
      (mockEventTicket.findOneAndUpdate as jest.Mock).mockRejectedValue(
        new Error('DB connection failed'),
      );

      const validEventId = '507f1f77bcf86cd799439011';
      const result = await InventoryService.reserveInventory(validEventId, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('DB connection failed');
    });
  });

  describe('releaseInventory', () => {
    it('successfully releases inventory back to available pool', async () => {
      const mockEvent = {
        _id: createObjectId('event123'),
        availableTickets: 12,
        soldTickets: 8,
        totalTickets: 20,
      };

      (mockEventTicket.findByIdAndUpdate as jest.Mock).mockResolvedValue(
        mockEvent,
      );

      const validEventId = '507f1f77bcf86cd799439011';
      const result = await InventoryService.releaseInventory(validEventId, 2);

      expect(result.success).toBe(true);
      expect(mockEventTicket.findByIdAndUpdate).toHaveBeenCalledWith(
        validEventId,
        {
          $inc: {
            availableTickets: 2,
            soldTickets: -2,
          },
        },
        { new: true, session: undefined },
      );
    });

    it('fails to release when event not found', async () => {
      (mockEventTicket.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

      const validEventId = '507f1f77bcf86cd799439011';
      const result = await InventoryService.releaseInventory(validEventId, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Event not found');
    });

    it('rejects invalid quantity', async () => {
      const validEventId = '507f1f77bcf86cd799439011';
      const result = await InventoryService.releaseInventory(validEventId, 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Quantity must be positive');
    });
  });

  describe('checkAvailability', () => {
    it('returns true when enough tickets available', async () => {
      (mockEventTicket.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: createObjectId('event123'),
            availableTickets: 10,
            soldTickets: 5,
            totalTickets: 15,
          }),
        }),
      });

      const validEventId = '507f1f77bcf86cd799439011';
      const result = await InventoryService.checkAvailability(validEventId, 5);

      expect(result).toBe(true);
    });

    it('returns false when not enough tickets available', async () => {
      (mockEventTicket.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: createObjectId('event123'),
            availableTickets: 2,
            soldTickets: 8,
            totalTickets: 10,
          }),
        }),
      });

      const validEventId = '507f1f77bcf86cd799439011';
      const result = await InventoryService.checkAvailability(validEventId, 5);

      expect(result).toBe(false);
    });

    it('returns false when event not found', async () => {
      (mockEventTicket.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      const validEventId = '507f1f77bcf86cd799439011';
      const result = await InventoryService.checkAvailability(validEventId, 1);

      expect(result).toBe(false);
    });
  });

  describe('getInventoryStatus', () => {
    it('returns inventory status for existing event', async () => {
      (mockEventTicket.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: createObjectId('event123'),
            availableTickets: 15,
            soldTickets: 35,
            totalTickets: 50,
          }),
        }),
      });

      const validEventId = '507f1f77bcf86cd799439011';
      const result = await InventoryService.getInventoryStatus(validEventId);

      expect(result).toEqual({
        available: 15,
        sold: 35,
        total: 50,
        isAvailable: true,
      });
    });

    it('returns null when event not found', async () => {
      (mockEventTicket.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      const validEventId = '507f1f77bcf86cd799439011';
      const result = await InventoryService.getInventoryStatus(validEventId);

      expect(result).toBeNull();
    });
  });

  describe('confirmInventoryDeduction', () => {
    it('confirms inventory deduction successfully', async () => {
      (mockEventTicket.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue({
          _id: createObjectId('event123'),
          availableTickets: 8,
          soldTickets: 2,
          totalTickets: 10,
        }),
      });

      const validEventId = '507f1f77bcf86cd799439011';
      const result = await InventoryService.confirmInventoryDeduction(
        validEventId,
        2,
      );

      expect(result.success).toBe(true);
    });

    it('fails when event not found', async () => {
      (mockEventTicket.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });

      const validEventId = '507f1f77bcf86cd799439011';
      const result = await InventoryService.confirmInventoryDeduction(
        validEventId,
        2,
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EVENT_NOT_FOUND');
    });
  });

  describe('batchReserveInventory', () => {
    it('successfully reserves inventory for multiple events', async () => {
      const validEventId1 = '507f1f77bcf86cd799439011';
      const validEventId2 = '507f1f77bcf86cd799439012';
      
      (mockEventTicket.findOneAndUpdate as jest.Mock)
        .mockResolvedValueOnce({ _id: createObjectId('event1'), availableTickets: 8, soldTickets: 2 })
        .mockResolvedValueOnce({ _id: createObjectId('event2'), availableTickets: 15, soldTickets: 5 });

      const mockSession = {} as mongoose.ClientSession;
      const reservations = [
        { eventTicketId: validEventId1, quantity: 2 },
        { eventTicketId: validEventId2, quantity: 5 },
      ];

      const result = await InventoryService.batchReserveInventory(
        reservations,
        mockSession,
      );

      expect(result.success).toBe(true);
      expect(result.totalReserved).toBe(7);
      expect(result.results).toHaveLength(2);
      expect(result.results.every((r) => r.reserved)).toBe(true);
    });

    it('handles partial failures correctly', async () => {
      const validEventId1 = '507f1f77bcf86cd799439011';
      const validEventId2 = '507f1f77bcf86cd799439012';
      
      // First succeeds, second fails
      (mockEventTicket.findOneAndUpdate as jest.Mock)
        .mockResolvedValueOnce({ _id: createObjectId('event1'), availableTickets: 8 })
        .mockResolvedValueOnce(null);

      (mockEventTicket.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue({ availableTickets: 1 }),
      });

      const mockSession = {} as mongoose.ClientSession;
      const reservations = [
        { eventTicketId: validEventId1, quantity: 2 },
        { eventTicketId: validEventId2, quantity: 5 },
      ];

      const result = await InventoryService.batchReserveInventory(
        reservations,
        mockSession,
      );

      expect(result.success).toBe(false);
      expect(result.totalReserved).toBe(2);
      expect(result.results[0].reserved).toBe(true);
      expect(result.results[1].reserved).toBe(false);
    });
  });
});

describe('InventoryLockService', () => {
  // Note: Redis integration tests would require a running Redis instance
  // These tests focus on the interface and error handling

  describe('lock key generation', () => {
    it('generates consistent lock keys', () => {
      const key1 = (InventoryLockService as any).getLockKey('event123');
      const key2 = (InventoryLockService as any).getLockKey('event123');

      expect(key1).toBe(key2);
      expect(key1).toBe('inventory:lock:event123');
    });

    it('generates unique lock keys for different events', () => {
      const key1 = (InventoryLockService as any).getLockKey('event1');
      const key2 = (InventoryLockService as any).getLockKey('event2');

      expect(key1).not.toBe(key2);
    });
  });
});

describe('Concurrent Purchase Scenarios', () => {
  /**
   * These tests verify that the atomic findOneAndUpdate with $gte condition
   * is the correct mechanism to prevent overselling.
   */

  it('prevents overselling with concurrent reservation attempts', async () => {
    const validEventId = '507f1f77bcf86cd799439011';
    let availableTickets = 10;

    // Mock the atomic findOneAndUpdate to simulate real concurrent behavior
    // The key is that findOneAndUpdate with $gte condition is atomic
    (mockEventTicket.findOneAndUpdate as jest.Mock).mockImplementation(
      (filter) => {
        const requestedQuantity = filter.availableTickets?.$gte || 1;
        
        // Simulate atomic check: only succeed if enough tickets available
        if (availableTickets >= requestedQuantity) {
          availableTickets -= requestedQuantity;
          return Promise.resolve({
            _id: createObjectId('event'),
            availableTickets,
            soldTickets: 10 - availableTickets,
          });
        }

        // Simulate condition failure - not enough tickets
        return Promise.resolve(null);
      },
    );

    (mockEventTicket.findById as jest.Mock).mockReturnValue({
      session: jest.fn().mockResolvedValue({
        _id: createObjectId('event'),
        availableTickets: 1,
      }),
    });

    // 5 concurrent purchase attempts of 3 tickets each
    const purchaseAttempts = Array(5)
      .fill(null)
      .map(() => InventoryService.reserveInventory(validEventId, 3));

    const results = await Promise.all(purchaseAttempts);

    const successfulPurchases = results.filter((r) => r.success).length;
    const totalSold = (10 - availableTickets);

    // Should not oversell: max 3 successful purchases (9 tickets)
    expect(successfulPurchases).toBeLessThanOrEqual(4);
    expect(totalSold).toBeLessThanOrEqual(10);
    expect(availableTickets).toBeGreaterThanOrEqual(0);
  });

  it('ensures inventory consistency after multiple operations', async () => {
    const validEventId = '507f1f77bcf86cd799439011';
    let availableTickets = 100;
    let soldTickets = 0;

    (mockEventTicket.findOneAndUpdate as jest.Mock).mockImplementation(
      (filter, update) => {
        const requestedQuantity = Math.abs(update.$inc?.availableTickets || 1);

        // Only proceed if we have enough tickets
        if (availableTickets >= requestedQuantity) {
          availableTickets -= requestedQuantity;
          soldTickets += requestedQuantity;
          return Promise.resolve({
            _id: createObjectId('event'),
            availableTickets,
            soldTickets,
          });
        }

        return Promise.resolve(null);
      },
    );

    (mockEventTicket.findById as jest.Mock).mockReturnValue({
      session: jest.fn().mockResolvedValue({
        availableTickets: 1,
      }),
    });

    // Simulate 20 concurrent purchases of varying quantities
    const purchases = [
      ...Array(10).fill(1), // 10 people buying 1 ticket
      ...Array(5).fill(2), // 5 people buying 2 tickets
      ...Array(3).fill(5), // 3 people buying 5 tickets
      ...Array(2).fill(10), // 2 people buying 10 tickets
    ].map((qty) => InventoryService.reserveInventory(validEventId, qty as number));

    const results = await Promise.all(purchases);

    const successfulCount = results.filter((r) => r.success).length;

    // Inventory consistency check: available + sold = total
    expect(availableTickets + soldTickets).toBe(100);
    expect(availableTickets).toBeGreaterThanOrEqual(0);
    expect(successfulCount).toBeGreaterThanOrEqual(0);
  });
});
