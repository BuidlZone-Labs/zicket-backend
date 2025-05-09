import { Request, Response } from 'express';
import User from '../models/user';
import { generateOTP } from '../utils/otp';

export const resendOtpController = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const newOtp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        user.otp = newOtp;
        user.otpExpires = otpExpires;
        await user.save();

        res.status(200).json({ message: 'OTP resent successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};