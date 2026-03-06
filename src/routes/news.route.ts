import { Router } from 'express';
import { createNews, updateNews } from '../controllers/news.controller';

const newsRoutes = Router();

newsRoutes.post('/', createNews);
newsRoutes.patch('/:id', updateNews);

export default newsRoutes;
