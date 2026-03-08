import { RequestHandler } from 'express';
import mongoose from 'mongoose';
import {
  EventTicketService,
  CreateEventTicketPayload,
  EventTicketPrivacyPayload,
} from '../services/event-ticket.service';
import {
  PrivacyLevel,
  EventType,
  LocationType,
  PaymentPrivacy,
  AttendanceMode,
  ITicketType,
} from '../models/event-ticket';

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

/**
 * Validates the privacy settings payload for creating/updating event tickets
 */
function validatePrivacySettingsPayload(
  body: unknown,
):
  | { valid: false; error: string }
  | { valid: true; payload: EventTicketPrivacyPayload } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const b = body as Record<string, unknown>;

  // Validate privacyLevel
  if (
    !b.privacyLevel ||
    !Object.values(PrivacyLevel).includes(b.privacyLevel as PrivacyLevel)
  ) {
    return {
      valid: false,
      error: `privacyLevel must be one of: ${Object.values(PrivacyLevel).join(', ')}`,
    };
  }

  // Validate attendanceMode
  if (
    !b.attendanceMode ||
    !Object.values(AttendanceMode).includes(b.attendanceMode as AttendanceMode)
  ) {
    return {
      valid: false,
      error: `attendanceMode must be one of: ${Object.values(AttendanceMode).join(', ')}`,
    };
  }

  // Validate eventType
  if (
    !b.eventType ||
    !Object.values(EventType).includes(b.eventType as EventType)
  ) {
    return {
      valid: false,
      error: `eventType must be one of: ${Object.values(EventType).join(', ')}`,
    };
  }

  // Validate locationType
  if (
    !b.locationType ||
    !Object.values(LocationType).includes(b.locationType as LocationType)
  ) {
    return {
      valid: false,
      error: `locationType must be one of: ${Object.values(LocationType).join(', ')}`,
    };
  }

  // Validate paymentPrivacy
  if (
    !b.paymentPrivacy ||
    !Object.values(PaymentPrivacy).includes(b.paymentPrivacy as PaymentPrivacy)
  ) {
    return {
      valid: false,
      error: `paymentPrivacy must be one of: ${Object.values(PaymentPrivacy).join(', ')}`,
    };
  }

  // Validate boolean fields
  if (typeof b.offerReceipts !== 'boolean') {
    return {
      valid: false,
      error: 'offerReceipts must be a boolean',
    };
  }

  if (typeof b.hasZkEmailUpdates !== 'boolean') {
    return {
      valid: false,
      error: 'hasZkEmailUpdates must be a boolean',
    };
  }

  if (typeof b.hasEventReminders !== 'boolean') {
    return {
      valid: false,
      error: 'hasEventReminders must be a boolean',
    };
  }

  if (typeof b.isPublished !== 'boolean') {
    return {
      valid: false,
      error: 'isPublished must be a boolean',
    };
  }

  // Validate ticketType array
  if (!Array.isArray(b.ticketType)) {
    return {
      valid: false,
      error: 'ticketType must be an array',
    };
  }

  if (b.ticketType.length === 0) {
    return {
      valid: false,
      error: 'ticketType must contain at least one ticket',
    };
  }

  // Validate each ticket type
  for (let i = 0; i < b.ticketType.length; i++) {
    const ticket = b.ticketType[i] as Record<string, unknown>;

    if (!ticket || typeof ticket !== 'object') {
      return {
        valid: false,
        error: `Ticket at index ${i} must be an object`,
      };
    }

    if (
      typeof ticket.ticketName !== 'string' ||
      ticket.ticketName.trim() === ''
    ) {
      return {
        valid: false,
        error: `Ticket at index ${i} must have a valid ticketName`,
      };
    }

    if (typeof ticket.quantity !== 'number' || ticket.quantity < 0) {
      return {
        valid: false,
        error: `Ticket at index ${i} must have a non-negative quantity`,
      };
    }

    if (
      typeof ticket.currencyOrToken !== 'string' ||
      ticket.currencyOrToken.trim() === ''
    ) {
      return {
        valid: false,
        error: `Ticket at index ${i} must have a valid currencyOrToken`,
      };
    }

    if (typeof ticket.price !== 'number' || ticket.price < 0) {
      return {
        valid: false,
        error: `Ticket at index ${i} must have a non-negative price`,
      };
    }
  }

  const payload: EventTicketPrivacyPayload = {
    privacyLevel: b.privacyLevel as PrivacyLevel,
    attendanceMode: b.attendanceMode as AttendanceMode,
    eventType: b.eventType as EventType,
    locationType: b.locationType as LocationType,
    paymentPrivacy: b.paymentPrivacy as PaymentPrivacy,
    offerReceipts: b.offerReceipts as boolean,
    hasZkEmailUpdates: b.hasZkEmailUpdates as boolean,
    hasEventReminders: b.hasEventReminders as boolean,
    ticketType: b.ticketType as ITicketType[],
    isPublished: b.isPublished as boolean,
  };

  return { valid: true, payload };
}

/**
 * Validates the complete event ticket creation payload
 */
function validateCreateEventTicketPayload(
  body: unknown,
):
  | { valid: false; error: string }
  | { valid: true; payload: CreateEventTicketPayload } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const b = body as Record<string, unknown>;

  // Validate basic fields
  if (typeof b.name !== 'string' || b.name.trim() === '') {
    return {
      valid: false,
      error: 'name is required and must be a non-empty string',
    };
  }

  if (typeof b.about !== 'string' || b.about.trim() === '') {
    return {
      valid: false,
      error: 'about is required and must be a non-empty string',
    };
  }

  if (typeof b.price !== 'number' || b.price < 0) {
    return {
      valid: false,
      error: 'price is required and must be a non-negative number',
    };
  }

  if (typeof b.eventCategory !== 'string' || b.eventCategory.trim() === '') {
    return {
      valid: false,
      error: 'eventCategory is required and must be a non-empty string',
    };
  }

  if (
    typeof b.organizedBy !== 'string' ||
    !mongoose.Types.ObjectId.isValid(b.organizedBy)
  ) {
    return {
      valid: false,
      error: 'organizedBy is required and must be a valid ObjectId',
    };
  }

  if (typeof b.eventDate !== 'string') {
    return {
      valid: false,
      error: 'eventDate is required and must be a valid ISO date string',
    };
  }

  const eventDate = new Date(b.eventDate);
  if (Number.isNaN(eventDate.getTime())) {
    return {
      valid: false,
      error: 'eventDate must be a valid date',
    };
  }

  if (typeof b.location !== 'string' || b.location.trim() === '') {
    return {
      valid: false,
      error: 'location is required and must be a non-empty string',
    };
  }

  if (typeof b.totalTickets !== 'number' || b.totalTickets < 0) {
    return {
      valid: false,
      error: 'totalTickets is required and must be a non-negative number',
    };
  }

  if (typeof b.imageUrl !== 'string' || b.imageUrl.trim() === '') {
    return {
      valid: false,
      error: 'imageUrl is required and must be a non-empty string',
    };
  }

  // Validate tags if provided
  if (b.tags !== undefined) {
    if (!Array.isArray(b.tags)) {
      return {
        valid: false,
        error: 'tags must be an array if provided',
      };
    }
    if (!b.tags.every((tag: unknown) => typeof tag === 'string')) {
      return {
        valid: false,
        error: 'tags must contain only strings',
      };
    }
  }

  // Validate privacy settings
  const privacyValidation = validatePrivacySettingsPayload(body);
  if (!privacyValidation.valid) {
    return privacyValidation;
  }

  const payload: CreateEventTicketPayload = {
    name: b.name.trim(),
    about: b.about.trim(),
    price: b.price as number,
    eventCategory: b.eventCategory.trim(),
    organizedBy: b.organizedBy as string,
    eventDate: b.eventDate as string,
    location: b.location.trim(),
    totalTickets: b.totalTickets as number,
    imageUrl: b.imageUrl.trim(),
    tags: b.tags as string[] | undefined,
    ...privacyValidation.payload,
  };

  return { valid: true, payload };
}

/**
 * Creates a new event ticket with privacy settings
 */
export const createEventTicket: RequestHandler = async (req, res) => {
  const validation = validateCreateEventTicketPayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      error: 'Validation error',
      message: validation.error,
    });
  }

  try {
    const ticket = await EventTicketService.createEventTicket(
      validation.payload,
    );
    return res.status(201).json({
      message: 'Event ticket created successfully',
      ticket,
    });
  } catch (error) {
    console.error('Error creating event ticket:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to create event ticket',
    });
  }
};

/**
 * Updates event ticket privacy settings
 */
export const updateEventTicketPrivacy: RequestHandler = async (req, res) => {
  try {
    const rawTicketId = req.params.ticketId;
    const ticketId =
      typeof rawTicketId === 'string'
        ? rawTicketId
        : Array.isArray(rawTicketId)
          ? rawTicketId[0]
          : '';

    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({
        error: 'Invalid ticket ID',
        message: 'Ticket ID must be a valid 24-character hex string',
      });
    }

    // Validate privacy settings if provided
    const body = req.body as Record<string, unknown>;
    const payload: Partial<EventTicketPrivacyPayload> = {};

    // Validate each field if provided
    if (body.privacyLevel !== undefined) {
      if (
        !Object.values(PrivacyLevel).includes(body.privacyLevel as PrivacyLevel)
      ) {
        return res.status(400).json({
          error: 'Invalid privacyLevel',
          message: `privacyLevel must be one of: ${Object.values(PrivacyLevel).join(', ')}`,
        });
      }
      payload.privacyLevel = body.privacyLevel as PrivacyLevel;
    }

    if (body.attendanceMode !== undefined) {
      if (
        !Object.values(AttendanceMode).includes(
          body.attendanceMode as AttendanceMode,
        )
      ) {
        return res.status(400).json({
          error: 'Invalid attendanceMode',
          message: `attendanceMode must be one of: ${Object.values(AttendanceMode).join(', ')}`,
        });
      }
      payload.attendanceMode = body.attendanceMode as AttendanceMode;
    }

    if (body.eventType !== undefined) {
      if (!Object.values(EventType).includes(body.eventType as EventType)) {
        return res.status(400).json({
          error: 'Invalid eventType',
          message: `eventType must be one of: ${Object.values(EventType).join(', ')}`,
        });
      }
      payload.eventType = body.eventType as EventType;
    }

    if (body.locationType !== undefined) {
      if (
        !Object.values(LocationType).includes(body.locationType as LocationType)
      ) {
        return res.status(400).json({
          error: 'Invalid locationType',
          message: `locationType must be one of: ${Object.values(LocationType).join(', ')}`,
        });
      }
      payload.locationType = body.locationType as LocationType;
    }

    if (body.paymentPrivacy !== undefined) {
      if (
        !Object.values(PaymentPrivacy).includes(
          body.paymentPrivacy as PaymentPrivacy,
        )
      ) {
        return res.status(400).json({
          error: 'Invalid paymentPrivacy',
          message: `paymentPrivacy must be one of: ${Object.values(PaymentPrivacy).join(', ')}`,
        });
      }
      payload.paymentPrivacy = body.paymentPrivacy as PaymentPrivacy;
    }

    if (body.offerReceipts !== undefined) {
      if (typeof body.offerReceipts !== 'boolean') {
        return res.status(400).json({
          error: 'Invalid offerReceipts',
          message: 'offerReceipts must be a boolean',
        });
      }
      payload.offerReceipts = body.offerReceipts as boolean;
    }

    if (body.hasZkEmailUpdates !== undefined) {
      if (typeof body.hasZkEmailUpdates !== 'boolean') {
        return res.status(400).json({
          error: 'Invalid hasZkEmailUpdates',
          message: 'hasZkEmailUpdates must be a boolean',
        });
      }
      payload.hasZkEmailUpdates = body.hasZkEmailUpdates as boolean;
    }

    if (body.hasEventReminders !== undefined) {
      if (typeof body.hasEventReminders !== 'boolean') {
        return res.status(400).json({
          error: 'Invalid hasEventReminders',
          message: 'hasEventReminders must be a boolean',
        });
      }
      payload.hasEventReminders = body.hasEventReminders as boolean;
    }

    if (body.isPublished !== undefined) {
      if (typeof body.isPublished !== 'boolean') {
        return res.status(400).json({
          error: 'Invalid isPublished',
          message: 'isPublished must be a boolean',
        });
      }
      payload.isPublished = body.isPublished as boolean;
    }

    if (body.ticketType !== undefined) {
      if (!Array.isArray(body.ticketType)) {
        return res.status(400).json({
          error: 'Invalid ticketType',
          message: 'ticketType must be an array',
        });
      }
      payload.ticketType = body.ticketType as ITicketType[];
    }

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({
        error: 'Invalid payload',
        message: 'At least one field must be provided for update',
      });
    }

    const ticket = await EventTicketService.updateEventTicketPrivacy(
      ticketId,
      payload,
    );

    if (!ticket) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Event ticket not found',
      });
    }

    return res.status(200).json({
      message: 'Event ticket privacy settings updated successfully',
      ticket,
    });
  } catch (error) {
    console.error('Error updating event ticket privacy:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to update event ticket privacy settings',
    });
  }
};
