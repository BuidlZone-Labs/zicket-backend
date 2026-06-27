import mongoose from 'mongoose';
import { ErasureAssessmentService } from '../src/services/erasure-assessment.service';
import TicketOrder from '../src/models/ticket-order';
import EventTicket from '../src/models/event-ticket';
import {
  PAYMENT_PRIVACY_ANONYMOUS,
  PAYMENT_PRIVACY_STANDARD,
} from '../src/services/payment-privacy-disclosure.service';

jest.mock('../src/models/ticket-order');
jest.mock('../src/models/event-ticket');

const mockTicketOrder = TicketOrder as jest.Mocked<typeof TicketOrder>;
const mockEventTicket = EventTicket as jest.Mocked<typeof EventTicket>;

const userId = new mongoose.Types.ObjectId().toString();

describe('ErasureAssessmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports anonymous-only history with no on-chain permanent data', async () => {
    const eventId = new mongoose.Types.ObjectId();

    (mockTicketOrder.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            eventTicket: eventId,
            paymentPrivacy: PAYMENT_PRIVACY_ANONYMOUS,
          },
        ]),
      }),
    });

    (mockEventTicket.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: eventId,
            name: 'Anon Fest',
            eventType: 1,
            paymentPrivacy: PAYMENT_PRIVACY_ANONYMOUS,
          },
        ]),
      }),
    });

    const assessment = await ErasureAssessmentService.assessUser(userId);

    expect(assessment.onChainPermanentData).toBe(false);
    expect(assessment.anonymousOnlyPaymentHistory).toBe(true);
    expect(assessment.onChainPermanentReasons).toHaveLength(0);
    expect(assessment.offChainErasable).toBe(true);
  });

  it('flags Standard payment history as permanent on-chain', async () => {
    const eventId = new mongoose.Types.ObjectId();

    (mockTicketOrder.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            eventTicket: eventId,
            paymentPrivacy: PAYMENT_PRIVACY_STANDARD,
          },
        ]),
      }),
    });

    (mockEventTicket.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: eventId,
            name: 'Public Gala',
            eventType: 1,
            paymentPrivacy: PAYMENT_PRIVACY_STANDARD,
          },
        ]),
      }),
    });

    const assessment = await ErasureAssessmentService.assessUser(userId);

    expect(assessment.onChainPermanentData).toBe(true);
    expect(assessment.standardPaymentOrders).toBe(1);
    expect(assessment.anonymousOnlyPaymentHistory).toBe(false);
    expect(assessment.onChainPermanentReasons[0]).toMatch(/Public Gala/);
    expect(assessment.onChainPermanentReasons[0]).toMatch(
      /Soroban PaymentRecord/,
    );
  });

  it('falls back to event paymentPrivacy when order snapshot is missing', async () => {
    const eventId = new mongoose.Types.ObjectId();

    (mockTicketOrder.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            eventTicket: eventId,
            paymentPrivacy: null,
          },
        ]),
      }),
    });

    (mockEventTicket.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: eventId,
            name: 'Legacy Order Event',
            eventType: 1,
            paymentPrivacy: PAYMENT_PRIVACY_STANDARD,
          },
        ]),
      }),
    });

    const assessment = await ErasureAssessmentService.assessUser(userId);

    expect(assessment.onChainPermanentData).toBe(true);
    expect(assessment.standardPaymentOrders).toBe(1);
  });

  it('ignores free events for on-chain payment assessment', async () => {
    const eventId = new mongoose.Types.ObjectId();

    (mockTicketOrder.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            eventTicket: eventId,
            paymentPrivacy: null,
          },
        ]),
      }),
    });

    (mockEventTicket.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: eventId,
            name: 'Free Meetup',
            eventType: 0,
            paymentPrivacy: PAYMENT_PRIVACY_STANDARD,
          },
        ]),
      }),
    });

    const assessment = await ErasureAssessmentService.assessUser(userId);

    expect(assessment.onChainPermanentData).toBe(false);
    expect(assessment.standardPaymentOrders).toBe(0);
  });
});
