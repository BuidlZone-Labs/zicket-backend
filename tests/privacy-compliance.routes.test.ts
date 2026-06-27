import request from 'supertest';
import express from 'express';
import privacyComplianceRoutes from '../src/routes/privacy-compliance.route';
import EventTicket from '../src/models/event-ticket';
import { PAYMENT_PRIVACY_STANDARD } from '../src/services/payment-privacy-disclosure.service';

jest.mock('../src/models/event-ticket');

const mockEventTicket = EventTicket as jest.Mocked<typeof EventTicket>;

const app = express();
app.use(express.json());
app.use('/compliance', privacyComplianceRoutes);

describe('Privacy compliance routes (#127)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /compliance/data-retention returns matrix and summary', async () => {
    const res = await request(app).get('/compliance/data-retention');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.matrix)).toBe(true);
    expect(res.body.data.matrix.length).toBeGreaterThan(0);
    expect(res.body.data.summary.onChainPermanent).toMatch(/immutable/i);
    expect(res.body.data.summary.offChainErasable).toMatch(/MongoDB/i);
  });

  it('GET /compliance/payment-privacy-disclosure/:eventId returns Standard warning', async () => {
    const eventId = '507f1f77bcf86cd799439011';

    (mockEventTicket.findById as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: eventId,
          name: 'Paid Public Event',
          eventType: 1,
          paymentPrivacy: PAYMENT_PRIVACY_STANDARD,
        }),
      }),
    });

    const res = await request(app).get(
      `/compliance/payment-privacy-disclosure/${eventId}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.paymentDisclosure.acknowledgmentRequired).toBe(true);
    expect(res.body.data.paymentDisclosure.warning).toMatch(
      /cannot be erased/i,
    );
  });

  it('GET /compliance/payment-privacy-disclosure/:eventId returns 400 for invalid id', async () => {
    const res = await request(app).get(
      '/compliance/payment-privacy-disclosure/not-an-object-id',
    );

    expect(res.status).toBe(400);
  });
});
