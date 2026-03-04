import { Router } from 'express';
import {
  deleteNewsById,
  hardDeleteNewsById,
  restoreNewsById,
} from '../controllers/news.controller';

const newsRoutes = Router();

// DELETE /api/news/:id - Soft delete a news article by ID
newsRoutes.delete('/:id', deleteNewsById);

// DELETE /api/news/:id/permanent - Hard delete a news article by ID (requires soft delete first)
newsRoutes.delete('/:id/permanent', hardDeleteNewsById);

// PATCH /api/news/:id/restore - Restore a soft-deleted news article
newsRoutes.patch('/:id/restore', restoreNewsById);

export default newsRoutes;
