import { authGuard } from '../src/middlewares/auth';
import User from '../src/models/user';
import { JwtVerify } from '../src/middlewares/jwt';
import jwt from 'jsonwebtoken';

jest.mock('../src/models/user');
jest.mock('../src/middlewares/jwt');

const parseCookie = (header: string | undefined, name: string): string | undefined => {
  if (!header) return undefined;
  const cookies = header.split(';').map((c) => c.trim().split('='));
  const cookie = cookies.find(([key]) => key === name);
  return cookie?.[1];
};

describe('authGuard middleware — cookie-based auth (Google OAuth)', () => {
  const createResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  });

  const createRequest = () => ({
    headers: {},
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (JwtVerify as jest.Mock).mockReturnValue({
      id: 'user-id-1',
      email: 'user@example.com',
    });
  });

  it('accepts a valid token from the cookie header', async () => {
    const verifiedUser = {
      _id: 'user-id-1',
      email: 'user@example.com',
      provider: 'google',
      emailVerifiedAt: undefined,
    };
    (User.findById as jest.Mock).mockResolvedValue(verifiedUser);

    const token = 'valid.jwt.token';
    const req = {
      headers: {
        cookie: `token=${token}; other=value`,
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await authGuard(req as any, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect((req as any).user).toBe(verifiedUser);
  });

  it('rejects a request with an invalid cookie token', async () => {
    (JwtVerify as jest.Mock).mockImplementation(() => {
      throw new jwt.JsonWebTokenError('Invalid token');
    });

    const req = {
      headers: {
        cookie: 'token=invalid.jwt.token',
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await authGuard(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unauthorized: Invalid token',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a request with an empty cookie header', async () => {
    const req = createRequest();
    const res = createResponse();
    const next = jest.fn();

    await authGuard(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unauthorized: No token provided',
    });
    expect(next).not.toHaveBeenCalled();
  });
});

// Regression coverage for issue #122: a valid JWT alone must not grant access to
// protected routes. Unverified local accounts have to be blocked at the guard,
// not only at the login controller.
describe('authGuard middleware — email verification enforcement (issue #122)', () => {
  const createResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  });

  const createRequest = () => ({
    headers: { authorization: 'Bearer valid.jwt.token' },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (JwtVerify as jest.Mock).mockReturnValue({
      id: 'user-id-1',
      email: 'user@example.com',
    });
  });

  it('blocks an unverified local account from reaching a protected route (403)', async () => {
    (User.findById as jest.Mock).mockResolvedValue({
      _id: 'user-id-1',
      email: 'user@example.com',
      provider: 'local',
      emailVerifiedAt: undefined,
    });

    const req = createRequest();
    const res = createResponse();
    const next = jest.fn();

    await authGuard(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error:
        'Forbidden: Please verify your email before accessing this resource',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a verified local account through to the protected route', async () => {
    const verifiedUser = {
      _id: 'user-id-1',
      email: 'user@example.com',
      provider: 'local',
      emailVerifiedAt: new Date(),
    };
    (User.findById as jest.Mock).mockResolvedValue(verifiedUser);

    const req = createRequest();
    const res = createResponse();
    const next = jest.fn();

    await authGuard(req as any, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect((req as any).user).toBe(verifiedUser);
  });

  it('allows a Google account through even without emailVerifiedAt set', async () => {
    (User.findById as jest.Mock).mockResolvedValue({
      _id: 'user-id-1',
      email: 'user@example.com',
      provider: 'google',
      emailVerifiedAt: undefined,
    });

    const req = createRequest();
    const res = createResponse();
    const next = jest.fn();

    await authGuard(req as any, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a request with no token before any verification check (401)', async () => {
    const req = { headers: {} };
    const res = createResponse();
    const next = jest.fn();

    await authGuard(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unauthorized: No token provided',
    });
    expect(next).not.toHaveBeenCalled();
    expect(User.findById).not.toHaveBeenCalled();
  });
});
