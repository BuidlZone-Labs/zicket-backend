import express from 'express';
import { signupController } from '../controllers/signup.controller';
import { validateSchema } from '../middlewares/validator';
import { SignupSchema, LoginSchema } from '../validators/auth.validator';
import { loginController } from '../controllers/login.controller';
import { resendOtpController } from '../controllers/resendotp.controller';
import { verifyAccountController } from '../controllers/verify.controller';
import {
  requestMagicLinkController,
  verifyMagicLinkController,
} from '../controllers/magiclink.controller';
import passport from 'passport';
import { generateToken } from '../config/passport';
import dotenv from 'dotenv';
import { getLimiter } from '../middlewares/rateLimiter';

dotenv.config();

const authRoute = express.Router();

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: Register a new user account
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *     security: []
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error or user already exists
 *       429:
 *         description: Too many requests
 */
authRoute.post(
  '/signup',
  getLimiter('signup'),
  validateSchema(SignupSchema),
  signupController,
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authenticate user with email and password
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     security: []
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many attempts
 */
authRoute.post(
  '/login',
  getLimiter('login'),
  validateSchema(LoginSchema),
  loginController,
);

/**
 * @swagger
 * /auth/verify-account:
 *   post:
 *     summary: Verify user account with OTP
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: number
 *     security: []
 *     responses:
 *       200:
 *         description: Account verified successfully
 *       400:
 *         description: Invalid OTP
 *       429:
 *         description: Too many attempts
 */
authRoute.post('/verify-account', getLimiter('otp'), verifyAccountController);

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     summary: Resend OTP to user email
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     security: []
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *       404:
 *         description: User not found
 *       429:
 *         description: Too many requests
 */
authRoute.post('/resend-otp', getLimiter('otp'), resendOtpController);

/**
 * @swagger
 * /auth/magic-link-request:
 *   post:
 *     summary: Request a magic link for passwordless authentication
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     security: []
 *     responses:
 *       200:
 *         description: Magic link sent to email
 *       404:
 *         description: User not found
 *       429:
 *         description: Too many requests
 */
authRoute.post(
  '/magic-link-request',
  getLimiter('magicLink'),
  requestMagicLinkController,
);

/**
 * @swagger
 * /auth/magic:
 *   get:
 *     summary: Verify magic link and authenticate user
 *     tags:
 *       - Authentication
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     security: []
 *     responses:
 *       200:
 *         description: Magic link verified, user authenticated
 *       401:
 *         description: Invalid or expired magic link
 */
authRoute.get('/magic', verifyMagicLinkController);

/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: Initiate Google OAuth authentication
 *     tags:
 *       - Authentication
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to Google login
 */
authRoute.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  }),
);

authRoute.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/auth/login',
    session: false,
  }),
  (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication failed' });
      return;
    }

    const token = generateToken(req.user as any);

    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000,
    });

    res.redirect(process.env.FRONTEND_URL!);
  },
);

export default authRoute;
