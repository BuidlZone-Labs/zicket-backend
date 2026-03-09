import News, { INews } from '../models/news';
import { CreateNewsInput } from '../validators/news.validator';

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

async function uploadImage(file: string): Promise<string> {
  // return MediaUploadService.upload(file);
  throw new Error('MediaUploadService is not yet available (pending PR #43). ');
}

export class NewsroomService {
  /**
   * Creates a news article.
   *
   * @param data
   * @param imageFile
   * @param imageUrl
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
   * Retrieves all news articles with pagination and optional filtering.
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
}

export class NewsService {
  static async getSingleNewsBySlug(slug: string): Promise<INews | null> {
    return News.findOne({ slug });
  }
}
