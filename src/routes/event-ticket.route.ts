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
import { getOrganizerBalance } from '../controllers/organizer-balance.controller';
import {
  joinWaitlist,
  leaveWaitlist,
  getWaitlistStatus,
} from '../controllers/waitlist.controller';
import { authGuard } from '../middlewares/auth';

const eventTicketRoutes = Router();

/**
 * @swagger
 * /event-tickets/trending:
 *   get:
 *     summary: Fetch trending event tickets
 *     tags:
 *       - Event Tickets
 *     responses:
 *       200:
 *         description: List of trending events
 */
eventTicketRoutes.get('/trending', getTrendingEventTickets);

/**
 * @swagger
 * /event-tickets/scan:
 *   post:
 *     summary: Scan and validate ticket for entry
 *     tags:
 *       - Event Tickets
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ticketId
 *             properties:
 *               ticketId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ticket validated and marked as used
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ticket not found
 */
eventTicketRoutes.post('/scan', authGuard, scanTicket);

/**
 * @swagger
 * /event-tickets/validate:
 *   post:
 *     summary: Validate ticket without marking as used
 *     tags:
 *       - Event Tickets
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ticketId
 *             properties:
 *               ticketId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ticket is valid
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ticket not found
 */
eventTicketRoutes.post('/validate', authGuard, validateTicket);

/**
 * @swagger
 * /event-tickets:
 *   get:
 *     summary: Fetch event tickets with pagination
 *     tags:
 *       - Event Tickets
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Cursor for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of results per page
 *     responses:
 *       200:
 *         description: List of event tickets
 */
eventTicketRoutes.get('/', getEventTickets);

/**
 * @swagger
 * /event-tickets/category/{category}:
 *   get:
 *     summary: Fetch event tickets by category
 *     tags:
 *       - Event Tickets
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event tickets in category
 */
eventTicketRoutes.get('/category/:category', getEventTicketsByCategory);

/**
 * @swagger
 * /event-tickets/search:
 *   get:
 *     summary: Search event tickets
 *     tags:
 *       - Event Tickets
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Search results
 */
eventTicketRoutes.get('/search', searchEventTickets);

/**
 * @swagger
 * /event-tickets/{eventId}/organizer-balance:
 *   get:
 *     summary: Get organizer balance for event
 *     tags:
 *       - Event Tickets
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Organizer balance details
 *       401:
 *         description: Unauthorized
 */
eventTicketRoutes.get(
  '/:eventId/organizer-balance',
  authGuard,
  getOrganizerBalance,
);

/**
 * @swagger
 * /event-tickets/{eventId}:
 *   get:
 *     summary: Fetch a single event by ID
 *     tags:
 *       - Event Tickets
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event ticket details
 *       404:
 *         description: Event not found
 */
eventTicketRoutes.get('/:eventId', getEventById);

/**
 * @swagger
 * /event-tickets/create-step-two:
 *   post:
 *     summary: Create event with privacy settings
 *     tags:
 *       - Event Tickets
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Event created successfully
 *       401:
 *         description: Unauthorized
 */
eventTicketRoutes.post(
  '/create-step-two',
  authGuard,
  createEventWithPrivacySettings,
);

/**
 * @swagger
 * /event-tickets/{eventId}/update-step-two:
 *   patch:
 *     summary: Update event privacy settings
 *     tags:
 *       - Event Tickets
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Event updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 */
eventTicketRoutes.patch(
  '/:eventId/update-step-two',
  authGuard,
  updateEventPrivacySettings,
);

/**
 * @swagger
 * /event-tickets/{eventId}/waitlist:
 *   post:
 *     summary: Join waitlist for sold-out event
 *     tags:
 *       - Event Tickets
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Added to waitlist
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 */
eventTicketRoutes.post('/:eventId/waitlist', authGuard, joinWaitlist);

/**
 * @swagger
 * /event-tickets/{eventId}/waitlist:
 *   delete:
 *     summary: Leave waitlist or give up a held spot
 *     tags:
 *       - Event Tickets
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Removed from waitlist
 *       401:
 *         description: Unauthorized
 */
eventTicketRoutes.delete('/:eventId/waitlist', authGuard, leaveWaitlist);

/**
 * @swagger
 * /event-tickets/{eventId}/waitlist/status:
 *   get:
 *     summary: Get current waitlist status and position
 *     tags:
 *       - Event Tickets
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Waitlist status
 *       401:
 *         description: Unauthorized
 */
eventTicketRoutes.get(
  '/:eventId/waitlist/status',
  authGuard,
  getWaitlistStatus,
);

export default eventTicketRoutes;
