import request from 'supertest';
import app from '../../app';

describe('Race Condition + Info Leak - Organizer Signup', () => {
  describe('POST /api/auth/signup - duplicate key handling', () => {
    it('returns 409 not 500 when email already exists', async () => {
      // First signup succeeds
      await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Test User', email: 'dup@example.com', password: 'password123' });
      // Second signup with same email must return 409, not 500
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Test User 2', email: 'dup@example.com', password: 'password123' });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Email is already in use');
    });

    it('does not leak MongoDB error details in response', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Test', email: 'dup@example.com', password: 'password123' });
      const body = JSON.stringify(res.body);
      expect(body).not.toMatch(/MongoServer/i);
      expect(body).not.toMatch(/11000/);
      expect(body).not.toMatch(/duplicate key/);
    });

    it('returns user-friendly message only', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Test', email: 'dup@example.com', password: 'password123' });
      expect(res.body.message).toBe('Email is already in use');
    });
  });
});
