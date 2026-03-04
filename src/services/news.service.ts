import mongoose from 'mongoose';
import News, { INews } from '../models/news';

export interface NewsResponse {
  id: string;
  title: string;
  content: string;
  category: string;
  imageUrl?: string;
  publishAvatarUrl?: string;
  publishedBy?: string;
  readCount: number;
  timeSpentReading?: number;
  deviceStats?: { [deviceType: string]: number };
  createdAt?: Date;
  updatedAt?: Date;
}

export class NewsService {
  private static transformNews(news: INews): NewsResponse {
    return {
      id: news._id.toString(),
      title: news.title,
      content: news.content,
      category: news.category,
      imageUrl: news.imageUrl,
      publishAvatarUrl: news.publishAvatarUrl,
      publishedBy: news.publishedBy,
      readCount: news.readCount || 0,
      timeSpentReading: news.timeSpentReading,
      deviceStats: news.deviceStats,
      createdAt: news.createdAt,
      updatedAt: news.updatedAt,
    };
  }

  static async incrementReadCount(
    newsId: string,
  ): Promise<NewsResponse | null> {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const news = await News.findByIdAndUpdate(
        newsId,
        { $inc: { readCount: 1 } },
        { new: true, session },
      );
      if (!news) {
        await session.abortTransaction();
        return null;
      }
      await session.commitTransaction();
      return this.transformNews(news);
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }
}
