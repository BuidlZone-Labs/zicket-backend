import { Router } from 'express';
import {
  getEventTickets,
  getEventTicketsByCategory,
  getTrendingEventTickets,
  createEventWithPrivacySettings,
  updateEventPrivacySettings,
  getEventById,
  searchEventTickets,
  scanTicket,
  validateTicket,
} from '../controllers/event-ticket.controller';
import { authGuard } from '../middlewares/auth';

const eventTicketRoutes = Router();

// GET /api/event-tickets/trending - Fetch trending event tickets
eventTicketRoutes.get('/trending', getTrendingEventTickets);

// POST /api/event-tickets/scan - Scan and validate ticket for entry
eventTicketRoutes.post('/scan', authGuard, scanTicket);

// POST /api/event-tickets/validate - Validate ticket without marking as used
eventTicketRoutes.post('/validate', authGuard, validateTicket);

// GET /api/event-tickets - Fetch paginated event tickets
eventTicketRoutes.get('/', getEventTickets);

// GET /api/event-tickets/category/:category - Fetch event tickets by category
eventTicketRoutes.get('/category/:category', getEventTicketsByCategory);

// GET /api/event-tickets/search - Search event tickets
eventTicketRoutes.get('/search', searchEventTickets);

// GET /api/event-tickets/:eventId - Fetch a single event by ID
eventTicketRoutes.get('/:eventId', getEventById);

// POST /api/event-tickets/create-step-two - Create event with privacy settings (Step 2)
eventTicketRoutes.post(
  '/create-step-two',
  authGuard,
  createEventWithPrivacySettings,
);

// PATCH /api/event-tickets/:eventId/update-step-two - Update event privacy settings (Step 2)
eventTicketRoutes.patch(
  '/:eventId/update-step-two',
  authGuard,
  updateEventPrivacySettings,
);

export default eventTicketRoutes;
