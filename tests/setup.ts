process.env.GOOGLE_CLIENT_ID = 'mock-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'mock-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/auth/google/callback';
process.env.NODE_ENV = 'test';

jest.mock('express-rate-limit', () => {
  return jest.fn().mockImplementation(() => {
    return (req: any, res: any, next: any) => next();
  });
});

global.console.error = jest.fn();
