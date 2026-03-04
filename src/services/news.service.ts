import mongoose, { ClientSession } from 'mongoose';
import News, { INews } from '../models/news';

export interface DeleteResult {
  success: boolean;
  message: string;
  newsId: string;
  deletedAt?: Date;
}

export class NewsService {
  /**
   * Soft deletes a news article by ID using a transaction
   * @param id - The news article ID to delete
   * @returns Promise<DeleteResult>
   */
  static async deleteNewsById(id: string): Promise<DeleteResult> {
    // Validate ID format before starting transaction
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid news ID format');
    }

    const session: ClientSession = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find the news article within the transaction
      const news = await News.findById(id).session(session);

      if (!news) {
        throw new Error('News article not found');
      }

      // Check if already deleted
      if (news.isDeleted) {
        throw new Error('News article has already been deleted');
      }

      // Perform soft delete within the transaction
      const deletedAt = new Date();
      const updatedNews = await News.findByIdAndUpdate(
        id,
        {
          isDeleted: true,
          deletedAt,
        },
        { new: true, session },
      );

      if (!updatedNews) {
        throw new Error('Failed to soft delete news article');
      }

      // Commit the transaction
      await session.commitTransaction();

      return {
        success: true,
        message: 'News article soft deleted successfully',
        newsId: id,
        deletedAt,
      };
    } catch (error) {
      // Abort the transaction on error
      await session.abortTransaction();

      throw new Error(
        `Failed to delete news article: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      // End the session
      await session.endSession();
    }
  }

  /**
   * Hard deletes a news article by ID using a transaction
   * Only to be used after soft delete or for admin cleanup
   * @param id - The news article ID to permanently delete
   * @param force - If true, skips soft delete check (use with caution)
   * @returns Promise<DeleteResult>
   */
  static async hardDeleteNewsById(
    id: string,
    force: boolean = false,
  ): Promise<DeleteResult> {
    // Validate ID format before starting transaction
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid news ID format');
    }

    const session: ClientSession = await mongoose.startSession();
    session.startTransaction();

    try {

      // Find the news article within the transaction
      const news = await News.findById(id).session(session);

      if (!news) {
        throw new Error('News article not found');
      }

      // Safety check: ensure news is soft deleted first (unless force=true)
      if (!force && !news.isDeleted) {
        throw new Error(
          'News article must be soft deleted before hard deletion. Use soft delete first.',
        );
      }

      // Perform hard delete within the transaction
      const result = await News.findByIdAndDelete(id).session(session);

      if (!result) {
        throw new Error('Failed to hard delete news article');
      }

      // Commit the transaction
      await session.commitTransaction();

      return {
        success: true,
        message: 'News article permanently deleted',
        newsId: id,
      };
    } catch (error) {
      // Abort the transaction on error
      await session.abortTransaction();

      throw new Error(
        `Failed to hard delete news article: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      // End the session
      await session.endSession();
    }
  }

  /**
   * Restores a soft-deleted news article
   * @param id - The news article ID to restore
   * @returns Promise<DeleteResult>
   */
  static async restoreNewsById(id: string): Promise<DeleteResult> {
    // Validate ID format before starting transaction
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid news ID format');
    }

    const session: ClientSession = await mongoose.startSession();
    session.startTransaction();

    try {

      // Find the news article within the transaction
      const news = await News.findById(id).session(session);

      if (!news) {
        throw new Error('News article not found');
      }

      // Check if not deleted
      if (!news.isDeleted) {
        throw new Error('News article is not deleted');
      }

      // Restore the news article within the transaction
      const updatedNews = await News.findByIdAndUpdate(
        id,
        {
          isDeleted: false,
          deletedAt: undefined,
        },
        { new: true, session },
      );

      if (!updatedNews) {
        throw new Error('Failed to restore news article');
      }

      // Commit the transaction
      await session.commitTransaction();

      return {
        success: true,
        message: 'News article restored successfully',
        newsId: id,
      };
    } catch (error) {
      // Abort the transaction on error
      await session.abortTransaction();

      throw new Error(
        `Failed to restore news article: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      // End the session
      await session.endSession();
    }
  }
}
