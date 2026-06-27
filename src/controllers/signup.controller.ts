import { Request, RequestHandler, Response } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/user';
import { generateOTP } from '../utils/otp';
import emailService from '../services/email.service';
import { SignupSchema } from '../validators/auth.validator';

const OTP_EXPIRY_MINUTES = 10;

export const signupController: RequestHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    // Validate first to prevent NoSQL injection (also fixes #137)
    const parsed = SignupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: 'Invalid request',
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { name, email, password } = parsed.data;

    // Check for existing user before attempting insert
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: 'Email is already in use' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      otp,
      otpExpiry,
    });

    await emailService.sendOTPEmail(email, otp);

    res.status(201).json({
      message: 'Account created. Please verify your email.',
      userId: user._id,
    });
  } catch (error: any) {
    // Fix race condition: catch MongoDB duplicate key error (code 11000).
    // Without this, concurrent signups with same email return 500 with raw
    // DB error message, leaking internal schema details to the caller.
    if (error.code === 11000 || error.name === 'MongoServerError') {
      res.status(409).json({ message: 'Email is already in use' });
      return;
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};
