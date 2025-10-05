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
                message: 'Page number must be greater than 0'
            });
        }

        if (limit < 1 || limit > 50) {
            return res.status(400).json({
                error: 'Invalid limit',
                message: 'Limit must be between 1 and 50'
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
            message: error instanceof Error ? error.message : 'Failed to fetch event tickets'
        });
    }
};
