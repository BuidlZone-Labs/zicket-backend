import request from 'supertest';
import app from '../src/app';
import { JwtVerify } from '../src/middlewares/jwt';
import User from '../src/models/user';

jest.mock('../src/middlewares/jwt');
jest.mock('../src/models/user');

const VALID_ID = '65f9f9e4c51058f58d05d9aa';

describe('News route — authentication & authorization guards', () => {
  describe('unauthenticated requests (no token)', () => {
    const mutatingRoutes: Array<{ method: 'post' | 'patch' | 'delete'; path: string }> = [
      { method: 'post', path: '/news' },
      { method: 'patch', path: `/news/${VALID_ID}` },
      { method: 'delete', path: `/news/${VALID_ID}` },
      { method: 'delete', path: `/news/${VALID_ID}/permanent` },
      { method: 'patch', path: `/news/${VALID_ID}/restore` },
    ];

    it.each(mutatingRoutes)(
      '$method $path returns 401 without Authorization header',
      async ({ method, path }) => {
        const res = await (request(app) as any)[method](path).send({});
        expect(res.status).toBe(401);
        expect(res.body).toMatchObject({ error: expect.stringContaining('Unauthorized') });
      },
    );
  });

  describe('authenticated non-admin requests', () => {
    beforeEach(() => {
      (JwtVerify as jest.Mock).mockReturnValue({ id: 'user-id-1', email: 'user@example.com' });
      (User.findById as jest.Mock).mockResolvedValue({
        _id: 'user-id-1',
        email: 'user@example.com',
        provider: 'local',
        emailVerifiedAt: new Date(),
        role: 'user',
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    const mutatingRoutes: Array<{ method: 'post' | 'patch' | 'delete'; path: string }> = [
      { method: 'post', path: '/news' },
      { method: 'patch', path: `/news/${VALID_ID}` },
      { method: 'delete', path: `/news/${VALID_ID}` },
      { method: 'delete', path: `/news/${VALID_ID}/permanent` },
      { method: 'patch', path: `/news/${VALID_ID}/restore` },
    ];

    it.each(mutatingRoutes)(
      '$method $path returns 403 for non-admin user',
      async ({ method, path }) => {
        const res = await (request(app) as any)[method](path)
          .set('Authorization', 'Bearer valid.token')
          .send({});
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ error: 'Forbidden: Admin access required' });
      },
    );
  });

  describe('public read routes remain accessible without authentication', () => {
    it('GET /news returns 200 without token', async () => {
      const res = await request(app).get('/news');
      // 200 or 500 (no DB) — but must NOT be 401 or 403
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('PATCH /news/:id/read does not require authentication', async () => {
      const res = await request(app).patch(`/news/${VALID_ID}/read`).send({});
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });
});
