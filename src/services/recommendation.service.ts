import EventTicket, { IEventTicket } from '../models/event-ticket';
import { EventTicketResponse } from './event-ticket.service';

/**
 * #84 — Privacy-Safe Event Recommendation Engine
 *
 * Signals used:   trending flag, soldTickets, location, category
 * Signals NOT used: user history, profile, behavioral data
 * No user profiling. No cross-request tracking.
 */

const MAX_LIMIT = 20;
const DEFAULT_LIMIT = 10;
const TRENDING_THRESHOLD = 50; // soldTickets count that qualifies as trending

export interface RecommendationResult {
  count: number;
  /**
   * Describes how the list was built — useful for debugging,
   * never expose this to end-users in production.
   */
  source: 'location+trending' | 'trending' | 'latest';
  tickets: EventTicketResponse[];
}

export class RecommendationService {
  // ─── Helpers (mirrors EventTicketService — keep in sync) ───────────────────

  private static escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private static mapPrivacyLevel(level: number): string {
    return (
      { 0: 'Anonymous', 1: 'Wallet-Required', 2: 'Verified Access' }[level] ??
      'Unknown'
    );
  }

  private static formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  }

  private static formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
  }

  private static getTimezoneString(date: Date): string {
    const offset = -date.getTimezoneOffset();
    const h = Math.floor(Math.abs(offset) / 60).toString().padStart(2, '0');
    const m = (Math.abs(offset) % 60).toString().padStart(2, '0');
    return `(UTC ${offset >= 0 ? '+' : '-'}${h}:${m})`;
  }

  private static toResponse(ticket: IEventTicket): EventTicketResponse {
    return {
      title: ticket.name,
      status: this.mapPrivacyLevel(ticket.privacyLevel),
      participantsCount: ticket.soldTickets,
      anonymityPercentage: '60%',
      date: this.formatDate(ticket.eventDate),
      time: this.formatTime(ticket.eventDate),
      timezone: this.getTimezoneString(ticket.eventDate),
      location: ticket.location,
      price: ticket.price,
      imageUrl: ticket.imageUrl,
    };
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns recommended events using only public, non-personal signals.
   *
   * @param location  Optional: city / area string from the request (e.g. from
   *                  IP geo-lookup done on the frontend — we never store it).
   * @param category  Optional: filter to a specific event category.
   * @param limit     How many events to return (capped at 20).
   */
  static async getRecommendations(
    location?: string,
    category?: string,
    limit: number = DEFAULT_LIMIT,
  ): Promise<RecommendationResult> {
    const validLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
    const now = new Date();

    // Base: only show upcoming, published events
    const baseFilter: Record<string, unknown> = {
      isPublished: true,
      eventDate: { $gte: now },
    };

    if (category?.trim()) {
      baseFilter.eventCategory = {
        $regex: new RegExp(`^${this.escapeRegex(category.trim())}$`, 'i'),
      };
    }

    let tickets: IEventTicket[] = [];
    let source: RecommendationResult['source'] = 'trending';

    // ── Step 1: location-biased trending events ──────────────────────────────
    if (location?.trim()) {
      const locationFilter = {
        ...baseFilter,
        location: {
          $regex: new RegExp(this.escapeRegex(location.trim()), 'i'),
        },
        $or: [{ isTrending: true }, { soldTickets: { $gt: 10 } }],
      };

      tickets = (await EventTicket.find(locationFilter)
        .sort({ isTrending: -1, soldTickets: -1, eventDate: 1 })
        .limit(validLimit)
        .lean()) as unknown as IEventTicket[];

      source = 'location+trending';
    }

    // ── Step 2: pad with global trending if not enough ───────────────────────
    if (tickets.length < validLimit) {
      const seen = new Set(tickets.map((t) => (t._id as any).toString()));

      const trendingFilter = {
        ...baseFilter,
        $or: [{ isTrending: true }, { soldTickets: { $gt: TRENDING_THRESHOLD } }],
      };

      const trending = (await EventTicket.find(trendingFilter)
        .sort({ soldTickets: -1, isTrending: -1, eventDate: 1 })
        .limit(validLimit * 2) // fetch extra to cover deduplication
        .lean()) as unknown as IEventTicket[];

      for (const t of trending) {
        if (tickets.length >= validLimit) break;
        const id = (t._id as any).toString();
        if (!seen.has(id)) {
          tickets.push(t);
          seen.add(id);
        }
      }

      if (source !== 'location+trending') source = 'trending';
    }

    // ── Step 3: absolute fallback — newest published events ──────────────────
    if (tickets.length === 0) {
      tickets = (await EventTicket.find(baseFilter)
        .sort({ eventDate: 1 })
        .limit(validLimit)
        .lean()) as unknown as IEventTicket[];

      source = 'latest';
    }

    return {
      count: tickets.length,
      source,
      tickets: tickets.map((t) => this.toResponse(t)),
    };
  }
}