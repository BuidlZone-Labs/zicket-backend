import { Request, Response, NextFunction } from 'express';

/**
 * Optional Captcha verification middleware
 * Checks for a valid captcha token (e.g., Turnstile, reCAPTCHA) in headers or body.
 * If CAPTCHA_SECRET is not configured, it bypasses verification.
 */
export const verifyCaptcha = async (req: Request, res: Response, next: NextFunction) => {
  const secretKey = process.env.CAPTCHA_SECRET;
  
  // Bypass if no secret is configured (dev/testing or not enabled)
  if (!secretKey) {
    return next();
  }

  const token = req.headers['x-captcha-token'] || req.body?.captchaToken;

  if (!token) {
    return res.status(400).json({ error: 'Captcha token is required for this action.' });
  }

  try {
    // Example using Cloudflare Turnstile verification endpoint
    // This can be adapted for reCAPTCHA or hCaptcha
    const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token as string,
        remoteip: req.ip as string,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      return res.status(400).json({ error: 'Invalid captcha token.', details: data['error-codes'] });
    }

    return next();
  } catch (error) {
    console.error('Captcha verification failed:', error);
    return res.status(500).json({ error: 'Internal server error during captcha verification.' });
  }
};
