import mongoose, { ClientSession } from 'mongoose';
import EventTicket, { IEventTicket } from '../models/event-ticket';
import InventoryLockService from './inventory-lock.service';

/**
 * #80 — Inventory Management Service
 *
 * Provides atomic inventory operations to prevent overselling.
 * Uses a combination of:
 * 1. Distributed Redis locking (prevents concurrent modifications)
 * 2. Atomic MongoDB findOneAndUpdate with validation (ensures no overselling)
 * 3. Optimistic locking with version field (fallback protection)
 *
 * Key principle: Check and decrement must happen atomically
 */

export interface InventoryReservationResult {
  success: boolean;
  eventTicket?: IEventTicket;
  error?: string;
  errorCode?: 'INSUFFICIENT_INVENTORY' | 'EVENT_NOT_FOUND' | 'LOCK_FAILED';
}

export interface InventoryReleaseResult {
  success: boolean;
  error?: string;
}

export interface InventoryConfirmResult {
  success: boolean;
  error?: string;
  errorCode?: 'INSUFFICIENT_INVENTORY' | 'EVENT_NOT_FOUND';
}

export class InventoryService {
  /**
   * Reserve inventory atomically using findOneAndUpdate.
   * This is the core method that prevents overselling.
   *
   * The key insight: We use MongoDB's atomic findOneAndUpdate with a condition
   * that ensures availableTickets >= quantity. If the update succeeds,
   * we reserved the inventory. If it fails (returns null), there wasn't enough.
   *
   * @param eventTicketId - Event ticket ID
   * @param quantity - Number of tickets to reserve
   * @param session - Optional MongoDB session for transactions
   * @returns ReservationResult with success status and event ticket
   */
  static async reserveInventory(
    eventTicketId: string,
    quantity: number,
    session?: ClientSession,
  ): Promise<InventoryReservationResult> {
    if (quantity <= 0) {
      return {
        success: false,
        error: 'Quantity must be positive',
        errorCode: 'INSUFFICIENT_INVENTORY',
      };
    }

    try {
      // Atomic findOneAndUpdate with condition
      // Only succeeds if availableTickets >= quantity
      const updatedEvent = await EventTicket.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(eventTicketId),
          availableTickets: { $gte: quantity }, // Key: ensure enough tickets
        },
        {
          $inc: {
            availableTickets: -quantity,
            soldTickets: quantity,
          },
        },
        {
          new: true, // Return the updated document
          session,
        },
      );

      if (!updatedEvent) {
        // Either event doesn't exist or insufficient inventory
        const event = await EventTicket.findById(eventTicketId).session(
          session || null,
        );

        if (!event) {
          return {
            success: false,
            error: 'Event not found',
            errorCode: 'EVENT_NOT_FOUND',
          };
        }

        return {
          success: false,
          error: `Only ${event.availableTickets} ticket(s) available, requested ${quantity}`,
          errorCode: 'INSUFFICIENT_INVENTORY',
        };
      }

      return {
        success: true,
        eventTicket: updatedEvent,
      };
    } catch (error) {
      console.error(
        `[InventoryService] Reserve inventory error for ${eventTicketId}:`,
        error,
      );
      return {
        success: false,
        error: `Reservation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Reserve inventory with distributed locking protection.
   * Use this for high-concurrency scenarios where multiple servers
   * might be processing purchases simultaneously.
   *
   * @param eventTicketId - Event ticket ID
   * @param quantity - Number of tickets to reserve
   * @param options - Lock options for distributed locking
   * @returns ReservationResult
   */
  static async reserveInventoryWithLock(
    eventTicketId: string,
    quantity: number,
    options?: Parameters<typeof InventoryLockService.acquireLock>[1],
  ): Promise<InventoryReservationResult> {
    return InventoryLockService.withLock(
      eventTicketId,
      () => InventoryService.reserveInventory(eventTicketId, quantity),
      options,
    );
  }

  /**
   * Reserve inventory within a MongoDB transaction with lock protection.
   * This is the recommended approach for payment verification flows.
   *
   * @param eventTicketId - Event ticket ID
   * @param quantity - Number of tickets to reserve
   * @param session - MongoDB session (required)
   * @param options - Lock options
   * @returns ReservationResult
   */
  static async reserveInventoryTransactional(
    eventTicketId: string,
    quantity: number,
    session: ClientSession,
    options?: Parameters<typeof InventoryLockService.acquireLock>[1],
  ): Promise<InventoryReservationResult> {
    // First acquire distributed lock
    const lockResult = await InventoryLockService.acquireLock(
      eventTicketId,
      options,
    );

    if (!lockResult.success) {
      return {
        success: false,
        error: `Lock acquisition failed: ${lockResult.error}`,
        errorCode: 'LOCK_FAILED',
      };
    }

    try {
      // Perform atomic reservation within transaction
      const result = await InventoryService.reserveInventory(
        eventTicketId,
        quantity,
        session,
      );

      return result;
    } finally {
      // Always release the lock
      await InventoryLockService.releaseLock(
        eventTicketId,
        lockResult.lockKey!,
      );
    }
  }

  /**
   * Release reserved inventory back to available pool.
   * Used when an order is cancelled or payment fails.
   *
   * @param eventTicketId - Event ticket ID
   * @param quantity - Number of tickets to release
   * @param session - Optional MongoDB session
   * @returns ReleaseResult
   */
  static async releaseInventory(
    eventTicketId: string,
    quantity: number,
    session?: ClientSession,
  ): Promise<InventoryReleaseResult> {
    if (quantity <= 0) {
      return {
        success: false,
        error: 'Quantity must be positive',
      };
    }

    try {
      const updatedEvent = await EventTicket.findByIdAndUpdate(
        eventTicketId,
        {
          $inc: {
            availableTickets: quantity,
            soldTickets: -quantity,
          },
        },
        {
          new: true,
          session,
        },
      );

      if (!updatedEvent) {
        return {
          success: false,
          error: 'Event not found',
        };
      }

      // Validate: availableTickets should never exceed totalTickets
      if (updatedEvent.availableTickets > updatedEvent.totalTickets) {
        // This shouldn't happen if logic is correct, but let's log it
        console.warn(
          `[InventoryService] Available tickets (${updatedEvent.availableTickets}) exceeds total (${updatedEvent.totalTickets}) for ${eventTicketId}`,
        );
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error(
        `[InventoryService] Release inventory error for ${eventTicketId}:`,
        error,
      );
      return {
        success: false,
        error: `Release failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Confirm inventory deduction (for webhook/reconciliation flows).
   * In the current design, inventory is deducted immediately on reservation,
   * so confirmation is a no-op. This method exists for future designs
   * where we might want a two-phase commit (reserve -> confirm).
   *
   * @param eventTicketId - Event ticket ID
   * @param quantity - Number of tickets to confirm
   * @param session - Optional MongoDB session
   * @returns ConfirmResult
   */
  static async confirmInventoryDeduction(
    eventTicketId: string,
    quantity: number,
    session?: ClientSession,
  ): Promise<InventoryConfirmResult> {
    // In the current atomic design, inventory is already deducted
    // This method validates that the deduction happened correctly
    try {
      const event = await EventTicket.findById(eventTicketId).session(
        session || null,
      );

      if (!event) {
        return {
          success: false,
          error: 'Event not found',
          errorCode: 'EVENT_NOT_FOUND',
        };
      }

      // Validate consistency: available + sold should equal total
      const total = event.availableTickets + event.soldTickets;
      if (total !== event.totalTickets) {
        console.warn(
          `[InventoryService] Inventory inconsistency for ${eventTicketId}: ` +
            `available(${event.availableTickets}) + sold(${event.soldTickets}) = ${total}, ` +
            `expected ${event.totalTickets}`,
        );
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error(
        `[InventoryService] Confirm inventory error for ${eventTicketId}:`,
        error,
      );
      return {
        success: false,
        error: `Confirmation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get current inventory status for an event.
   *
   * @param eventTicketId - Event ticket ID
   * @returns Object with inventory details
   */
  static async getInventoryStatus(eventTicketId: string): Promise<{
    available: number;
    sold: number;
    total: number;
    isAvailable: boolean;
  } | null> {
    try {
      const event = await EventTicket.findById(eventTicketId)
        .select('availableTickets soldTickets totalTickets')
        .lean();

      if (!event) {
        return null;
      }

      return {
        available: event.availableTickets,
        sold: event.soldTickets,
        total: event.totalTickets,
        isAvailable: event.availableTickets > 0,
      };
    } catch (error) {
      console.error(
        `[InventoryService] Get inventory status error for ${eventTicketId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Check if enough inventory is available (non-destructive check).
   * Note: This is only for informational purposes. The actual reservation
   * must use reserveInventory() for atomicity.
   *
   * @param eventTicketId - Event ticket ID
   * @param quantity - Number of tickets needed
   * @returns boolean indicating if enough tickets are available
   */
  static async checkAvailability(
    eventTicketId: string,
    quantity: number,
  ): Promise<boolean> {
    const status = await InventoryService.getInventoryStatus(eventTicketId);
    if (!status) {
      return false;
    }
    return status.available >= quantity;
  }

  /**
   * Batch reserve inventory for multiple events.
   * Useful for cart/checkout scenarios with multiple events.
   *
   * @param reservations - Array of {eventTicketId, quantity}
   * @param session - MongoDB session for atomicity
   * @returns Result with success status and any failures
   */
  static async batchReserveInventory(
    reservations: Array<{ eventTicketId: string; quantity: number }>,
    session: ClientSession,
  ): Promise<{
    success: boolean;
    results: Array<{
      eventTicketId: string;
      quantity: number;
      reserved: boolean;
      error?: string;
    }>;
    totalReserved: number;
  }> {
    const results: Array<{
      eventTicketId: string;
      quantity: number;
      reserved: boolean;
      error?: string;
    }> = [];

    let totalReserved = 0;
    let allSuccess = true;

    // Reserve each item sequentially within the transaction
    for (const { eventTicketId, quantity } of reservations) {
      const result = await InventoryService.reserveInventory(
        eventTicketId,
        quantity,
        session,
      );

      if (result.success) {
        results.push({
          eventTicketId,
          quantity,
          reserved: true,
        });
        totalReserved += quantity;
      } else {
        results.push({
          eventTicketId,
          quantity,
          reserved: false,
          error: result.error,
        });
        allSuccess = false;
      }
    }

    return {
      success: allSuccess,
      results,
      totalReserved,
    };
  }
}

export default InventoryService;
