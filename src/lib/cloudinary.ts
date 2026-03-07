import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import config from '../config/config';

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

const UPLOAD_FOLDER = 'zicket';

export type TicketImageFolder = 'events/tickets';

export interface UploadTicketImageResult {
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

export interface SignedUploadParams {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  uploadUrl: string;
}

/**
 * Cloudinary service configured via env vars (CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET).
 * Exposes upload, invalidate, destroy, and signed upload URL params for direct frontend uploads.
 */
export const cloudinaryService = {
  /**
   * Upload a ticket image from a buffer (server-side upload).
   */
  async uploadTicketImage(
    file: Buffer,
    folder: TicketImageFolder = 'events/tickets',
  ): Promise<UploadTicketImageResult> {
    const fullFolder = `${UPLOAD_FOLDER}/${folder}`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: fullFolder,
          resource_type: 'image',
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
      uploadStream.end(file);
    });
  },

  /**
   * Invalidate CDN cache for a resource so the latest version is served.
   */
  async invalidateImage(publicId: string): Promise<UploadTicketImageResult> {
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
  },

  /**
   * Permanently delete an image from Cloudinary and invalidate CDN cache.
   */
  async destroyImage(publicId: string): Promise<{ result: string }> {
    const result = await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
    });
    if (result.result !== 'ok') {
      throw new Error(`Destroy returned status: ${result.result}`);
    }
    return { result: result.result };
  },

  /**
   * List resources in a folder (for cleanup jobs). Returns public_ids.
   */
  async listResourcesInFolder(
    folder: TicketImageFolder = 'events/tickets',
    maxResults = 500,
  ): Promise<string[]> {
    const prefix = `${UPLOAD_FOLDER}/${folder}/`;
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix,
      max_results: maxResults,
    });
    const resources =
      (result as { resources?: { public_id: string }[] }).resources ?? [];
    return resources.map((r) => r.public_id);
  },

  /**
   * Generate signed upload parameters for direct frontend uploads.
   * Frontend can POST to uploadUrl with file + these params.
   */
  getSignedUploadParams(
    folder: TicketImageFolder = 'events/tickets',
  ): SignedUploadParams {
    const fullFolder = `${UPLOAD_FOLDER}/${folder}`;
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = { timestamp, folder: fullFolder };
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      config.cloudinary.apiSecret,
    );

    return {
      signature,
      timestamp,
      apiKey: config.cloudinary.apiKey,
      cloudName: config.cloudinary.cloudName,
      folder: fullFolder,
      uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/image/upload`,
    };
  },
};

export default cloudinaryService;
