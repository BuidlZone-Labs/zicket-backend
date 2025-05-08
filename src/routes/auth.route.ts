import { Router } from 'express';
import { signupController } from '../controllers/signup.controller';
import { loginController } from '../controllers/login.controller';

const authRoute = Router();

authRoute.post('/signup', signupController);
authRoute.post('/login', loginController);

export default authRoute;