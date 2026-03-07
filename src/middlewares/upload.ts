import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

/** JPEG/PNG only for ticket images (per spec) */
const TICKET_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage();

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Unsupported file type: ${file.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      ),
    );
  }
};

/** Only JPEG/PNG, <5MB — for event ticket image uploads */
const ticketImageFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (TICKET_IMAGE_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid image type. Only JPEG and PNG are allowed (received: ${file.mimetype}).`,
      ),
    );
  }
};

export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single('image');

/** Multer for ticket creation: single 'image' field, JPEG/PNG only, <5MB */
export const uploadTicketImage = multer({
  storage,
  fileFilter: ticketImageFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single('image');
