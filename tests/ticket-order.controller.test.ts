import {
  getUserOrders,
  getOrganizerOrders,
  updateTicketOrderStatus,
} from '../src/controllers/ticket-order.controller';
import { TicketOrderService } from '../src/services/ticket-order.service';
import TicketOrder from '../src/models/ticket-order';
import EventTicket from '../src/models/event-ticket';

jest.mock('../src/services/ticket-order.service', () => ({
  TicketOrderService: {
    getUserOrders: jest.fn(),
    getOrganizerOrders: jest.fn(),
    updateOrderStatusWithNotification: jest.fn(),
  },
}));

jest.mock('../src/models/ticket-order');
jest.mock('../src/models/event-ticket');

describe('TicketOrder controller', () => {
  const ticketOrderService = TicketOrderService as unknown as {
    getUserOrders: jest.Mock;
    getOrganizerOrders: jest.Mock;
    updateOrderStatusWithNotification: jest.Mock;
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

      expect(ticketOrderService.getUserOrders).toHaveBeenCalledWith(
        'user123',
        1,
        10,
      );
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

      expect(ticketOrderService.getOrganizerOrders).toHaveBeenCalledWith(
        'organizer123',
        1,
        10,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: serviceResult,
      });
    });
  });

  describe('updateTicketOrderStatus', () => {
    const orderId = 'order789';
    const organizerId = 'org123';
    const otherUserId = 'other456';
    const eventTicketId = 'eventTicket999';

    it('returns 401 when user is not authenticated', async () => {
      const req = {
        user: null,
        params: { orderId },
        body: { status: 1 },
      };
      const res = createResponse();

      await updateTicketOrderStatus(req as any, res as any, jest.fn());

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    });

    it('returns 400 when orderId is missing', async () => {
      const req = {
        user: { _id: organizerId },
        params: {},
        body: { status: 1 },
      };
      const res = createResponse();

      await updateTicketOrderStatus(req as any, res as any, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Bad request',
        message: 'Order ID is required',
      });
    });

    it('returns 400 when status is invalid', async () => {
      const req = {
        user: { _id: organizerId },
        params: { orderId },
        body: { status: 99 },
      };
      const res = createResponse();

      await updateTicketOrderStatus(req as any, res as any, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Bad request',
        message: 'Valid status (0, 1, or 3) is required',
      });
    });

    it('returns 404 when order is not found', async () => {
      const req = {
        user: { _id: organizerId },
        params: { orderId },
        body: { status: 1 },
      };
      const res = createResponse();

      (TicketOrder.findById as jest.Mock).mockResolvedValue(null);

      await updateTicketOrderStatus(req as any, res as any, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Not found',
        message: 'Ticket order not found',
      });
    });

    it('returns 404 when associated event ticket is not found', async () => {
      const req = {
        user: { _id: organizerId },
        params: { orderId },
        body: { status: 1 },
      };
      const res = createResponse();

      (TicketOrder.findById as jest.Mock).mockResolvedValue({
        _id: orderId,
        eventTicket: eventTicketId,
      });
      (EventTicket.findById as jest.Mock).mockResolvedValue(null);

      await updateTicketOrderStatus(req as any, res as any, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Not found',
        message: 'Associated event ticket not found',
      });
    });

    it('returns 403 when user is not the event organizer', async () => {
      const req = {
        user: { _id: otherUserId },
        params: { orderId },
        body: { status: 1 },
      };
      const res = createResponse();

      (TicketOrder.findById as jest.Mock).mockResolvedValue({
        _id: orderId,
        eventTicket: eventTicketId,
      });
      (EventTicket.findById as jest.Mock).mockResolvedValue({
        _id: eventTicketId,
        organizedBy: organizerId,
      });

      await updateTicketOrderStatus(req as any, res as any, jest.fn());

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'You do not have permission to update this ticket order',
      });
    });

    it('returns 200 when user is the event organizer', async () => {
      const req = {
        user: { _id: organizerId },
        params: { orderId },
        body: { status: 1 },
      };
      const res = createResponse();

      (TicketOrder.findById as jest.Mock).mockResolvedValue({
        _id: orderId,
        eventTicket: eventTicketId,
      });
      (EventTicket.findById as jest.Mock).mockResolvedValue({
        _id: eventTicketId,
        organizedBy: organizerId,
      });

      const serviceResult = {
        order: { _id: orderId, eventTicket: eventTicketId, status: 1 },
        notificationJobId: 'job123',
      };
      ticketOrderService.updateOrderStatusWithNotification.mockResolvedValue(
        serviceResult,
      );

      await updateTicketOrderStatus(req as any, res as any, jest.fn());

      expect(
        ticketOrderService.updateOrderStatusWithNotification,
      ).toHaveBeenCalledWith(orderId, 1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Ticket order status updated successfully',
        data: {
          order: serviceResult.order,
          notificationJobId: serviceResult.notificationJobId,
        },
      });
    });
  });
});
