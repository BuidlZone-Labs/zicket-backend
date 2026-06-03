import { Router } from 'express';
import { getEvents } from '../controllers/indexer.controller';

const router = Router();

// GET /api/events
router.get('/', getEvents);

export default router;
