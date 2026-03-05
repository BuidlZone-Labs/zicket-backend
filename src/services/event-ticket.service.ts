import EventTicket, { IEventTicket } from '../models/event-ticket';

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
}
