import mongoose from 'mongoose';
import News, { INews } from '../models/news';
import { CreateNewsInput, UpdateNewsInput } from '../validators/news.validator';

async function uploadImage(file: string): Promise<string> {
  // return MediaUploadService.upload(file);
  throw new Error('MediaUploadService is not yet available (pending PR #43).');
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
}

/** Typed error thrown when a news article cannot be found. */
export class NewsNotFoundError extends Error {
  constructor(id: string) {
    super(`News article with ID "${id}" not found`);
    this.name = 'NewsNotFoundError';
  }
}
