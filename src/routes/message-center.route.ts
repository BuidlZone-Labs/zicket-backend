import Router from 'express';
import {
  sendMessage,
  getPastMessages,
  getScheduledMessages,
  editMessage,
  deleteMessage
} from '../controllers/message-center.controller';
import { authGuard } from '../middlewares/auth';

const messageCenterRoutes = Router();

messageCenterRoutes.delete('/:messageId', authGuard, deleteMessage);
messageCenterRoutes.post('/', authGuard, sendMessage);
messageCenterRoutes.get('/past', authGuard, getPastMessages);
messageCenterRoutes.get('/scheduled', authGuard, getScheduledMessages);
messageCenterRoutes.patch('/:messageId', authGuard, editMessage);

messageCenterRoutes.get('/past', authGuard, getPastMessages);
messageCenterRoutes.get('/scheduled', authGuard, getScheduledMessages);

export default messageCenterRoutes;
