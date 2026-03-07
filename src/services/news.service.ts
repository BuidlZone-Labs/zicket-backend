import mongoose, { ClientSession } from 'mongoose';
import News, { INews } from '../models/news';
import { CreateNewsInput } from '../validators/news.validator';

export interface DeleteResult {
  success: boolean;
  message: string;
  newsId: string;
  deletedAt?: Date;
}

// Internal helper for image uploads
async function uploadImage(file: string): Promise<string> {
  // return MediaUploadService.upload(file);
  throw new Error('MediaUploadService is not yet available (pending PR #43). ');
}

export class NewsService {
  /**
   * Soft deletes a news article by ID using a transaction
   */
  static async deleteNewsById(id: string): Promise<DeleteResult> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid news ID format');
    }

    const session: ClientSession = await mongoose.startSession();
    session.startTransaction();

    try {
      const news = await News.findById(id).session(session);

      if (!news) {
        throw new Error('News article not found');
      }

      if (news.isDeleted) {
        throw new Error('News article has already been deleted');
      }

      const deletedAt = new Date();
      const updatedNews = await News.findByIdAndUpdate(
        id,
        { isDeleted: true, deletedAt },
        { new: true, session },
      );

      if (!updatedNews) {
        throw new Error('Failed to soft delete news article');
      }

      await session.commitTransaction();

      return {
        success: true,
        message: 'News article soft deleted successfully',
        newsId: id,
        deletedAt,
      };
    } catch (error) {
      await session.abortTransaction();
      throw new Error(
        `Failed to delete news article: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      await session.endSession();
    }
  }

  /**
   * Hard deletes a news article by ID using a transaction
   */
  static async hardDeleteNewsById(
    id: string,
    force: boolean = false,
  ): Promise<DeleteResult> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid news ID format');
    }

    const session: ClientSession = await mongoose.startSession();
    session.startTransaction();

    try {
      const news = await News.findById(id).session(session);

      if (!news) {
        throw new Error('News article not found');
      }

      if (!force && !news.isDeleted) {
        throw new Error('News article must be soft deleted before hard deletion.');
      }

      const result = await News.findByIdAndDelete(id).session(session);

      if (!result) {
        throw new Error('Failed to hard delete news article');
      }

      await session.commitTransaction();

      return {
        success: true,
        message: 'News article permanently deleted',
        newsId: id,
      };
    } catch (error) {
      await session.abortTransaction();
      throw new Error(
        `Failed to hard delete news article: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      await session.endSession();
    }
  }

  /**
   * Restores a soft-deleted news article
   */
  static async restoreNewsById(id: string): Promise<DeleteResult> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid news ID format');
    }

    const session: ClientSession = await mongoose.startSession();
    session.startTransaction();

    try {
      const news = await News.findById(id).session(session);

      if (!news) {
        throw new Error('News article not found');
      }

      if (!news.isDeleted) {
        throw new Error('News article is not deleted');
      }

      const updatedNews = await News.findByIdAndUpdate(
        id,
        { isDeleted: false, deletedAt: undefined },
        { new: true, session },
      );

      if (!updatedNews) {
        throw new Error('Failed to restore news article');
      }

      await session.commitTransaction();

      return {
        success: true,
        message: 'News article restored successfully',
        newsId: id,
      };
    } catch (error) {
      await session.abortTransaction();
      throw new Error(
        `Failed to restore news article: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      await session.endSession();
    }
  }
}

export class NewsroomService {
  /**
   * Creates a news article.
   */
  static async createNews(
    data: CreateNewsInput,
    imageFile?: string,
    imageUrl?: string,
  ): Promise<INews> {
    let resolvedImageUrl: string | undefined = imageUrl;

    if (imageFile) {
      resolvedImageUrl = await uploadImage(imageFile);
    }

    const news = new News({
      ...data,
      imageUrl: resolvedImageUrl,
    });

    return news.save();
  }
}