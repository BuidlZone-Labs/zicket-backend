import { RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/user';
import { generateAccessToken } from '../utils/token';
import { LoginSchema } from '../validators/auth.validator';
import z from 'zod';

export const loginController: RequestHandler = async (req, res, next) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        messages: z.treeifyError(parsed.error),
      });
    }

    const { email, password } = parsed.data;

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (user.provider === 'google') {
      res.status(400).json({
        message: 'Please login with Google',
        provider: 'google',
      });
      return;
    }

    if (!user.emailVerifiedAt) {
      res.status(403).json({
        message: 'Please verify your email before logging in',
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password!);
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const token = generateAccessToken(user);

    res.status(200).json({ message: 'Login successful', token });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};