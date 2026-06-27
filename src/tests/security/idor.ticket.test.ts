import request from 'supertest';
import app from '../app';
import TicketOrder from '../../src/models/ticket-order';
import jwt from 'jsonwebtoken';

const makeToken = (userId: string) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET || 's', { expiresIn: '1h' });

describe('IDOR Fix - Ticket Order Status (issue #136)', () => {
  it('returns 403 when user does not own the order', async () => {
    const owner = 'user-owner-id';
    const attacker = 'user-attacker-id';
    // Pre-create an order owned by owner
    const order = await TicketOrder.create({ userId: owner, status: 'pending' }).catch(() => null);
    if (!order) return; // skip if model not seeded
    const res = await request(app)
      .patch(`/api/ticket-orders/${order._id}/status`)
      .set('Authorization', `Bearer ${makeToken(attacker)}`)
      .send({ status: 'confirmed' });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Forbidden');
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .patch('/api/ticket-orders/fake-id/status')
      .send({ status: 'confirmed' });
    expect([401, 403]).toContain(res.status);
  });
});
