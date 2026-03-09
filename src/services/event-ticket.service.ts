import EventTicket, { IEventTicket } from '../models/event-ticket';
import { CreateEventStepTwoInput } from '../validators/event.validator';

export interface EventTicketResponse {
  title: string;
  status: string;
  participantsCount: number;
  anonymityPercentage: string;
  date: string;
  time: string;
  timezone: string;
  location: string;
  price: number;
  imageUrl: string;
}

export interface PaginatedEventTicketsResponse {
  page: number;
  limit: number;
  total: number;
  tickets: EventTicketResponse[];
}

export class EventTicketService {
  private static readonly DEFAULT_LIMIT = 8;

  /**
   * Maps privacy level to status string
   */
  private static mapPrivacyLevelToStatus(privacyLevel: number): string {
    switch (privacyLevel) {
      case 0:
        return 'Anonymous';
      case 1:
        return 'Wallet-Required';
      case 2:
        return 'Verified Access';
      default:
        return 'Unknown';
    }
  }

  /**
   * Formats date to the required format
   */
  private static formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  }

  /**
   * Formats time to the required format
   */
  private static formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true,
    });
  }

  /**
   * Gets timezone offset string
   */
  private static getTimezoneString(date: Date): string {
    const offset = -date.getTimezoneOffset();
    const hours = Math.floor(Math.abs(offset) / 60);
    const minutes = Math.abs(offset) % 60;
    const sign = offset >= 0 ? '+' : '-';
    return `(UTC ${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')})`;
  }

  /**
   * Transforms event ticket document to response format
   */
  private static transformEventTicket(
    ticket: IEventTicket,
  ): EventTicketResponse {
    return {
      title: ticket.name,
      status: this.mapPrivacyLevelToStatus(ticket.privacyLevel),
      participantsCount: ticket.soldTickets,
      anonymityPercentage: '60%', // This seems to be a static value based on the reference
      date: this.formatDate(ticket.eventDate),
      time: this.formatTime(ticket.eventDate),
      timezone: this.getTimezoneString(ticket.eventDate),
      location: ticket.location,
      price: ticket.price,
      imageUrl: ticket.imageUrl,
    };
  }

  /**
   * Fetches event tickets by category with pagination
   */
  static async getEventTicketsByCategory(
    category: string,
    page: number = 1,
    limit: number = this.DEFAULT_LIMIT,
  ): Promise<PaginatedEventTicketsResponse> {
    try {
      // Validate pagination parameters
      const validPage = Math.max(1, page);
      const validLimit = Math.min(Math.max(1, limit), 50); // Cap at 50 for performance

      // Calculate skip value
      const skip = (validPage - 1) * validLimit;

      // Create case-insensitive filter for category
      const filter = {
        eventCategory: { $regex: new RegExp(`^${category}$`, 'i') },
      };

      // Get tickets and total count
      const [tickets, total] = await Promise.all([
        EventTicket.find(filter)
          .sort({ eventDate: 1 }) // Sort by event date
          .skip(skip)
          .limit(validLimit)
          .lean(),
        EventTicket.countDocuments(filter),
      ]);

      // Transform tickets to response format
      const transformedTickets = tickets.map((ticket) =>
        this.transformEventTicket(ticket as unknown as IEventTicket),
      );

      return {
        page: validPage,
        limit: validLimit,
        total,
        tickets: transformedTickets,
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch event tickets by category: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Fetches event tickets with pagination
   */
  static async getEventTickets(
    page: number = 1,
    limit: number = this.DEFAULT_LIMIT,
  ): Promise<PaginatedEventTicketsResponse> {
    try {
      // Validate pagination parameters
      const validPage = Math.max(1, page);
      const validLimit = Math.min(Math.max(1, limit), 50); // Cap at 50 for performance

      // Calculate skip value
      const skip = (validPage - 1) * validLimit;

      // Get total count
      const total = await EventTicket.countDocuments();

      // Fetch tickets with pagination
      const tickets = await EventTicket.find()
        .sort({ createdAt: -1 }) // Sort by newest first
        .skip(skip)
        .limit(validLimit)
        .lean(); // Use lean() for better performance

      // Transform tickets to response format
      const transformedTickets = tickets.map((ticket) =>
        this.transformEventTicket(ticket as unknown as IEventTicket),
      );

      return {
        page: validPage,
        limit: validLimit,
        total,
        tickets: transformedTickets,
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch event tickets: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Fetches trending event tickets
   */
  static async getTrendingEventTickets(): Promise<{
    count: number;
    tickets: EventTicketResponse[];
  }> {
    try {
      // Trending logic: isTrending is true OR soldTickets > 100
      const filter = {
        $or: [{ isTrending: true }, { soldTickets: { $gt: 100 } }],
      };

      // Fetch trending tickets
      const tickets = await EventTicket.find(filter)
        .sort({ soldTickets: -1, updatedAt: -1 }) // Sort by popularity then freshness
        .limit(5)
        .lean();

      // Transform tickets to response format
      const transformedTickets = tickets.map((ticket) =>
        this.transformEventTicket(ticket as unknown as IEventTicket),
      );

      return {
        count: transformedTickets.length,
        tickets: transformedTickets,
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch trending event tickets: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Maps privacy level number to attendance mode string
   */
  private static mapPrivacyLevelToAttendanceMode(
    privacyLevel: number,
  ): string {
    switch (privacyLevel) {
      case 0:
        return 'anonymous';
      case 1:
        return 'wallet-required';
      case 2:
        return 'verified-access';
      default:
        return 'wallet-required';
    }
  }

  /**
   * Creates a new event with step 2 data (privacy settings)
   */
  static async createEventWithPrivacySettings(
    eventData: CreateEventStepTwoInput & {
      name: string;
      about: string;
      price: number;
      eventCategory: string;
      organizedBy: string;
      eventDate: Date;
      imageUrl: string;
      cloudinary_public_id?: string;
      tags: string[];
    },
  ): Promise<IEventTicket> {
    try {
      const {
        privacyLevel,
        eventType,
        locationType,
        location,
        paymentPrivacy,
        offerReceipts,
        hasZkEmailUpdates,
        hasEventReminders,
        ticketTypes,
        isPublished,
        attendanceMode,
        ...baseEventData
      } = eventData;

      // Calculate total tickets from ticket types
      const totalTickets = ticketTypes.reduce(
        (sum, ticket) => sum + ticket.quantity,
        0,
      );

      // Map attendance mode from privacy level if not provided
      const mappedAttendanceMode =
        attendanceMode ||
        this.mapPrivacyLevelToAttendanceMode(privacyLevel);

      // Create the event with all privacy settings
      const event = await EventTicket.create({
        ...baseEventData,
        privacyLevel,
        attendanceMode: mappedAttendanceMode,
        eventType,
        locationType,
        location,
        paymentPrivacy,
        offerReceipts,
        hasZkEmailUpdates,
        hasEventReminders,
        ticketType: ticketTypes,
        totalTickets,
        availableTickets: totalTickets,
        soldTickets: 0,
        isPublished,
      });

      return event;
    } catch (error) {
      throw new Error(
        `Failed to create event with privacy settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Updates an existing event with step 2 data (privacy settings)
   */
  static async updateEventPrivacySettings(
    eventId: string,
    eventData: Partial<CreateEventStepTwoInput>,
  ): Promise<IEventTicket> {
    try {
      const updateData: any = {};

      // Map fields from step 2 input to model fields
      if (eventData.privacyLevel !== undefined) {
        updateData.privacyLevel = eventData.privacyLevel;
        updateData.attendanceMode = this.mapPrivacyLevelToAttendanceMode(
          eventData.privacyLevel,
        );
      }

      if (eventData.eventType !== undefined) {
        updateData.eventType = eventData.eventType;
      }

      if (eventData.locationType !== undefined) {
        updateData.locationType = eventData.locationType;
      }

      if (eventData.location !== undefined) {
        updateData.location = eventData.location;
      }

      if (eventData.paymentPrivacy !== undefined) {
        updateData.paymentPrivacy = eventData.paymentPrivacy;
      }

      if (eventData.offerReceipts !== undefined) {
        updateData.offerReceipts = eventData.offerReceipts;
      }

      if (eventData.hasZkEmailUpdates !== undefined) {
        updateData.hasZkEmailUpdates = eventData.hasZkEmailUpdates;
      }

      if (eventData.hasEventReminders !== undefined) {
        updateData.hasEventReminders = eventData.hasEventReminders;
      }

      if (eventData.ticketTypes && eventData.ticketTypes.length > 0) {
        updateData.ticketType = eventData.ticketTypes;
        
        // Recalculate total tickets
        const totalTickets = eventData.ticketTypes.reduce(
          (sum, ticket) => sum + ticket.quantity,
          0,
        );
        updateData.totalTickets = totalTickets;
        
        // Reset available tickets based on new total minus sold
        const existingEvent = await EventTicket.findById(eventId);
        if (existingEvent) {
          updateData.availableTickets = Math.max(
            0,
            totalTickets - existingEvent.soldTickets,
          );
        }
      }

      if (eventData.isPublished !== undefined) {
        updateData.isPublished = eventData.isPublished;
      }

      const updatedEvent = await EventTicket.findByIdAndUpdate(
        eventId,
        { $set: updateData },
        { new: true, runValidators: true },
      );

      if (!updatedEvent) {
        throw new Error('Event not found');
      }

      return updatedEvent;
    } catch (error) {
      throw new Error(
        `Failed to update event privacy settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Gets a single event by ID
   */
  static async getEventById(eventId: string): Promise<any | null> {
    try {
      const event = await EventTicket.findById(eventId);
      return event;
    } catch (error) {
      throw new Error(
        `Failed to fetch event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
  /**
   * Searches for event tickets based on a query string
   */
  static async searchEventTickets(
    query: string,
    page: number = 1,
    limit: number = this.DEFAULT_LIMIT,
  ): Promise<PaginatedEventTicketsResponse> {
    try {
      // Validate pagination parameters
      const validPage = Math.max(1, page);
      const validLimit = Math.min(Math.max(1, limit), 50);

      // Calculate skip value
      const skip = (validPage - 1) * validLimit;

      // Create search filter
      // Search in name, about, location, tags, and category
      const searchRegex = new RegExp(query, 'i');
      const filter = {
        $or: [
          { name: { $regex: searchRegex } },
          { about: { $regex: searchRegex } },
          { location: { $regex: searchRegex } },
          { eventCategory: { $regex: searchRegex } },
          { tags: { $in: [searchRegex] } },
        ],
      };

      // Get tickets and total count
      const [tickets, total] = await Promise.all([
        EventTicket.find(filter)
          .sort({ eventDate: 1 })
          .skip(skip)
          .limit(validLimit)
          .lean(),
        EventTicket.countDocuments(filter),
      ]);

      // Transform tickets to response format
      const transformedTickets = tickets.map((ticket) =>
        this.transformEventTicket(ticket as unknown as IEventTicket),
      );

      return {
        page: validPage,
        limit: validLimit,
        total,
        tickets: transformedTickets,
      };
    } catch (error) {
      throw new Error(
        `Failed to search event tickets: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
