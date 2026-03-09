import { Router } from 'express';
import {
  getEventTickets,
  getEventTicketsByCategory,
  getTrendingEventTickets,
  searchEventTickets,
} from '../controllers/event-ticket.controller';

const eventTicketRoutes = Router();

// GET /api/event-tickets/trending - Fetch trending event tickets
eventTicketRoutes.get('/trending', getTrendingEventTickets);

// GET /api/event-tickets - Fetch paginated event tickets
eventTicketRoutes.get('/', getEventTickets);

// GET /api/event-tickets/category/:category - Fetch event tickets by category
eventTicketRoutes.get('/category/:category', getEventTicketsByCategory);

// GET /api/event-tickets/search - Search event tickets
eventTicketRoutes.get('/search', searchEventTickets);

export default eventTicketRoutes;
