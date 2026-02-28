import { Router } from 'express';
import { authGuard } from '../middlewares/auth';
import {
  getMyOrders,
  getOrganizerOrders,
} from '../controllers/ticket-order.controller';

const ticketOrderRoutes = Router();

// All ticket-order routes require authentication
ticketOrderRoutes.use(authGuard);

// GET /ticket-orders/me – current user's orders (buyer)
ticketOrderRoutes.get('/me', getMyOrders);

// GET /ticket-orders/organizer – orders for events organized by current user
ticketOrderRoutes.get('/organizer', getOrganizerOrders);

export default ticketOrderRoutes;
