import { Request, RequestHandler, Response } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/user';
import { generateOTP } from '../utils/otp';
import emailService from '../services/email.service';

const OTP_EXPIRY_MINUTES = 10;

export const signupController: RequestHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ message: 'All fields are required' });
      return;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: 'Email is already in use' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      provider: 'local',
      otp,
      otpExpires,
    });
    await newUser.save();

    try {
      await emailService.sendVerificationOtp(email, otp);
    } catch (emailError: any) {
      console.error(
        'Failed to send verification OTP email:',
        emailError?.message,
      );
      // User is created; they can use resend-otp if they didn't receive it
    }

    res.status(201).json({
      message:
        'User registered successfully. Please verify your account with the OTP sent to your email.',
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
