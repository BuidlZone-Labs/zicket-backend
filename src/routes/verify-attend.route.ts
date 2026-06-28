import { Router } from 'express';
import { verifyAttend } from '../controllers/verify-attend.controller';
import { anonClaimLimiter } from '../middlewares/anonClaimLimiter';

const verifyAttendRoutes = Router();

// POST /events/:id/verify-attend — no JWT; verified-anonymous attendance path (#121)
verifyAttendRoutes.post('/:id/verify-attend', anonClaimLimiter, verifyAttend);

export default verifyAttendRoutes;
