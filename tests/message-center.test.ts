import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import MessageCenter from '../src/models/message-center';
import { MessageCenterService } from '../src/services/message-center.service';

// --- Unit Tests: MessageCenterService ---

describe('MessageCenterService', () => {
  describe('deleteMessage', () => {
    it('should delete a message and return it', async () => {
      const mockMessage = { _id: 'abc123', title: 'Test' };
      jest
        .spyOn(MessageCenter, 'findByIdAndDelete')
        .mockResolvedValueOnce(mockMessage as any);

      const result = await MessageCenterService.deleteMessage('abc123');
      expect(MessageCenter.findByIdAndDelete).toHaveBeenCalledWith('abc123');
      expect(result).toEqual(mockMessage);
    });

    it('should throw "Message not found" when no document is found', async () => {
      jest
        .spyOn(MessageCenter, 'findByIdAndDelete')
        .mockResolvedValueOnce(null);

      await expect(
        MessageCenterService.deleteMessage('nonexistent-id'),
      ).rejects.toThrow('Message not found');
    });
  });
});
