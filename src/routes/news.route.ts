import { Router } from 'express';
import { incrementReadCount } from '../controllers/news.controller';

const newsRoute = Router();

newsRoute.patch('/news/:id/read', incrementReadCount);

export default newsRoute;
