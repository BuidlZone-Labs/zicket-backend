import { RequestHandler } from 'express';
import { EventTicketService } from '../services/event-ticket.service';

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

export const searchEventTickets: RequestHandler = async (req, res) => {
  try {
    // Extract search query and pagination parameters
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 8;

    // Validate search query
    if (!query || query.trim() === '') {
      return res.status(400).json({
        error: 'Invalid query',
        message: 'Search query parameter "q" is required',
      });
    }

    // Validate pagination parameters
    if (page < 1) {
      return res.status(400).json({
        error: 'Invalid page number',
        message: 'Page number must be greater than 0',
      });
    }

    // Fetch searched event tickets from service
    const result = await EventTicketService.searchEventTickets(
      query,
      page,
      limit,
    );

    // Return success response
    res.status(200).json(result);
  } catch (error) {
    console.error('Error searching event tickets: ', error);

    // Return error response
    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error ? error.message : 'Failed to search event tickets',
    });
  }
};
