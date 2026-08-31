import { RequestHandler } from 'express';
import User from '../models/user';
import {
  generateMagicToken,
  hashToken,
  MAGIC_TOKEN_EXPIRATION,
} from '../utils/token';
import emailService from '../services/email.service';
import { generateToken } from '../config/passport';
import zkOrchestratorService from '../services/zk-orchestrator.service';
import logger from '../utils/logger';

export const requestMagicLinkController: RequestHandler = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ message: 'Email is required' });
      return;
    }

    const user = await User.findOne({ email });

    if (!user) {
      res.status(200).json({
        message:
          'If an account exists with this email, a magic link has been sent',
      });
      return;
    }

    if (user.provider === 'google') {
      res.status(400).json({
        message: 'Please login with Google',
        provider: 'google',
      });
      return;
    }

    const token = generateMagicToken();
    const hashedToken = hashToken(token);
    const tokenExpires = new Date(Date.now() + MAGIC_TOKEN_EXPIRATION);

    user.magicToken = hashedToken;
    user.magicTokenExpires = tokenExpires;
    await user.save();

    logger.info(`Magic link requested at ${new Date().toISOString()}`);

    try {
      await emailService.sendMagicLink(email, token);
    } catch (emailError: any) {
      logger.error({ err: emailError }, 'Failed to send magic link email');

      user.magicToken = undefined;
      user.magicTokenExpires = undefined;
      await user.save();

      res.status(500).json({
        message: 'Failed to send magic link. Please try again later.',
      });
      return;
    }

    res.status(200).json({
      message: 'Magic link sent to your email. Please check your inbox.',
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Error in requestMagicLinkController');
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
};

export const verifyMagicLinkController: RequestHandler = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ message: 'Invalid or missing token' });
      return;
    }

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      magicToken: hashedToken,
      magicTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(401).json({
        message: 'Invalid or expired magic link. Please request a new one.',
      });
      return;
    }

    user.magicToken = undefined;
    user.magicTokenExpires = undefined;

    if (!user.emailVerifiedAt) {
      user.emailVerifiedAt = new Date();
    }

    await user.save();

    try {
      await zkOrchestratorService.orchestrateForUser(user);
    } catch (error: any) {
      logger.error(
        { err: error },
        'zk orchestration failed during magic link verification',
      );
    }

    logger.info(`Magic link verified at ${new Date().toISOString()}`);

    const jwtToken = generateToken(user);

    res.status(200).json({
      message: 'Login successful',
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Error in verifyMagicLinkController');
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
};
