import { searchEventTickets } from '../src/controllers/event-ticket.controller';
import { EventTicketService } from '../src/services/event-ticket.service';

jest.mock('../src/services/event-ticket.service', () => ({
    EventTicketService: {
        searchEventTickets: jest.fn(),
    },
}));

describe('event-ticket controller search', () => {
    const eventTicketService = EventTicketService as unknown as {
        searchEventTickets: jest.Mock;
    };

    const createResponse = () => {
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        return res;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns 400 when search query q is missing', async () => {
        const req = {
            query: {},
        };
        const res = createResponse();

        await searchEventTickets(req as any, res as any, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Invalid query',
            message: 'Search query parameter "q" is required',
        });
    });

    it('returns 400 for invalid page number', async () => {
        const req = {
            query: {
                q: 'hackathon',
                page: '-1',
            },
        };
        const res = createResponse();

        await searchEventTickets(req as any, res as any, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Invalid page number',
            message: 'Page number must be greater than 0',
        });
    });

    it('calls service and returns 200 for valid search request', async () => {
        const req = {
            query: {
                q: 'web3',
                page: '1',
                limit: '5',
            },
        };
        const res = createResponse();

        const serviceResult = {
            page: 1,
            limit: 5,
            total: 1,
            tickets: [
                {
                    title: 'Web3 Builders Meetup',
                    status: 'Wallet-Required',
                    participantsCount: 50,
                    anonymityPercentage: '60%',
                    date: 'Oct 15, 2026',
                    time: '6 PM',
                    timezone: '(UTC +01:00)',
                    location: 'Lagos',
                    price: 0,
                    imageUrl: 'https://example.com/image.jpg',
                },
            ],
        };

        eventTicketService.searchEventTickets.mockResolvedValue(serviceResult);

        await searchEventTickets(req as any, res as any, jest.fn());

        expect(eventTicketService.searchEventTickets).toHaveBeenCalledWith('web3', 1, 5);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(serviceResult);
    });

    it('returns 500 when service throws an error', async () => {
        const req = {
            query: { q: 'error' },
        };
        const res = createResponse();

        eventTicketService.searchEventTickets.mockRejectedValue(new Error('service failure'));

        await searchEventTickets(req as any, res as any, jest.fn());

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Internal server error',
            message: 'service failure',
        });
    });
});
