import { loginController } from '../src/controllers/login.controller';
import User from '../src/models/user';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

jest.mock('../src/models/user', () => {
  const MockUser = jest.fn();
  (MockUser as any).findOne = jest.fn();
  return { __esModule: true, default: MockUser };
});

jest.mock('../src/utils/token', () => ({
  generateAccessToken: jest.fn().mockReturnValue('mock-token'),
}));

describe('loginController', () => {
  const createResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when email is missing', async () => {
    const req = { body: { password: 'secret123' } };
    const res = createResponse();
    await loginController(req as any, res as any, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Validation failed' }),
    );
  });

  it('returns 400 when password is missing', async () => {
    const req = { body: { email: 'test@example.com' } };
    const res = createResponse();
    await loginController(req as any, res as any, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Validation failed' }),
    );
  });

  it('returns 400 when email is not a valid email format', async () => {
    const req = { body: { email: 'not-an-email', password: 'secret123' } };
    const res = createResponse();
    await loginController(req as any, res as any, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Validation failed' }),
    );
  });

  it('returns 400 when email is a NoSQL injection payload ($ne)', async () => {
    const req = { body: { email: { $ne: null }, password: 'secret123' } };
    const res = createResponse();
    await loginController(req as any, res as any, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Validation failed' }),
    );
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('returns 400 when email is a NoSQL injection payload ($gt)', async () => {
    const req = { body: { email: { $gt: '' }, password: 'secret123' } };
    const res = createResponse();
    await loginController(req as any, res as any, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Validation failed' }),
    );
  });

  it('returns 400 when password is a NoSQL injection payload', async () => {
    const req = { body: { email: 'test@example.com', password: { $ne: null } } };
    const res = createResponse();
    await loginController(req as any, res as any, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Validation failed' }),
    );
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('returns 404 when user not found', async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);
    const req = { body: { email: 'nonexistent@example.com', password: 'secret123' } };
    const res = createResponse();
    await loginController(req as any, res as any, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
  });
});