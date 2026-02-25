import express from 'express';
import { deleteMessageController } from '../controllers/message-center.controller';
import {
  getPastMessages,
  getScheduledMessages,
} from '../controllers/message-center.controller';
import { authGuard } from '../middlewares/auth';

const messageCenterRoute = express.Router();

messageCenterRoute.delete('/:messageId', authGuard, deleteMessageController);

messageCenterRoute.get('/past', authGuard, getPastMessages);
messageCenterRoute.get('/scheduled', authGuard, getScheduledMessages);

export default messageCenterRoute;
