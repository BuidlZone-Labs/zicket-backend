import { Router } from 'express';
import {
  getErasureAssessment,
  requestErasure,
} from '../controllers/account.controller';
import { authGuardIdentity } from '../middlewares/auth';

const accountRoutes = Router();

accountRoutes.get(
  '/erasure-assessment',
  authGuardIdentity,
  getErasureAssessment,
);
accountRoutes.post('/request-erasure', authGuardIdentity, requestErasure);

export default accountRoutes;
