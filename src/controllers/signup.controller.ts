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
    // Validate and parse with Zod before any database query.
    // Prevents NoSQL injection via MongoDB query operators in email/password fields.
    const parsed = SignupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: 'Invalid request',
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { name, email, password } = parsed.data;

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
    res.status(500).json({ message: error.message });
  }
};
