import { Request, Response } from "express";
import User from "../models/user";

export const otpVerificationController = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            res.status(404).json({ message: "Unable to process!" });
            return;
        }
        if (user.otp !== otp) {
            res.status(400).json({ message: "Invalid OTP" });
            return;
        }
        const currentTime = new Date();
        if (user.otpExpires && currentTime > user.otpExpires) {
            res.status(400).json({ message: "OTP has expired" });
            return;
        }
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();
        res.status(200).json({ message: "OTP verified successfully" });
        return;
    } catch (error: any) {
        res.status(500).json({ message: error.message });
        return;
    }
}
