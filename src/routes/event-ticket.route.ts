import { Router } from 'express';
import {
  getEventTickets,
  getEventTicketsByCategory,
  getTrendingEventTickets,
  createEventTicket,
  updateEventTicketPrivacy,
} from '../controllers/event-ticket.controller';

const eventTicketRoutes = Router();

// POST /api/event-tickets - Create a new event ticket with privacy settings
eventTicketRoutes.post('/', createEventTicket);

// GET /api/event-tickets/trending - Fetch trending event tickets
eventTicketRoutes.get('/trending', getTrendingEventTickets);

// GET /api/event-tickets - Fetch paginated event tickets
eventTicketRoutes.get('/', getEventTickets);

// GET /api/event-tickets/category/:category - Fetch event tickets by category
eventTicketRoutes.get('/category/:category', getEventTicketsByCategory);

// PATCH /api/event-tickets/:ticketId/privacy - Update event ticket privacy settings
eventTicketRoutes.patch('/:ticketId/privacy', updateEventTicketPrivacy);

export default eventTicketRoutes;
