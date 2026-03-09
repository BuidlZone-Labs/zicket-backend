import mongoose, { ClientSession } from 'mongoose';
import News, { INews } from '../models/news';
import { CreateNewsInput, UpdateNewsInput } from '../validators/news.validator';

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface DeleteResult {
  success: boolean;
  message: string;
  newsId: string;
  deletedAt?: Date;
}

// Internal helper for image uploads
async function uploadImage(file: string): Promise<string> {
  // return MediaUploadService.upload(file);
  throw new Error('MediaUploadService is not yet available (pending PR #43).');
}

export class NewsService {
  
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
  
  static async getSingleNewsBySlug(slug: string): Promise<INews | null> {
    return News.findOne({ slug });
  }
  
  /**
   * Updates an existing news article by ID.
   */
  static async updateNews(
    id: string,
    data: UpdateNewsInput,
    imageFile?: string,
    imageUrl?: string,
  ): Promise<INews> {
    const session = await mongoose.startSession();

    try {
      let updatedNews: INews | null = null;

      await session.withTransaction(async () => {
        let resolvedImageUrl: string | undefined | null = imageUrl;

        if (imageFile) {
          resolvedImageUrl = await uploadImage(imageFile);
        }

        const updatePayload: Partial<INews> = {};

        if (data.title !== undefined) updatePayload.title = data.title;
        if (data.content !== undefined) updatePayload.content = data.content;
        if (data.category !== undefined) updatePayload.category = data.category;

        if (data.publishAvatarUrl !== undefined) {
          updatePayload.publishAvatarUrl = data.publishAvatarUrl ?? undefined;
        }

        if (data.publishedBy !== undefined) {
          updatePayload.publishedBy = data.publishedBy ?? undefined;
        }

        if (resolvedImageUrl !== undefined) {
          updatePayload.imageUrl = resolvedImageUrl ?? undefined;
        }

        updatedNews = await News.findByIdAndUpdate(
          id,
          { $set: updatePayload },
          {
            new: true,
            runValidators: true,
            session,
          },
        );

        if (!updatedNews) {
          throw new NewsNotFoundError(id);
        }
      });

      return updatedNews!;
    } finally {
      await session.endSession();
    }
  }

  /**  * Retrieves all news articles with pagination and optional filtering.
   *
   * @param page - Page number (default: 1)
   * @param limit - Number of results per page (default: 10, max: 100)
   * @param category - Optional category filter
   * @param sortBy - Sort field (default: 'createdAt')
   * @param sortOrder - Sort order 'asc' or 'desc' (default: 'desc')
   */
  static async getAllNews(
    page: number = 1,
    limit: number = 10,
    category?: string,
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<PaginatedResult<INews>> {
    // Validate pagination parameters
    const validPage = Math.max(1, page);
    const validLimit = Math.min(100, Math.max(1, limit));
    const skip = (validPage - 1) * validLimit;

    // Build filter query
    const filter: any = {};
    if (category && category.trim() !== '') {
      filter.category = new RegExp(category, 'i'); // case-insensitive search
    }

    // Build sort object
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [data, total] = await Promise.all([
      News.find(filter).sort(sort).skip(skip).limit(validLimit).exec(),
      News.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / validLimit);

    return {
      data,
      total,
      page: validPage,
      limit: validLimit,
      pages,
    };
  }
  
  
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


/** Typed error thrown when a news article cannot be found. */
export class NewsNotFoundError extends Error {
  constructor(id: string) {
    super(`News article with ID "${id}" not found`);
    this.name = 'NewsNotFoundError';
  }
}
