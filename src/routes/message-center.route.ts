import Router from 'express';
import {
  sendMessage,
  getPastMessages,
  getScheduledMessages,
  editMessage,
  deleteMessage,
} from '../controllers/message-center.controller';
import { authGuard, adminGuard } from '../middlewares/auth';

const messageCenterRoutes = Router();

messageCenterRoutes.post('/', authGuard, adminGuard, sendMessage);
messageCenterRoutes.delete('/:messageId', authGuard, adminGuard, deleteMessage);
messageCenterRoutes.get('/past', authGuard, adminGuard, getPastMessages);
messageCenterRoutes.get(
  '/scheduled',
  authGuard,
  adminGuard,
  getScheduledMessages,
);
messageCenterRoutes.patch('/:messageId', authGuard, adminGuard, editMessage);

export default messageCenterRoutes;
