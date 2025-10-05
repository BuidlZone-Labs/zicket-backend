import { Router } from "express";
import { getEventTickets } from "../controllers/event-ticket.controller";

const eventTicketRoutes = Router();

// GET /api/event-tickets - Fetch paginated event tickets
eventTicketRoutes.get('/', getEventTickets);

export default eventTicketRoutes;
