import { Router } from 'express';
import { signupController } from '../controllers/signup.controller';
import { loginController } from '../controllers/login.controller';
import { resendOtpController } from '../controllers/resendotp.controller';

const authRoute = Router();

authRoute.post('/signup', signupController);
authRoute.post('/login', loginController);
authRoute.post('/resend-otp', resendOtpController);

export default authRoute;