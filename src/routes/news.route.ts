import { Router } from 'express';
import { createNews } from '../controllers/news.controller';

const newsRoutes = Router();

newsRoutes.post('/', createNews);

export default newsRoutes;
