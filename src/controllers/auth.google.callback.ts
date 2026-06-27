import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { generateAccessToken } from '../utils/token';

/**
 * Secure Google OAuth callback.
 * Transmits the JWT via an HttpOnly cookie instead of a URL query parameter.
 * URL query parameters are logged in server logs, browser history, and
 * Referer headers — exposing the token to unintended parties.
 */
export const googleCallbackSecure: RequestHandler = (req, res) => {
  const user = req.user as any;
  if (!user) {
    res.status(401).json({ message: 'Authentication failed' });
    return;
  }

  const token = generateAccessToken(user);
  const isProd = process.env.NODE_ENV === 'production';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  // Set JWT as HttpOnly cookie — never exposed in URL or JS
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });

  // Redirect to frontend without token in URL
  res.redirect(frontendUrl);
};
