import News, { INews } from '../models/news';
import { CreateNewsInput } from '../validators/news.validator';

async function uploadImage(file: string): Promise<string> {
    // return MediaUploadService.upload(file);
    throw new Error(
        'MediaUploadService is not yet available (pending PR #43). '
    );
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
}