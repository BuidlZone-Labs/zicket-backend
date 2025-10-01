import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Enhanced rate limiter with custom key generator for email-based limiting
const createEmailBasedLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000 / 60), // minutes
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Custom key generator that combines IP and email for stricter control
    keyGenerator: (req: Request) => {
      const email = req.body?.email || req.body?.identifier;
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      return email ? `${ip}:${email}` : ip;
    },
    // Custom handler for rate limit exceeded
    handler: (req: Request, res: Response) => {
      console.warn(`Rate limit exceeded for ${req.ip} on ${req.path}`, {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000 / 60), // minutes
        timestamp: new Date().toISOString()
      });
    },
    // Skip successful requests in count (only count failed attempts)
    skipSuccessfulRequests: true,
    // Skip if request is from localhost in development
    skip: (req: Request) => {
      return process.env.NODE_ENV === 'development' && 
             (req.ip === '127.0.0.1' || req.ip === '::1');
    }
  });
};

// Create IP-only rate limiter
const createIpBasedLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000 / 60), // minutes
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      console.warn(`Rate limit exceeded for ${req.ip} on ${req.path}`, {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000 / 60),
        timestamp: new Date().toISOString()
      });
    },
    skipSuccessfulRequests: true,
    skip: (req: Request) => {
      return process.env.NODE_ENV === 'development' && 
             (req.ip === '127.0.0.1' || req.ip === '::1');
    }
  });
};

// Login rate limiter - 5 requests per minute per IP
export const loginLimiter = createIpBasedLimiter(
  1 * 60 * 1000, // 1 minute
  5,
  "Too many login attempts. Please try again in 1 minute."
);

// OTP request rate limiter - 3 requests per hour per email/IP combination
export const otpLimiter = createEmailBasedLimiter(
  60 * 60 * 1000, // 1 hour
  3,
  "Too many OTP requests. Please try again in 1 hour."
);

// Magic link rate limiter - 3 requests per 10 minutes per email/IP combination
export const magicLinkLimiter = createEmailBasedLimiter(
  10 * 60 * 1000, // 10 minutes
  3,
  "Too many magic link requests. Please try again in 10 minutes."
);

// Signup rate limiter - 3 signups per hour per IP
export const signupLimiter = createIpBasedLimiter(
  60 * 60 * 1000, // 1 hour
  3,
  "Too many signup attempts. Please try again in 1 hour."
);

// General auth rate limiter for sensitive endpoints
export const authLimiter = createIpBasedLimiter(
  15 * 60 * 1000, // 15 minutes
  10,
  "Too many authentication requests. Please try again in 15 minutes."
);

// Stricter production limits
export const productionLimits = {
  loginLimiter: createIpBasedLimiter(
    2 * 60 * 1000, // 2 minutes
    3,
    "Too many login attempts. Please try again in 2 minutes."
  ),
  otpLimiter: createEmailBasedLimiter(
    60 * 60 * 1000, // 1 hour
    2,
    "Too many OTP requests. Please try again in 1 hour."
  ),
  magicLinkLimiter: createEmailBasedLimiter(
    15 * 60 * 1000, // 15 minutes
    2,
    "Too many magic link requests. Please try again in 15 minutes."
  ),
  signupLimiter: createIpBasedLimiter(
    2 * 60 * 60 * 1000, // 2 hours
    2,
    "Too many signup attempts. Please try again in 2 hours."
  )
};

// Helper function to get appropriate limiter based on environment
export const getLimiter = (type: 'login' | 'otp' | 'magicLink' | 'signup') => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    switch (type) {
      case 'login': return productionLimits.loginLimiter;
      case 'otp': return productionLimits.otpLimiter;
      case 'magicLink': return productionLimits.magicLinkLimiter;
      case 'signup': return productionLimits.signupLimiter;
    }
  }
  
  switch (type) {
    case 'login': return loginLimiter;
    case 'otp': return otpLimiter;
    case 'magicLink': return magicLinkLimiter;
    case 'signup': return signupLimiter;
  }
};