import express from 'express';
import protectedRoute from './routes/protected.route';
import otpRoute from './routes/otp.route';
import authRoute from './routes/auth.route';
import passport from './config/passport';
import { authLimiter } from './middlewares/rateLimiter';
import eventTicketRoutes from './routes/event-ticket.route';
import messageCenterRoutes from './routes/message-center.route';

const app = express();

// Trust first proxy for accurate IP addresses
app.set('trust proxy', 1);

// Body parsing middleware
app.use(express.json());

// Passport initialization
app.use(passport.initialize());

// Welcome route (no rate limiting needed)
app.get('/', (req, res) => {
  res.send('Welcome to Zicket API');
});

// Apply general rate limiter to auth routes
app.use('/auth', authLimiter);

// Routes
app.use('/auth', authRoute);
app.use('/auth', otpRoute);
app.use('/event-tickets', eventTicketRoutes);
app.use('/zk-message-center', messageCenterRoutes);
app.use(protectedRoute);

// Global error handler for rate limiting
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    // Handle rate limit errors
    if (err.status === 429) {
      return res.status(429).json({
        error: 'Too many requests',
        message: err.message || 'Rate limit exceeded',
        retryAfter: err.retryAfter || 60,
      });
    }

    // Handle other errors
    console.error('Server error:', err);
    res.status(err.status || 500).json({
      error: 'Internal server error',
    });
  },
);

export default app;
