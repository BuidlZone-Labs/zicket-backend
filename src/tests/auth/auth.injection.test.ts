import request from 'supertest';
import app from '../../app';

describe('NoSQL Injection Protection - Auth Controllers', () => {
  describe('POST /api/auth/login', () => {
    it('rejects object email (NoSQL injection attempt)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: { $ne: null }, password: 'anything' });
      expect(res.status).toBe(400);
    });

    it('rejects object password (NoSQL injection attempt)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: { $ne: null } });
      expect(res.status).toBe(400);
    });

    it('rejects array as email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: ['user@example.com'], password: 'pass' });
      expect(res.status).toBe(400);
    });

    it('rejects missing email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('rejects invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'notanemail', password: 'password123' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/signup', () => {
    it('rejects object email (NoSQL injection attempt)', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Test', email: { $ne: null }, password: 'pass12345' });
      expect(res.status).toBe(400);
    });

    it('rejects weak password (under 8 chars)', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Test', email: 'test@example.com', password: 'short' });
      expect(res.status).toBe(400);
    });

    it('rejects missing name field', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(res.status).toBe(400);
    });
  });
});
