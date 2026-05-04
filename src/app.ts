import express from 'express';
import protectedRoute from './routes/protected.route';
import otpRoute from './routes/otp.route';
import authRoute from './routes/auth.route';
import passport from './config/passport';
import { authLimiter } from './middlewares/rateLimiter';
import eventTicketRoutes from './routes/event-ticket.route';
import messageCenterRoutes from './routes/message-center.route';
import newsRoutes from './routes/news.route';
import mediaRoutes from './routes/media.route';
import ticketOrderRoutes from './routes/ticket-order.route';
import queueMonitorRoutes from './routes/queue-monitor.route';
import zkEmailRoutes from './routes/zkemail.route';
import { globalErrorHandler } from './middlewares/errorHandler';

const app = express();

app.set('trust proxy', 1);

app.use(express.json());

app.use(passport.initialize());

app.get('/', (req, res) => {
  res.send('Welcome to Zicket API');
});

// Health check endpoint (Issue #97)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'zicket-backend',
  });
});

app.use('/auth', authLimiter);

app.use('/auth', authRoute);
app.use('/auth', otpRoute);
app.use('/event-tickets', eventTicketRoutes);
app.use('/media', mediaRoutes);
app.use('/zk-message-center', messageCenterRoutes);
app.use('/news', newsRoutes);
app.use('/ticket-orders', ticketOrderRoutes);
app.use('/api', queueMonitorRoutes);
app.use('/zkemail', authLimiter, zkEmailRoutes);
app.use(protectedRoute);

app.use(globalErrorHandler);

export default app; 