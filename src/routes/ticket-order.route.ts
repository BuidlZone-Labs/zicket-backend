import { Router } from 'express';
import {
  getUserOrders,
  getOrganizerOrders,
} from '../controllers/ticket-order.controller';
import { authGuard } from '../middlewares/auth';

const ticketOrderRoutes = Router();

/**
 * @route GET /api/ticket-orders/my-orders
 * @desc Get ticket orders for the logged-in user
 * @access Private
 */
ticketOrderRoutes.get('/my-orders', authGuard, getUserOrders);

/**
 * @route GET /api/ticket-orders/organizer-orders
 * @desc Get ticket orders for events organized by the logged-in user
 * @access Private
 */
ticketOrderRoutes.get('/organizer-orders', authGuard, getOrganizerOrders);

export default ticketOrderRoutes;
