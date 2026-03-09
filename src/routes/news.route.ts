import { Router } from 'express';
import {
  createNews,
  getAllNews,
  getSingleNews,
} from '../controllers/news.controller';

const newsRoutes = Router();

newsRoutes.get('/', getAllNews);
newsRoutes.post('/', createNews);
newsRoutes.get('/:slug', getSingleNews);

export default newsRoutes;
