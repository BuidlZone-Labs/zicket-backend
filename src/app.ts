import express from 'express';
import protectedRoute from './routes/protected.route';
import otpRoute from './routes/otp.route';
import authRoute from './routes/auth.route';
import passport from './config/passport';

const app = express();
app.use(express.json());
app.use(passport.initialize());

app.get('/', (req, res) => {
    res.send('Welcome to Zicket API');
});

app.use('/auth', authRoute);
app.use('/auth', otpRoute);
app.use(protectedRoute);

export default app;
