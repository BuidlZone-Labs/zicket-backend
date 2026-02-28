import { Router } from 'express';
import { authGuard } from '../middlewares/auth';
import { uploadTicketImage } from '../middlewares/upload';
import {
  createEventTicket,
  updateEventTicket,
  deleteEventTicket,
  cleanupOrphanedTicketImages,
} from '../controllers/event-ticket.controller';

const eventsRouter = Router();

/** POST /api/events/tickets — multipart form with 'image' (JPEG/PNG <5MB); creates ticket with cloudinary_public_id and url */
eventsRouter.post('/tickets', authGuard, uploadTicketImage, createEventTicket);

/** PATCH /api/events/tickets/:id — optional new image; auto-invalidates CDN cache, replaces image if new file sent */
eventsRouter.patch(
  '/tickets/:id',
  authGuard,
  uploadTicketImage,
  updateEventTicket,
);

/** DELETE /api/events/tickets/:id — destroys image on Cloudinary then deletes ticket */
eventsRouter.delete('/tickets/:id', authGuard, deleteEventTicket);

/** POST /api/events/tickets/cleanup — cleanup job: destroy orphaned images */
eventsRouter.post('/tickets/cleanup', authGuard, cleanupOrphanedTicketImages);

export default eventsRouter;
