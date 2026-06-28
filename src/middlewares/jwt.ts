import jwt from 'jsonwebtoken';

export interface JwtPayload {
  id: string;
  email: string;
}

export const JwtVerify = (token: string): JwtPayload => {
  return jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
};
