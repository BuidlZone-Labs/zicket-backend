import { RequestHandler } from 'express';
import { EventTicketService } from '../services/event-ticket.service';
import { CreateEventTicketSchema } from '../validators/event.validator';
import { UserAuthenticatedReq } from '../utils/types';

export const getEventTickets: RequestHandler = async (req, res) => {
  try {
    // Extract pagination parameters from query
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 8;

    // Validate pagination parameters
    if (page < 1) {
      return res.status(400).json({
        error: 'Invalid page number',
        message: 'Page number must be greater than 0',
      });
    }

    if (limit < 1 || limit > 50) {
      return res.status(400).json({
        error: 'Invalid limit',
        message: 'Limit must be between 1 and 50',
      });
    }

    // Fetch event tickets from service
    const result = await EventTicketService.getEventTickets(page, limit);

    // Return success response
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching event tickets:', error);

    // Return error response
    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to fetch event tickets',
    });
  }
};

export const getEventTicketsByCategory: RequestHandler = async (req, res) => {
  try {
    // Extract category from params and pagination from query
    const category = req.params.category as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 8;

    // Validate category parameter
    if (!category || category.trim() === '') {
      return res.status(400).json({
        error: 'Invalid category',
        message: 'Category parameter is required',
      });
    }

    // Validate pagination parameters
    if (page < 1) {
      return res.status(400).json({
        error: 'Invalid page number',
        message: 'Page number must be greater than 0',
      });
    }

    // Fetch event tickets by category from service
    const result = await EventTicketService.getEventTicketsByCategory(
      category,
      page,
      limit,
    );

    // Return success response
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching event tickets by category:', error);

    // Return error response
    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to fetch event tickets by category',
    });
  }
};

export const getTrendingEventTickets: RequestHandler = async (req, res) => {
  try {
    // Fetch trending event tickets from service
    const result = await EventTicketService.getTrendingEventTickets();

    // Return success response
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching trending event tickets:', error);

    // Return error response
    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to fetch trending event tickets',
    });
  }
};

/** POST /api/events/tickets — multipart with image; validates JPEG/PNG <5MB, stores cloudinary_public_id and url */
export const createEventTicket: RequestHandler = async (
  req: UserAuthenticatedReq,
  res,
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Validation failed',
        message:
          'An image file is required (field: image). Allowed: JPEG, PNG, max 5MB.',
      });
    }

    const parsed = CreateEventTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      const messages = parsed.error.flatten().fieldErrors;
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid request body',
        details: messages,
      });
    }

    const userId = req.user?.id ?? req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const ticket = await EventTicketService.createEventTicket(
      userId,
      parsed.data,
      req.file.buffer,
    );

    res.status(201).json({
      message: 'Event ticket created',
      data: {
        id: ticket._id,
        name: ticket.name,
        imageUrl: ticket.imageUrl,
        cloudinary_public_id: ticket.cloudinary_public_id,
      },
    });
  } catch (error) {
    console.error('Create event ticket error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to create event ticket',
    });
  }
};

/** PATCH /api/events/tickets/:id — optional new image; auto-invalidates CDN cache on update */
export const updateEventTicket: RequestHandler = async (
  req: UserAuthenticatedReq,
  res,
) => {
  try {
    const ticketId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    if (!ticketId) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }
    const userId = req.user?.id ?? req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body as Record<string, unknown>;
    const parsed = CreateEventTicketSchema.partial().safeParse(body);
    const data = parsed.success ? parsed.data : {};

    const ticket = await EventTicketService.updateEventTicket(
      ticketId,
      userId,
      data,
      req.file?.buffer,
    );

    if (!ticket) {
      return res.status(404).json({ error: 'Event ticket not found' });
    }

    res.status(200).json({
      message: 'Event ticket updated',
      data: {
        id: ticket._id,
        name: ticket.name,
        imageUrl: ticket.imageUrl,
        cloudinary_public_id: ticket.cloudinary_public_id,
      },
    });
  } catch (error) {
    console.error('Update event ticket error:', error);
    res.status(500).json({
      error: 'Update failed',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to update event ticket',
    });
  }
};

/** DELETE /api/events/tickets/:id — destroys Cloudinary image then deletes ticket */
export const deleteEventTicket: RequestHandler = async (
  req: UserAuthenticatedReq,
  res,
) => {
  try {
    const ticketId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    if (!ticketId) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }
    const userId = req.user?.id ?? req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const deleted = await EventTicketService.deleteEventTicket(
      ticketId,
      userId,
    );

    if (!deleted) {
      return res.status(404).json({ error: 'Event ticket not found' });
    }

    res.status(200).json({ message: 'Event ticket deleted' });
  } catch (error) {
    console.error('Delete event ticket error:', error);
    res.status(500).json({
      error: 'Deletion failed',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to delete event ticket',
    });
  }
};

/** POST /api/events/tickets/cleanup — destroy orphaned Cloudinary images (cleanup job) */
export const cleanupOrphanedTicketImages: RequestHandler = async (
  _req,
  res,
) => {
  try {
    const result = await EventTicketService.cleanupOrphanedTicketImages();
    res.status(200).json({
      message: 'Cleanup completed',
      data: result,
    });
  } catch (error) {
    console.error('Cleanup job error:', error);
    res.status(500).json({
      error: 'Cleanup failed',
      message: error instanceof Error ? error.message : 'Failed to run cleanup',
    });
  }
};
