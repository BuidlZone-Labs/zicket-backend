import { RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/user';
import { generateAccessToken } from '../utils/token';

export const loginController: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

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
