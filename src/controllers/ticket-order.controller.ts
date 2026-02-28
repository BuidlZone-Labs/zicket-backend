import { Response } from 'express';
import { UserAuthenticatedReq } from '../utils/types';
import { TicketOrderService } from '../services/ticket-order.service';

/**
 * GET /ticket-orders/me – current user's ticket orders (buyer view)
 */
export const getMyOrders = async (
  req: UserAuthenticatedReq,
  res: Response,
): Promise<void> => {
  try {
    const userId =
      (req.user as any)?._id?.toString() ?? (req.user as any)?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await TicketOrderService.getOrdersForUser(
      String(userId),
      page,
      limit,
    );
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching user ticket orders:', error);
    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to fetch ticket orders',
    });
  }
};

/**
 * GET /ticket-orders/organizer – ticket orders for events organized by current user
 */
export const getOrganizerOrders = async (
  req: UserAuthenticatedReq,
  res: Response,
): Promise<void> => {
  try {
    const organizerId =
      (req.user as any)?._id?.toString() ?? (req.user as any)?.id;
    if (!organizerId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await TicketOrderService.getOrdersForOrganizer(
      String(organizerId),
      page,
      limit,
    );
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching organizer ticket orders:', error);
    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to fetch organizer ticket orders',
    });
  }
};
