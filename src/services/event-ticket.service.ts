import EventTicket, {
  IEventTicket,
  PrivacyLevel,
  EventType,
  LocationType,
  PaymentPrivacy,
  AttendanceMode,
  ITicketType,
} from '../models/event-ticket';

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

// Privacy settings payload for creating/updating event tickets
export interface EventTicketPrivacyPayload {
  privacyLevel: PrivacyLevel;
  attendanceMode: AttendanceMode;
  eventType: EventType;
  locationType: LocationType;
  paymentPrivacy: PaymentPrivacy;
  offerReceipts: boolean;
  hasZkEmailUpdates: boolean;
  hasEventReminders: boolean;
  ticketType: ITicketType[];
  isPublished: boolean;
}

// Complete payload for creating event ticket
export interface CreateEventTicketPayload extends EventTicketPrivacyPayload {
  name: string;
  about: string;
  price: number;
  eventCategory: string;
  organizedBy: string;
  eventDate: string;
  location: string;
  totalTickets: number;
  imageUrl: string;
  tags?: string[];
}

export class EventTicketService {
  private static readonly DEFAULT_LIMIT = 8;

  /**
   * Maps privacy level to status string
   */
  private static mapPrivacyLevelToStatus(privacyLevel: PrivacyLevel): string {
    switch (privacyLevel) {
      case PrivacyLevel.ANONYMOUS:
        return 'Anonymous';
      case PrivacyLevel.WALLET_REQUIRED:
        return 'Wallet-Required';
      case PrivacyLevel.VERIFIED_ACCESS:
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
   * Validates privacy settings business rules
   */
  private static validatePrivacySettings(payload: EventTicketPrivacyPayload): void {
    // Rule: PAID events require privacyLevel to be wallet-required
    if (
      payload.eventType === EventType.PAID &&
      payload.privacyLevel !== PrivacyLevel.WALLET_REQUIRED
    ) {
      throw new Error(
        'PAID events require privacy level to be wallet-required',
      );
    }

    // Validate ticket types
    if (!payload.ticketType || payload.ticketType.length === 0) {
      throw new Error('At least one ticket type is required');
    }

    // Validate each ticket type
    payload.ticketType.forEach((ticket, index) => {
      if (!ticket.ticketName || ticket.ticketName.trim() === '') {
        throw new Error(`Ticket type at index ${index} must have a valid name`);
      }
      if (ticket.quantity < 0) {
        throw new Error(
          `Ticket type "${ticket.ticketName}" must have a non-negative quantity`,
        );
      }
      if (ticket.price < 0) {
        throw new Error(
          `Ticket type "${ticket.ticketName}" must have a non-negative price`,
        );
      }
      if (!ticket.currencyOrToken || ticket.currencyOrToken.trim() === '') {
        throw new Error(
          `Ticket type "${ticket.ticketName}" must have a valid currency or token`,
        );
      }
    });

    // If eventType is FREE, ensure all ticket prices are 0
    if (payload.eventType === EventType.FREE) {
      const hasPaidTickets = payload.ticketType.some(
        (ticket) => ticket.price > 0,
      );
      if (hasPaidTickets) {
        throw new Error('FREE events cannot have tickets with price > 0');
      }
    }

    // If eventType is PAID, ensure at least one ticket has price > 0
    if (payload.eventType === EventType.PAID) {
      const hasPaidTickets = payload.ticketType.some(
        (ticket) => ticket.price > 0,
      );
      if (!hasPaidTickets) {
        throw new Error('PAID events must have at least one ticket with price > 0');
      }
    }
  }

  /**
   * Creates a new event ticket with privacy settings
   */
  static async createEventTicket(
    payload: CreateEventTicketPayload,
  ): Promise<IEventTicket> {
    try {
      // Validate privacy settings
      this.validatePrivacySettings(payload);

      // Calculate total tickets from ticket types
      const totalTickets = payload.ticketType.reduce(
        (sum, ticket) => sum + ticket.quantity,
        0,
      );

      // Create the event ticket
      const eventTicket = await EventTicket.create({
        name: payload.name,
        about: payload.about,
        price: payload.price,
        privacyLevel: payload.privacyLevel,
        attendanceMode: payload.attendanceMode,
        eventType: payload.eventType,
        eventCategory: payload.eventCategory,
        organizedBy: payload.organizedBy,
        eventDate: new Date(payload.eventDate),
        location: payload.location,
        locationType: payload.locationType,
        paymentPrivacy: payload.paymentPrivacy,
        offerReceipts: payload.offerReceipts,
        hasZkEmailUpdates: payload.hasZkEmailUpdates,
        hasEventReminders: payload.hasEventReminders,
        ticketType: payload.ticketType,
        isPublished: payload.isPublished,
        totalTickets: totalTickets,
        availableTickets: totalTickets,
        soldTickets: 0,
        imageUrl: payload.imageUrl,
        tags: payload.tags || [],
        eventStatus: 'upcoming',
        isTrending: false,
      });

      return eventTicket;
    } catch (error) {
      throw new Error(
        `Failed to create event ticket: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Updates event ticket privacy settings
   */
  static async updateEventTicketPrivacy(
    ticketId: string,
    payload: Partial<EventTicketPrivacyPayload>,
  ): Promise<IEventTicket | null> {
    try {
      const ticket = await EventTicket.findById(ticketId);

      if (!ticket) {
        return null;
      }

      // If updating privacy settings, validate the complete set
      if (payload.privacyLevel || payload.eventType || payload.ticketType) {
        const updatedSettings: EventTicketPrivacyPayload = {
          privacyLevel: payload.privacyLevel || ticket.privacyLevel,
          attendanceMode: payload.attendanceMode || ticket.attendanceMode,
          eventType: payload.eventType || ticket.eventType,
          locationType: payload.locationType || ticket.locationType,
          paymentPrivacy: payload.paymentPrivacy || ticket.paymentPrivacy,
          offerReceipts:
            payload.offerReceipts !== undefined
              ? payload.offerReceipts
              : ticket.offerReceipts,
          hasZkEmailUpdates:
            payload.hasZkEmailUpdates !== undefined
              ? payload.hasZkEmailUpdates
              : ticket.hasZkEmailUpdates,
          hasEventReminders:
            payload.hasEventReminders !== undefined
              ? payload.hasEventReminders
              : ticket.hasEventReminders,
          ticketType: payload.ticketType || ticket.ticketType,
          isPublished:
            payload.isPublished !== undefined
              ? payload.isPublished
              : ticket.isPublished,
        };

        // Validate the updated settings
        this.validatePrivacySettings(updatedSettings);
      }

      // Update fields
      if (payload.privacyLevel !== undefined)
        ticket.privacyLevel = payload.privacyLevel;
      if (payload.attendanceMode !== undefined)
        ticket.attendanceMode = payload.attendanceMode;
      if (payload.eventType !== undefined) ticket.eventType = payload.eventType;
      if (payload.locationType !== undefined)
        ticket.locationType = payload.locationType;
      if (payload.paymentPrivacy !== undefined)
        ticket.paymentPrivacy = payload.paymentPrivacy;
      if (payload.offerReceipts !== undefined)
        ticket.offerReceipts = payload.offerReceipts;
      if (payload.hasZkEmailUpdates !== undefined)
        ticket.hasZkEmailUpdates = payload.hasZkEmailUpdates;
      if (payload.hasEventReminders !== undefined)
        ticket.hasEventReminders = payload.hasEventReminders;
      if (payload.isPublished !== undefined)
        ticket.isPublished = payload.isPublished;

      // Update ticket types and recalculate totals if provided
      if (payload.ticketType !== undefined) {
        ticket.ticketType = payload.ticketType;
        const totalTickets = payload.ticketType.reduce(
          (sum, t) => sum + t.quantity,
          0,
        );
        ticket.totalTickets = totalTickets;
        ticket.availableTickets = totalTickets - ticket.soldTickets;
      }

      await ticket.save();
      return ticket;
    } catch (error) {
      throw new Error(
        `Failed to update event ticket: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
