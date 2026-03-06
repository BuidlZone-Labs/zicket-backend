import { RequestHandler } from 'express';
import { EventTicketService } from '../services/event-ticket.service';

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
