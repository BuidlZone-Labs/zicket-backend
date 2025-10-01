import express from 'express';
import { signupController } from '../controllers/signup.controller';
import { loginController } from '../controllers/login.controller';
import { resendOtpController } from '../controllers/resendotp.controller';
import passport from 'passport';
import { generateToken } from '../config/passport';
import dotenv from 'dotenv';
import { getLimiter } from '../middlewares/rateLimiter';

dotenv.config();

const authRoute = express.Router();

authRoute.post('/signup', 
  getLimiter('signup'), 
  signupController
);

authRoute.post('/login', 
  getLimiter('login'), 
  loginController
);

authRoute.post('/resend-otp',
  getLimiter('otp'),
  resendOtpController
);

authRoute.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

authRoute.get('/google/callback', 
    passport.authenticate('google', { 
        failureRedirect: '/auth/login', 
        session: false 
    }),
    (req, res) => {
        const token = generateToken(req.user);
        
        // Redirect to frontend with token
        res.redirect(`${process.env.FRONTEND_URL}/oauth?token=${token}`);
        
        // Send token in response body
        // res.status(200).json({ token });
    }
);


export default authRoute;