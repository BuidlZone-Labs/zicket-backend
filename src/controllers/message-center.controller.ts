import { RequestHandler } from 'express';
import MessageCenterService from '../services/message-center.service';

export const deleteMessageController: RequestHandler = async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      res.status(400).json({ message: 'messageId param is required' });
      return;
    }

    await MessageCenterService.deleteMessage(messageId as string);

    res.status(200).json({ message: 'Message deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Message not found') {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error('Error in deleteMessageController:', error.message);
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
};
