import MessageCenter from '../models/message-center';

class MessageCenterService {
  static async deleteMessage(messageId: string) {
    const message = await MessageCenter.findByIdAndDelete(messageId);
    if (!message) {
      throw new Error('Message not found');
    }
    return message;
  }
}

export default MessageCenterService;
