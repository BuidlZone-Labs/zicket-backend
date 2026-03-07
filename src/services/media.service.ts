import cloudinary from '../config/cloudinary';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

interface UploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

interface DestroyResult {
  result: string;
}

const UPLOAD_FOLDER = 'zicket';

export class MediaService {
  /**
   * Uploads a file buffer to Cloudinary.
   * Accepts an in-memory buffer (from multer) and streams it to Cloudinary.
   */
  static async upload(
    fileBuffer: Buffer,
    options?: {
      folder?: string;
      publicId?: string;
      transformation?: Record<string, unknown>;
    },
  ): Promise<UploadResult> {
    const folder = options?.folder
      ? `${UPLOAD_FOLDER}/${options.folder}`
      : UPLOAD_FOLDER;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: options?.publicId,
          resource_type: 'image',
          transformation: options?.transformation,
          overwrite: true,
        },
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined,
        ) => {
          if (error || !result) {
            return reject(
              new Error(error?.message || 'Cloudinary upload failed'),
            );
          }

          resolve({
            publicId: result.public_id,
            url: result.url,
            secureUrl: result.secure_url,
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
          });
        },
      );

      uploadStream.end(fileBuffer);
    });
  }

  /**
   * Invalidates the CDN cache for a given resource so the latest version is served.
   */
  static async invalidate(publicId: string): Promise<UploadResult> {
    try {
      const result = await cloudinary.uploader.explicit(publicId, {
        type: 'upload',
        invalidate: true,
      });

      return {
        publicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      };
    } catch (error) {
      throw new Error(
        `Failed to invalidate resource: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Permanently deletes a resource from Cloudinary by its public ID.
   */
  static async destroy(publicId: string): Promise<DestroyResult> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
      });

      if (result.result !== 'ok') {
        throw new Error(`Destroy returned status: ${result.result}`);
      }

      return { result: result.result };
    } catch (error) {
      throw new Error(
        `Failed to destroy resource: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Extracts the Cloudinary public ID from a full Cloudinary secure URL.
   * e.g. "https://res.cloudinary.com/demo/image/upload/v123/zicket/abc.jpg" -> "zicket/abc"
   */
  static extractPublicId(secureUrl: string): string | null {
    try {
      const regex = /\/upload\/(?:v\d+\/)?(.+)\.\w+$/;
      const match = secureUrl.match(regex);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}
