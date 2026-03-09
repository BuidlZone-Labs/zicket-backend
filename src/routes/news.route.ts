import { Router } from 'express';
import {
  createNews,
  getAllNews,
  getSingleNews,
  updateNews,
} from '../controllers/news.controller';

const newsRoutes = Router();

newsRoutes.get('/', getAllNews);
newsRoutes.post('/', createNews);
newsRoutes.patch('/:id', updateNews);
newsRoutes.get('/:slug', getSingleNews);

export default newsRoutes;
