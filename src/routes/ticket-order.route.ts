import { Router } from 'express';
import {
  getUserOrders,
  getOrganizerOrders,
  verifyPayment,
  updateTicketOrderStatus,
} from '../controllers/ticket-order.controller';
import { getTransactionStatus } from '../controllers/transaction-status.controller';
import { authGuard } from '../middlewares/auth';
import { idempotencyMiddleware } from '../middlewares/idempotency';

const ticketOrderRoutes = Router();

/**
 * @route GET /ticket-orders/my-orders
 * @desc Get ticket orders for the logged-in user
 * @access Private
 */
ticketOrderRoutes.get('/my-orders', authGuard, getUserOrders);

/**
 * @route GET /ticket-orders/organizer-orders
 * @desc Get ticket orders for events organized by the logged-in user
 * @access Private
 */
ticketOrderRoutes.get('/organizer-orders', authGuard, getOrganizerOrders);

/**
 * @route POST /ticket-orders/verify-payment
 * @desc Verify a blockchain payment and issue a ticket
 * @access Private
 * @header Idempotency-Key: <uuid>  (recommended for safe retries)
 */
ticketOrderRoutes.post(
  '/verify-payment',
  authGuard,
  idempotencyMiddleware,
  verifyPayment,
);

/**
 * @route GET /ticket-orders/transaction-status/:txHash
 * @desc Poll the current state of a blockchain transaction (pending/confirmed/failed)
 * @access Private
 *
 * Frontend should poll this endpoint after submitting a payment until
 * isTerminal === true, then redirect based on the state value.
 */
ticketOrderRoutes.get(
  '/transaction-status/:txHash',
  authGuard,
  getTransactionStatus,
);

/**
 * @route PATCH /ticket-orders/:orderId/status
 * @desc Update ticket order status (organizer/admin only)
 * @access Private
 */
ticketOrderRoutes.patch('/:orderId/status', authGuard, updateTicketOrderStatus);

export default ticketOrderRoutes;
