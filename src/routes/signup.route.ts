import { Router } from 'express';
import { signupController } from '../controllers/auth.controller';

const authRoute = Router();

authRoute.post('/signup', signupController);

export default authRoute;