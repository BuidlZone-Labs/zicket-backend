import { Router } from 'express';
import {
  createNews,
  getAllNews,
  getSingleNews,
  updateNews,
  deleteNewsById,
  hardDeleteNewsById,
  restoreNewsById,
  incrementReadCount,
} from '../controllers/news.controller';
import { anonymousActionLimiter } from '../middlewares/rateLimiter';
import { authGuard, adminGuard } from '../middlewares/auth';

const newsRoutes = Router();

newsRoutes.get('/', getAllNews);
newsRoutes.post('/', authGuard, adminGuard, createNews);

newsRoutes.patch('/:id', authGuard, adminGuard, updateNews);
newsRoutes.get('/:slug', getSingleNews);

newsRoutes.patch('/:id/read', anonymousActionLimiter, incrementReadCount);

// DELETE /api/news/:id - Soft delete a news article by ID
newsRoutes.delete('/:id', authGuard, adminGuard, deleteNewsById);

// DELETE /api/news/:id/permanent - Hard delete a news article by ID (requires soft delete first)
newsRoutes.delete('/:id/permanent', authGuard, adminGuard, hardDeleteNewsById);

// PATCH /api/news/:id/restore - Restore a soft-deleted news article
newsRoutes.patch('/:id/restore', authGuard, adminGuard, restoreNewsById);

export default newsRoutes;
