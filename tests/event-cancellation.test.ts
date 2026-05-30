import mongoose from 'mongoose';
import EventTicket from '../src/models/event-ticket';
import TicketOrder from '../src/models/ticket-order';
import User from '../src/models/user';
import { EventTicketService } from '../src/services/event-ticket.service';
import zkEmailNotificationService from '../src/services/zk-email-notification.service';

jest.mock('../src/models/event-ticket');
jest.mock('../src/models/ticket-order');
jest.mock('../src/models/user');
jest.mock('../src/services/zk-email-notification.service');

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    startSession: jest.fn(),
  };
});

describe('EventTicketService - cancelEvent', () => {
  const mockEndSession = jest.fn().mockResolvedValue(undefined);
  const mockAbortTransaction = jest.fn().mockResolvedValue(undefined);
  const mockCommitTransaction = jest.fn().mockResolvedValue(undefined);
  const mockStartTransaction = jest.fn().mockResolvedValue(undefined);

  const mockSession = {
    startTransaction: mockStartTransaction,
    commitTransaction: mockCommitTransaction,
    abortTransaction: mockAbortTransaction,
    endSession: mockEndSession,
  };

  const eventId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    (mongoose.startSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it('successfully cancels an event and its orders', async () => {
    const mockEvent = {
      _id: eventId,
      name: 'Web3 Hackathon',
      eventStatus: 'upcoming',
      totalTickets: 100,
      availableTickets: 80,
      soldTickets: 20,
      save: jest.fn().mockResolvedValue(true),
    };

    const mockOrders = [
      { _id: 'order1', user: userId, status: 1, eventName: 'Web3 Hackathon' },
      { _id: 'order2', user: userId, status: 0, eventName: 'Web3 Hackathon' },
    ];

    const mockUsers = [
      { _id: userId, name: 'John Doe', email: 'john@example.com' },
    ];

    (EventTicket.findById as jest.Mock).mockReturnValue({
      session: jest.fn().mockResolvedValue(mockEvent),
    });

    (TicketOrder.find as jest.Mock).mockReturnValue({
      session: jest.fn().mockResolvedValue(mockOrders),
    });

    (TicketOrder.updateMany as jest.Mock).mockResolvedValue({
      modifiedCount: 2,
    });

    (User.find as jest.Mock).mockReturnValue({
      session: jest.fn().mockResolvedValue(mockUsers),
    });

    const result = await EventTicketService.cancelEvent(eventId);

    // Assertions
    expect(mockEvent.eventStatus).toBe('cancelled');
    expect(mockEvent.availableTickets).toBe(100);
    expect(mockEvent.soldTickets).toBe(0);
    expect(mockEvent.save).toHaveBeenCalledWith({ session: mockSession });

    expect(TicketOrder.updateMany).toHaveBeenCalledWith(
      { eventTicket: eventId, status: { $in: [0, 1] } },
      { $set: { status: 2 } },
      { session: mockSession },
    );

    expect(
      zkEmailNotificationService.notifyEventCancellation,
    ).toHaveBeenCalledTimes(1);
    expect(mockCommitTransaction).toHaveBeenCalled();
    expect(result.eventStatus).toBe('cancelled');
  });

  it('throws error if event not found', async () => {
    (EventTicket.findById as jest.Mock).mockReturnValue({
      session: jest.fn().mockResolvedValue(null),
    });

    await expect(EventTicketService.cancelEvent(eventId)).rejects.toThrow(
      'Event not found',
    );
    expect(mockAbortTransaction).toHaveBeenCalled();
  });

  it('throws error if event already cancelled', async () => {
    const mockEvent = {
      eventStatus: 'cancelled',
    };

    (EventTicket.findById as jest.Mock).mockReturnValue({
      session: jest.fn().mockResolvedValue(mockEvent),
    });

    await expect(EventTicketService.cancelEvent(eventId)).rejects.toThrow(
      'Event is already cancelled',
    );
  });
});
