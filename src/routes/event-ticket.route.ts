import { Router } from "express";
import { getEventTickets, getEventTicketsByCategory } from "../controllers/event-ticket.controller";

const eventTicketRoutes = Router();

// GET /api/event-tickets - Fetch paginated event tickets
eventTicketRoutes.get('/', getEventTickets);

// GET /api/event-tickets/category/:category - Fetch event tickets by category
eventTicketRoutes.get('/category/:category', getEventTicketsByCategory);

export default eventTicketRoutes;
