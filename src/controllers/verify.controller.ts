import { RequestHandler } from 'express';
import User from '../models/user';

export const verifyAccountController: RequestHandler = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || otp === undefined || otp === null) {
      res.status(400).json({ message: 'Email and OTP are required' });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (user.otp === undefined || user.otp === null) {
      res
        .status(400)
        .json({ message: 'No pending verification for this account' });
      return;
    }

    const otpNumber = typeof otp === 'string' ? parseInt(otp, 10) : otp;
    if (Number.isNaN(otpNumber) || user.otp !== otpNumber) {
      res.status(400).json({ message: 'Invalid OTP' });
      return;
    }

    if (user.otpExpires && new Date() > user.otpExpires) {
      res.status(400).json({ message: 'OTP has expired' });
      return;
    }

    user.otp = undefined;
    user.otpExpires = undefined;
    user.emailVerifiedAt = new Date();
    await user.save();

    res.status(200).json({ message: 'Account verified successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
