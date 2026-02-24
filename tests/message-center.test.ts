import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import MessageCenter from '../src/models/message-center';
import MessageCenterService from '../src/services/message-center.service';

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

// --- Integration Tests: DELETE /message-center/:messageId ---

describe('DELETE /message-center/:messageId', () => {
    let validToken: string;
    let messageId: string;

    beforeAll(async () => {
        // Obtain a valid JWT token (adjust to match your auth flow)
        const loginRes = await request(app).post('/auth/login').send({
            email: process.env.TEST_USER_EMAIL || 'test@example.com',
            password: process.env.TEST_USER_PASSWORD || 'password123',
        });
        validToken = loginRes.body.token;

        // Seed a message for deletion
        const message = await MessageCenter.create({
            title: 'Integration Test Message',
            content: 'Some content',
            audience: ['all'],
            status: 'pending',
        });
        messageId = (message._id as mongoose.Types.ObjectId).toString();
    });

    afterAll(async () => {
        await MessageCenter.deleteMany({ title: 'Integration Test Message' });
    });

    it('should return 401 when no auth token is provided', async () => {
        const res = await request(app).delete(`/message-center/${messageId}`);
        expect(res.status).toBe(401);
    });

    it('should return 404 when messageId does not exist', async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await request(app)
            .delete(`/message-center/${fakeId}`)
            .set('Authorization', `Bearer ${validToken}`);
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Message not found');
    });

    it('should delete the message and return 200', async () => {
        const res = await request(app)
            .delete(`/message-center/${messageId}`)
            .set('Authorization', `Bearer ${validToken}`);
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Message deleted successfully');

        // Confirm it's gone from the DB
        const found = await MessageCenter.findById(messageId);
        expect(found).toBeNull();
    });
});