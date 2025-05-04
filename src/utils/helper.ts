import User from '../models/user';
var jwt = require('jsonwebtoken');
import { JwtVerify } from '../middlewares/jwt';

const extractToken = (req: any): string | null => {
  return req.headers.authorization?.split(' ')[1] || null;
};

const validateAndGetUser = async (token: string) => {
  const decoded = JwtVerify(token);
  const user = await User.findOne({ id: decoded.id });

  if (!user) {
    throw new Error('Token is blacklisted');
  }

  return user;
};

const handleAuthError = (err: any) => {
  if (err instanceof jwt.JsonWebTokenError) {
    return {
      error: 'Unauthorized: Invalid token',
      code: 401,
    };
  }

  if (err.message === 'Token is blacklisted') {
    return {
      error: 'Unauthorized: token is invalid!',
      code: 403,
    };
  }

  if (err.message === 'User not found') {
    return {
      error: 'Authenticated user does not exist!',
      code: 401,
    };
  }

  return {
    error: 'Unauthorized: login to proceed!',
    code: 401,
  };
};

export { extractToken, validateAndGetUser, handleAuthError };
