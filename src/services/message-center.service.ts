import mongoose from 'mongoose';
import MessageCenter, { IMessageCenter } from '../models/message-center';

export interface CreateMessagePayload {
  audience: string[];
  title: string;
  content: string;
  scheduledAt?: string;
}

export interface MessageCenterResponse {
  id: string;
  title: string;
  content: string;
  audience: string[];
  status: 'sent' | 'pending' | 'failed';
  sentAt?: Date;
  scheduledAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PaginatedMessageCenterResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  messages: MessageCenterResponse[];
}

export class MessageCenterService {
  private static readonly PAGE_LIMIT = 5;

  private static transformMessage(
    message: IMessageCenter,
  ): MessageCenterResponse {
    return {
      id: message._id.toString(),
      title: message.title,
      content: message.content,
      audience: message.audience,
      status: message.status,
      sentAt: message.sentAt,
      scheduledAt: message.scheduledAt,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  private static async getPaginatedMessages(
    filter: Record<string, unknown>,
    sort: Record<string, 1 | -1>,
    page: number,
  ): Promise<PaginatedMessageCenterResponse> {
    const validPage = Math.max(1, page);
    const skip = (validPage - 1) * this.PAGE_LIMIT;

    const [messages, total] = await Promise.all([
      MessageCenter.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(this.PAGE_LIMIT)
        .lean(),
      MessageCenter.countDocuments(filter),
    ]);

    const transformedMessages = messages.map((message: any) =>
      this.transformMessage(message as IMessageCenter),
    );

    return {
      page: validPage,
      limit: this.PAGE_LIMIT,
      total,
      totalPages: Math.ceil(total / this.PAGE_LIMIT),
      messages: transformedMessages,
    };
  }

  static async getPastMessages(
    page: number = 1,
  ): Promise<PaginatedMessageCenterResponse> {
    const now = new Date();

    const filter = {
      $or: [{ status: 'sent' }, { sentAt: { $lte: now } }],
    };

    return this.getPaginatedMessages(
      filter,
      { sentAt: -1, createdAt: -1 },
      page,
    );
  }

  static async getScheduledMessages(
    page: number = 1,
  ): Promise<PaginatedMessageCenterResponse> {
    const now = new Date();

    const filter = {
      status: 'pending',
      scheduledAt: { $gt: now },
    };

    return this.getPaginatedMessages(
      filter,
      { scheduledAt: 1, createdAt: 1 },
      page,
    );
  }

  /**
   * Creates a new message within a MongoDB transaction so that failures roll back safely.
   */
  static async createMessage(
    payload: CreateMessagePayload,
  ): Promise<MessageCenterResponse> {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const scheduledAt = payload.scheduledAt
        ? new Date(payload.scheduledAt)
        : undefined;
      const [doc] = await MessageCenter.create(
        [
          {
            title: payload.title,
            content: payload.content,
            audience: payload.audience,
            status: 'pending',
            scheduledAt,
          },
        ],
        { session },
      );
      await session.commitTransaction();
      return this.transformMessage(doc);
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }
}
