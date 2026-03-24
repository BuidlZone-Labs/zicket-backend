import { getUserOrders, getOrganizerOrders } from '../src/controllers/ticket-order.controller';
import { TicketOrderService } from '../src/services/ticket-order.service';

jest.mock('../src/services/ticket-order.service', () => ({
  TicketOrderService: {
    getUserOrders: jest.fn(),
    getOrganizerOrders: jest.fn(),
  },
}));

describe('TicketOrder controller', () => {
  const ticketOrderService = TicketOrderService as unknown as {
    getUserOrders: jest.Mock;
    getOrganizerOrders: jest.Mock;
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
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getUserOrders', () => {
    it('returns 401 when user is not authenticated', async () => {
      const req = { user: null, query: {} };
      const res = createResponse();

      await getUserOrders(req as any, res as any, jest.fn());

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    });

    it('calls service and returns 200 for valid request', async () => {
      const req = {
        user: { _id: 'user123' },
        query: { page: '1', limit: '10' },
      };
      const res = createResponse();

      const serviceResult = {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        orders: [
          {
            _id: 'order123',
            eventName: 'Test Event',
            amount: 100,
            status: 1,
          },
        ],
      };

      ticketOrderService.getUserOrders.mockResolvedValue(serviceResult);

      await getUserOrders(req as any, res as any, jest.fn());

      expect(ticketOrderService.getUserOrders).toHaveBeenCalledWith('user123', 1, 10);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: serviceResult,
      });
    });
  });

  describe('getOrganizerOrders', () => {
    it('calls service and returns 200 for valid organizer request', async () => {
      const req = {
        user: { _id: 'organizer123' },
        query: { page: '1', limit: '10' },
      };
      const res = createResponse();

      const serviceResult = {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        orders: [
          {
            _id: 'order456',
            eventName: 'Organizer Event',
            amount: 50,
            status: 1,
          },
        ],
      };

      ticketOrderService.getOrganizerOrders.mockResolvedValue(serviceResult);

      await getOrganizerOrders(req as any, res as any, jest.fn());

      expect(ticketOrderService.getOrganizerOrders).toHaveBeenCalledWith('organizer123', 1, 10);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: serviceResult,
      });
    });
  });
});
