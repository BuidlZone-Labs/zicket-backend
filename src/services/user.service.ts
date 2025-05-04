import User from '../models/user';
import { generateOTP } from '../utils/otp';

class UserService {
    constructor() {}

    static async updateUserOtp(user: any, id?: string)  {
        const OTP_EXPIRATION = 10 * 60 * 1000; // 10 minutes
        try {
            if (id) {
                const user = await User.findById(id);
                if (!user) {
                    throw new Error('User not found');
                }
            } else {
                const otp = generateOTP();
                const otpExpiration = Date.now() + OTP_EXPIRATION;
                user.otp = otp;
                user.otpExpires = otpExpiration;
                await user.save();
            }
            return user;
        } catch (error: any) {
            throw new Error(`Error updating user: ${error.message}`);
        }
    }
}

export default UserService;
