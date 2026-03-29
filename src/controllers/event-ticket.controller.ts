import { RequestHandler } from 'express';
import { EventTicketService } from '../services/event-ticket.service';
import {
  CreateEventStepTwoSchema,
  CreateEventStepTwoInput,
} from '../validators/event.validator';
import { UserAuthenticatedReq } from '../utils/types';

export const getEventTickets: RequestHandler = async (req, res) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 8;

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

    const result = await EventTicketService.getEventTickets(page, limit);

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching event tickets:', error);

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
    const category = req.params.category as string;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = 8;

    if (!category || category.trim() === '') {
      return res.status(400).json({
        error: 'Invalid category',
        message: 'Category parameter is required',
      });
    }

    if (page < 1) {
      return res.status(400).json({
        error: 'Invalid page number',
        message: 'Page number must be greater than 0',
      });
    }

    const result = await EventTicketService.getEventTicketsByCategory(
      category,
      page,
      limit,
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching event tickets by category:', error);

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
    const result = await EventTicketService.getTrendingEventTickets();

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching trending event tickets:', error);

    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to fetch trending event tickets',
    });
  }
};

/**
 * Creates a new event with step 2 privacy settings
 * POST /api/event-tickets/create-step-two
 */
export const createEventWithPrivacySettings: RequestHandler = async (
  req: UserAuthenticatedReq,
  res,
) => {
  try {
    // Validate request body
    const validatedData: CreateEventStepTwoInput =
      CreateEventStepTwoSchema.parse(req.body);

    // Get user ID from authenticated request
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    }

    // Extract additional required fields from request body
    const {
      name,
      about,
      price,
      eventCategory,
      eventDate,
      imageUrl,
      cloudinary_public_id,
      tags,
    } = req.body;

    // Validate required base fields
    if (
      !name ||
      !about ||
      !price ||
      !eventCategory ||
      !eventDate ||
      !imageUrl
    ) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Missing required base event fields',
      });
    }

    // Prepare event data
    const eventData = {
      name,
      about,
      price,
      eventCategory,
      organizedBy: userId,
      eventDate: new Date(eventDate),
      imageUrl,
      cloudinary_public_id,
      tags: tags || [],
      ...validatedData,
    };

    // Create event with privacy settings
    const event =
      await EventTicketService.createEventWithPrivacySettings(eventData);

    res.status(201).json({
      success: true,
      message: 'Event created successfully with privacy settings',
      data: {
        eventId: event._id,
        name: event.name,
        privacyLevel: event.privacyLevel,
        attendanceMode: event.attendanceMode,
        eventType: event.eventType,
        locationType: event.locationType,
        location: event.location,
        paymentPrivacy: event.paymentPrivacy,
        offerReceipts: event.offerReceipts,
        hasZkEmailUpdates: event.hasZkEmailUpdates,
        hasEventReminders: event.hasEventReminders,
        ticketTypes: event.ticketType,
        totalTickets: event.totalTickets,
        isPublished: event.isPublished,
        createdAt: (event as any).createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error creating event with privacy settings:', error);

    // Handle Zod validation errors
    if (error.errors) {
      return res.status(400).json({
        error: 'Validation failed',
        message: error.errors[0]?.message || 'Invalid request data',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to create event with privacy settings',
    });
  }
};

/**
 * Updates an existing event with step 2 privacy settings
 * PATCH /api/event-tickets/:eventId/update-step-two
 */
export const updateEventPrivacySettings: RequestHandler = async (
  req: UserAuthenticatedReq,
  res,
) => {
  try {
    const eventId = Array.isArray(req.params.eventId)
      ? req.params.eventId[0]
      : req.params.eventId;

    if (!eventId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Event ID is required',
      });
    }

    // Validate request body (partial update)
    const validatedData: Partial<CreateEventStepTwoInput> =
      CreateEventStepTwoSchema.partial().parse(req.body);

    // Get user ID from authenticated request
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    }

    // Verify event ownership
    const existingEvent = await EventTicketService.getEventById(eventId);

    if (!existingEvent) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Event not found',
      });
    }

    // Check if user owns this event
    if (existingEvent.organizedBy.toString() !== userId.toString()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to update this event',
      });
    }

    // Update event privacy settings
    const updatedEvent = await EventTicketService.updateEventPrivacySettings(
      eventId,
      validatedData,
    );

    res.status(200).json({
      success: true,
      message: 'Event privacy settings updated successfully',
      data: {
        eventId: updatedEvent._id,
        name: updatedEvent.name,
        privacyLevel: updatedEvent.privacyLevel,
        attendanceMode: updatedEvent.attendanceMode,
        eventType: updatedEvent.eventType,
        locationType: updatedEvent.locationType,
        location: updatedEvent.location,
        paymentPrivacy: updatedEvent.paymentPrivacy,
        offerReceipts: updatedEvent.offerReceipts,
        hasZkEmailUpdates: updatedEvent.hasZkEmailUpdates,
        hasEventReminders: updatedEvent.hasEventReminders,
        ticketTypes: updatedEvent.ticketType,
        totalTickets: updatedEvent.totalTickets,
        availableTickets: updatedEvent.availableTickets,
        isPublished: updatedEvent.isPublished,
        updatedAt: (updatedEvent as any).updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Error updating event privacy settings:', error);

    // Handle Zod validation errors
    if (error.errors) {
      return res.status(400).json({
        error: 'Validation failed',
        message: error.errors[0]?.message || 'Invalid request data',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to update event privacy settings',
    });
  }
};

/**
 * Gets a single event by ID
 * GET /api/event-tickets/:eventId
 */
export const getEventById: RequestHandler = async (req, res) => {
  try {
    const eventId = Array.isArray(req.params.eventId)
      ? req.params.eventId[0]
      : req.params.eventId;

    if (!eventId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Event ID is required',
      });
    }

    const event = await EventTicketService.getEventById(eventId);

    if (!event) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Event not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        eventId: event._id,
        name: event.name,
        about: event.about,
        price: event.price,
        privacyLevel: event.privacyLevel,
        attendanceMode: event.attendanceMode,
        eventCategory: event.eventCategory,
        organizedBy: event.organizedBy,
        eventDate: event.eventDate,
        location: event.location,
        locationType: event.locationType,
        ticketTypes: event.ticketType,
        totalTickets: event.totalTickets,
        availableTickets: event.availableTickets,
        soldTickets: event.soldTickets,
        eventStatus: event.eventStatus,
        imageUrl: event.imageUrl,
        tags: event.tags,
        isTrending: event.isTrending,
        eventType: event.eventType,
        paymentPrivacy: event.paymentPrivacy,
        offerReceipts: event.offerReceipts,
        hasZkEmailUpdates: event.hasZkEmailUpdates,
        hasEventReminders: event.hasEventReminders,
        isPublished: event.isPublished,
        createdAt: (event as any).createdAt,
        updatedAt: (event as any).updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Error fetching event:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to fetch event',
    });
  }
};

export const searchEventTickets: RequestHandler = async (req, res) => {
  try {
    // Extract search query and pagination parameters
    const query = ((req.query.q as string) || '').trim();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 8;

    const location = (req.query.location as string | undefined)?.trim();
    const privacyLevelQuery = req.query.privacyLevel as string | undefined;
    const paymentPrivacyQuery = req.query.paymentPrivacy as string | undefined;
    const eventTypeQuery = req.query.eventType as string | undefined;
    const isPublishedQuery = req.query.isPublished as string | undefined;
    const startDateQuery = req.query.startDate as string | undefined;
    const endDateQuery = req.query.endDate as string | undefined;

    const hasAnyFilter = Boolean(
      location ||
      privacyLevelQuery ||
      paymentPrivacyQuery ||
      eventTypeQuery ||
      isPublishedQuery ||
      startDateQuery ||
      endDateQuery,
    );

    // Validate search query or filter presence
    if (!query && !hasAnyFilter) {
      return res.status(400).json({
        error: 'Invalid query',
        message:
          'At least one search parameter is required (q or filters like location/date/privacy)',
      });
    }

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

    const parsedPrivacyLevel =
      privacyLevelQuery !== undefined
        ? parseInt(privacyLevelQuery, 10)
        : undefined;
    const parsedPaymentPrivacy =
      paymentPrivacyQuery !== undefined
        ? parseInt(paymentPrivacyQuery, 10)
        : undefined;
    const parsedEventType =
      eventTypeQuery !== undefined ? parseInt(eventTypeQuery, 10) : undefined;

    if (
      parsedPrivacyLevel !== undefined &&
      (Number.isNaN(parsedPrivacyLevel) ||
        ![0, 1, 2].includes(parsedPrivacyLevel))
    ) {
      return res.status(400).json({
        error: 'Invalid privacyLevel',
        message: 'privacyLevel must be one of: 0, 1, 2',
      });
    }

    if (
      parsedPaymentPrivacy !== undefined &&
      (Number.isNaN(parsedPaymentPrivacy) ||
        ![0, 1].includes(parsedPaymentPrivacy))
    ) {
      return res.status(400).json({
        error: 'Invalid paymentPrivacy',
        message: 'paymentPrivacy must be one of: 0, 1',
      });
    }

    if (
      parsedEventType !== undefined &&
      (Number.isNaN(parsedEventType) || ![0, 1].includes(parsedEventType))
    ) {
      return res.status(400).json({
        error: 'Invalid eventType',
        message: 'eventType must be one of: 0, 1',
      });
    }

    let parsedIsPublished: boolean | undefined;
    if (isPublishedQuery !== undefined) {
      if (!['true', 'false'].includes(isPublishedQuery.toLowerCase())) {
        return res.status(400).json({
          error: 'Invalid isPublished',
          message: 'isPublished must be either true or false',
        });
      }
      parsedIsPublished = isPublishedQuery.toLowerCase() === 'true';
    }

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateQuery) {
      startDate = new Date(startDateQuery);
      if (Number.isNaN(startDate.getTime())) {
        return res.status(400).json({
          error: 'Invalid startDate',
          message: 'startDate must be a valid ISO date',
        });
      }
    }

    if (endDateQuery) {
      endDate = new Date(endDateQuery);
      if (Number.isNaN(endDate.getTime())) {
        return res.status(400).json({
          error: 'Invalid endDate',
          message: 'endDate must be a valid ISO date',
        });
      }
    }

    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({
        error: 'Invalid date range',
        message: 'startDate cannot be after endDate',
      });
    }

    const filters = {
      ...(location ? { location } : {}),
      ...(parsedPrivacyLevel !== undefined
        ? { privacyLevel: parsedPrivacyLevel }
        : {}),
      ...(parsedPaymentPrivacy !== undefined
        ? { paymentPrivacy: parsedPaymentPrivacy }
        : {}),
      ...(parsedEventType !== undefined ? { eventType: parsedEventType } : {}),
      ...(parsedIsPublished !== undefined
        ? { isPublished: parsedIsPublished }
        : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    };

    // Fetch searched event tickets from service
    const result = await EventTicketService.searchEventTickets(
      query,
      page,
      limit,
      filters,
    );

    // Return success response
    res.status(200).json(result);
  } catch (error) {
    console.error('Error searching event tickets: ', error);

    // Return error response
    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to search event tickets',
    });
  }
};
