import mongoose from 'mongoose';
import { RequestHandler } from 'express';
import { TicketOrderService } from '../services/ticket-order.service';
import { PaymentVerificationService } from '../verification/payment-verification.service';
import { UserAuthenticatedReq } from '../utils/types';
import { getIdempotencyKey } from '../middlewares/idempotency';
import TicketOrder from '../models/ticket-order';
import EventTicket from '../models/event-ticket';

/**
 * Controller for Ticket Orders and Payments transparency
 */
export const getUserOrders: RequestHandler = async (
  req: UserAuthenticatedReq,
  res,
) => {
  try {
    const userId = req.user?._id || (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    const result = await TicketOrderService.getUserOrders(
      userId.toString(),
      page,
      limit,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching user ticket orders:', error);
    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to fetch user ticket orders',
    });
  }
};

export const getOrganizerOrders: RequestHandler = async (
  req: UserAuthenticatedReq,
  res,
) => {
  try {
    const userId = req.user?._id || (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    const result = await TicketOrderService.getOrganizerOrders(
      userId.toString(),
      page,
      limit,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching organizer ticket orders:', error);
    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to fetch organizer ticket orders',
    });
  }
};

/**
 * #75 — Verify a blockchain payment and issue a ticket.
 *
 * POST /api/ticket-orders/verify-payment
 * Body: { txHash, eventTicketId, ticketType, quantity, expectedAmount }
 */
export const verifyPayment: RequestHandler = async (
  req: UserAuthenticatedReq,
  res,
) => {
  try {
    const userId = req.user?._id || (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    }

    const { txHash, eventTicketId, ticketType, quantity, expectedAmount } =
      req.body;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!txHash || typeof txHash !== 'string' || txHash.trim() === '') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'txHash is required',
      });
    }

    if (!eventTicketId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'eventTicketId is required',
      });
    }

    if (!ticketType || typeof ticketType !== 'string') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'ticketType is required',
      });
    }

    const parsedQty = parseInt(quantity, 10);
    if (!parsedQty || parsedQty < 1) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'quantity must be at least 1',
      });
    }

    const parsedAmount = parseFloat(expectedAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'expectedAmount must be a non-negative number',
      });
    }

    // ── Payment verification ──────────────────────────────────────────────────
    const idempotencyKey = getIdempotencyKey(req);
    const result = await PaymentVerificationService.verifyAndIssueTicket(
      txHash.trim(),
      userId.toString(),
      eventTicketId,
      ticketType,
      parsedQty,
      parsedAmount,
      idempotencyKey,
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      isRetry: result.isRetry,
      data: {
        transactionId: result.transactionId,
        orderId: result.orderId,
      },
    });
  } catch (error) {
    console.error('[TicketOrderController] verifyPayment error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error ? error.message : 'Payment verification failed',
    });
  }
};

/**
 * Update ticket order status with notification
 * Restricted to organizers or system admins
 */
export const updateTicketOrderStatus: RequestHandler = async (
  req: UserAuthenticatedReq,
  res,
) => {
  try {
    const userId = req.user?._id || (req.user as any)?.id;
    const { orderId } = req.params as { orderId: string };
    const { status } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    }

    if (!orderId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Order ID is required',
      });
    }

    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Invalid order ID format',
      });
    }

    if (status === undefined || ![0, 1, 3].includes(status)) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Valid status (0, 1, or 3) is required',
      });
    }

    const order = await TicketOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Ticket order not found',
      });
    }

    const eventTicket = await EventTicket.findById(order.eventTicket);
    if (!eventTicket) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Associated event ticket not found',
      });
    }

    if (eventTicket.organizedBy.toString() !== userId.toString()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to update this ticket order',
      });
    }

    const { order: updatedOrder, notificationJobId } =
      await TicketOrderService.updateOrderStatusWithNotification(
        orderId,
        status,
      );

    res.status(200).json({
      success: true,
      message: 'Ticket order status updated successfully',
      data: {
        order: updatedOrder,
        notificationJobId,
      },
    });
  } catch (error) {
    console.error('Error updating ticket order status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to update ticket order status',
    });
  }
};
