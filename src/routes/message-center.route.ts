import express from 'express';
import { deleteMessageController } from '../controllers/message-center.controller';
import passport from 'passport';

const messageCenterRoute = express.Router();

messageCenterRoute.delete(
  '/:messageId',
  passport.authenticate('jwt', { session: false }),
  deleteMessageController,
);

export default messageCenterRoute;
