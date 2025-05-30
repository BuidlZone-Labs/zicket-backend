import { RequestHandler } from 'express';
import User from '../models/user';
import { generateOTP } from '../utils/otp';

export const resendOtpController: RequestHandler = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ message: 'Email is required' });
            return;
        }

        const user = await User.findOne({ email });
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        const newOtp = generateOTP();
        const otpExpires = Date.now() + 10 * 60 * 1000;

        user.otp = newOtp;
        user.otpExpires = new Date(otpExpires).getTime();;
        await user.save();

        res.status(200).json({ message: 'OTP resent successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};