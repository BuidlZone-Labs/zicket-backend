import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
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
import indexerRoutes from './routes/indexer.route';
import privacyComplianceRoutes from './routes/privacy-compliance.route';
import accountRoutes from './routes/account.route';
import verifyAttendRoutes from './routes/verify-attend.route';
import developerRoutes from './routes/developer.route';
import healthRoutes from './routes/health.route';
import swaggerSpec from './config/swagger';
import { globalErrorHandler } from './middlewares/errorHandler';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());

const corsOptions: cors.CorsOptions = {
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json());

app.use(passport.initialize());

app.get('/', (req, res) => {
  res.send('Welcome to Zicket API');
});

// Swagger UI documentation endpoint
app.use('/api/docs', swaggerUi.serve);
app.get('/api/docs', swaggerUi.setup(swaggerSpec, { explorer: true }));

// Health check endpoint - comprehensive metrics
app.use('/health', healthRoutes);

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
app.use('/api/events', indexerRoutes);
app.use('/compliance', privacyComplianceRoutes);
app.use('/account', accountRoutes);
app.use('/events', verifyAttendRoutes);

// BR-09 / Section 12 — public developer infrastructure API.
// Auth is per-request via X-Zicket-API-Key (developerAuthGuard), not JWT.
app.use('/api/v1/developer', developerRoutes);

app.use(protectedRoute);

app.use(globalErrorHandler);

export default app;
