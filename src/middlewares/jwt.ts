import jwt from 'jsonwebtoken';

export interface JwtPayload {
  id: string;
  email: string;
}

export const JwtVerify = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
  } catch (error) {
    throw new Error('Invalid or expired token!');
  }
};
