import request from 'supertest';
import app from '../src/app';
import { JwtVerify } from '../src/middlewares/jwt';
import User from '../src/models/user';

jest.mock('../src/middlewares/jwt');
jest.mock('../src/models/user');

const VALID_ID = '65f9f9e4c51058f58d05d9aa';

describe('Message center route — authentication & authorization guards', () => {
  describe('unauthenticated requests (no token)', () => {
    const protectedRoutes: Array<{
      method: 'post' | 'get' | 'patch' | 'delete';
      path: string;
    }> = [
      { method: 'post', path: '/zk-message-center' },
      { method: 'get', path: '/zk-message-center/past' },
      { method: 'get', path: '/zk-message-center/scheduled' },
      { method: 'patch', path: `/zk-message-center/${VALID_ID}` },
      { method: 'delete', path: `/zk-message-center/${VALID_ID}` },
    ];

    it.each(protectedRoutes)(
      '$method $path returns 401 without Authorization header',
      async ({ method, path }) => {
        const res = await (request(app) as any)[method](path).send({});
        expect(res.status).toBe(401);
        expect(res.body).toMatchObject({
          error: expect.stringContaining('Unauthorized'),
        });
      },
    );
  });

  describe('authenticated non-admin requests', () => {
    beforeEach(() => {
      (JwtVerify as jest.Mock).mockReturnValue({
        id: 'user-id-1',
        email: 'user@example.com',
      });
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

    const protectedRoutes: Array<{
      method: 'post' | 'get' | 'patch' | 'delete';
      path: string;
    }> = [
      { method: 'post', path: '/zk-message-center' },
      { method: 'get', path: '/zk-message-center/past' },
      { method: 'get', path: '/zk-message-center/scheduled' },
      { method: 'patch', path: `/zk-message-center/${VALID_ID}` },
      { method: 'delete', path: `/zk-message-center/${VALID_ID}` },
    ];

    it.each(protectedRoutes)(
      '$method $path returns 403 for non-admin user',
      async ({ method, path }) => {
        const res = await (request(app) as any)
          [method](path)
          .set('Authorization', 'Bearer valid.token')
          .send({});
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({
          error: 'Forbidden: Admin access required',
        });
      },
    );
  });

  describe('authenticated admin requests', () => {
    beforeEach(() => {
      (JwtVerify as jest.Mock).mockReturnValue({
        id: 'admin-id-1',
        email: 'admin@example.com',
      });
      (User.findById as jest.Mock).mockResolvedValue({
        _id: 'admin-id-1',
        email: 'admin@example.com',
        provider: 'local',
        emailVerifiedAt: new Date(),
        role: 'admin',
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('GET /zk-message-center/past passes auth and admin guards', async () => {
      const res = await request(app)
        .get('/zk-message-center/past')
        .set('Authorization', 'Bearer admin.token');
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    }, 15000);

    it('GET /zk-message-center/scheduled passes auth and admin guards', async () => {
      const res = await request(app)
        .get('/zk-message-center/scheduled')
        .set('Authorization', 'Bearer admin.token');
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    }, 15000);
  });
});
