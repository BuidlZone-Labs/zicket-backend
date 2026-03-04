import { verifyAccountController } from '../src/controllers/verify.controller';
import User from '../src/models/user';

jest.mock('../src/models/user');

describe('verify account controller', () => {
  const createResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when email or OTP is missing', async () => {
    const req = { body: { email: 'test@example.com' } };
    const res = createResponse();
    await verifyAccountController(req as any, res as any, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Email and OTP are required',
    });
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('returns 404 when user is not found', async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);
    const req = { body: { email: 'unknown@example.com', otp: 123456 } };
    const res = createResponse();
    await verifyAccountController(req as any, res as any, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
  });

  it('returns 400 when user has no pending OTP', async () => {
    (User.findOne as jest.Mock).mockResolvedValue({
      email: 'test@example.com',
      otp: undefined,
      otpExpires: undefined,
      save: jest.fn(),
    });
    const req = { body: { email: 'test@example.com', otp: 123456 } };
    const res = createResponse();
    await verifyAccountController(req as any, res as any, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'No pending verification for this account',
    });
  });

  it('returns 400 when OTP is invalid', async () => {
    (User.findOne as jest.Mock).mockResolvedValue({
      email: 'test@example.com',
      otp: 123456,
      otpExpires: new Date(Date.now() + 60000),
      save: jest.fn(),
    });
    const req = { body: { email: 'test@example.com', otp: 999999 } };
    const res = createResponse();
    await verifyAccountController(req as any, res as any, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid OTP' });
  });

  it('returns 400 when OTP has expired', async () => {
    (User.findOne as jest.Mock).mockResolvedValue({
      email: 'test@example.com',
      otp: 123456,
      otpExpires: new Date(Date.now() - 60000),
      save: jest.fn(),
    });
    const req = { body: { email: 'test@example.com', otp: 123456 } };
    const res = createResponse();
    await verifyAccountController(req as any, res as any, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'OTP has expired' });
  });

  it('verifies account and sets emailVerifiedAt on success', async () => {
    const mockSave = jest.fn().mockResolvedValue(undefined);
    const userDoc = {
      email: 'test@example.com',
      otp: 123456,
      otpExpires: new Date(Date.now() + 60000),
      emailVerifiedAt: undefined,
      save: mockSave,
    };
    (User.findOne as jest.Mock).mockResolvedValue(userDoc);

    const req = { body: { email: 'test@example.com', otp: 123456 } };
    const res = createResponse();
    await verifyAccountController(req as any, res as any, jest.fn());

    expect(userDoc.otp).toBeUndefined();
    expect(userDoc.otpExpires).toBeUndefined();
    expect(userDoc.emailVerifiedAt).toBeInstanceOf(Date);
    expect(mockSave).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Account verified successfully',
    });
  });

  it('accepts OTP as string and verifies successfully', async () => {
    const mockSave = jest.fn().mockResolvedValue(undefined);
    const userDoc = {
      email: 'test@example.com',
      otp: 654321,
      otpExpires: new Date(Date.now() + 60000),
      emailVerifiedAt: undefined,
      save: mockSave,
    };
    (User.findOne as jest.Mock).mockResolvedValue(userDoc);

    const req = { body: { email: 'test@example.com', otp: '654321' } };
    const res = createResponse();
    await verifyAccountController(req as any, res as any, jest.fn());

    expect(userDoc.otp).toBeUndefined();
    expect(userDoc.emailVerifiedAt).toBeInstanceOf(Date);
    expect(mockSave).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
