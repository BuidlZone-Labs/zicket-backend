import { Router } from 'express';
import { createNews, getAllNews } from '../controllers/news.controller';

const newsRoutes = Router();

newsRoutes.get('/', getAllNews);
newsRoutes.post('/', createNews);

export default newsRoutes;
