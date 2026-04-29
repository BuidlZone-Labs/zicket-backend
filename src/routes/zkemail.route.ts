import { Router } from 'express';
import { zkEmailHookController } from '../controllers/zkemail.controller';

const zkEmailRoutes = Router();

zkEmailRoutes.post('/hook', zkEmailHookController);

export default zkEmailRoutes;
