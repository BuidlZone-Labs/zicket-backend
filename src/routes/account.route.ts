import { Router } from 'express';
import {
  getErasureAssessment,
  requestErasure,
} from '../controllers/account.controller';
import { authGuard } from '../middlewares/auth';

const accountRoutes = Router();

accountRoutes.get('/erasure-assessment', authGuard, getErasureAssessment);
accountRoutes.post('/request-erasure', authGuard, requestErasure);

export default accountRoutes;
