import express from 'express';
import protectedRoute from './routes/protected.route';
import otpRoute from './routes/otp.route';
import authRoute from './routes/auth.route';
import passport from './config/passport';
import { authLimiter } from './middlewares/rateLimiter';
import eventTicketRoutes from './routes/event-ticket.route';
import messageCenterRoutes from './routes/message-center.route';
import mediaRoutes from './routes/media.route';

const app = express();

app.set('trust proxy', 1);

app.use(express.json());

app.use(passport.initialize());

app.get('/', (req, res) => {
  res.send('Welcome to Zicket API');
});

app.use('/auth', authLimiter);

app.use('/auth', authRoute);
app.use('/auth', otpRoute);
app.use('/event-tickets', eventTicketRoutes);
app.use('/media', mediaRoutes);
app.use('/zk-message-center', messageCenterRoutes);
app.use(protectedRoute);

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (err.status === 429) {
      return res.status(429).json({
        error: 'Too many requests',
        message: err.message || 'Rate limit exceeded',
        retryAfter: err.retryAfter || 60,
      });
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Image must be less than 5MB',
      });
    }

    if (
      err.message &&
      /Unsupported file type|Invalid image type/.test(err.message)
    ) {
      return res.status(400).json({
        error: 'Validation failed',
        message: err.message,
      });
    }

    console.error('Server error:', err);
    res.status(err.status || 500).json({
      error: 'Internal server error',
    });
  },
);

export default app;
