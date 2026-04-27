import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '../errors/AppError';

interface ErrorResponse {
  status: number;
  message: string;
  code: string;
  details?: unknown;
  stack?: string;
}

export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isDev = process.env.NODE_ENV === 'development';

  // Zod validation errors
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    const body: ErrorResponse = {
      status: 400,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details,
    };
    if (isDev) body.stack = new ValidationError('Validation failed').stack;
    res.status(400).json(body);
    return;
  }

  // Multer file-size error
  if ((err as any)?.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({
      status: 400,
      message: 'Image must be less than 5MB',
      code: 'FILE_TOO_LARGE',
    });
    return;
  }

  // Rate-limit error (express-rate-limit sets status 429)
  if ((err as any)?.status === 429) {
    res.status(429).json({
      status: 429,
      message: (err as any).message || 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: (err as any).retryAfter ?? 60,
    });
    return;
  }

  // Multer unsupported file type
  if (
    err instanceof Error &&
    /Unsupported file type|Invalid image type/.test(err.message)
  ) {
    res.status(400).json({
      status: 400,
      message: err.message,
      code: 'INVALID_FILE_TYPE',
    });
    return;
  }

  // Intentional AppError subclasses (safe to expose)
  if (err instanceof AppError) {
    const body: ErrorResponse = {
      status: err.statusCode,
      message: err.message,
      code: err.code,
    };
    if ((err as any).details !== undefined) {
      body.details = (err as any).details;
    }
    if (isDev) body.stack = err.stack;
    res.status(err.statusCode).json(body);
    return;
  }

  // Unhandled / unexpected error — log full details, send generic 500
  console.error('[ErrorHandler] Unhandled error:', err);
  const body: ErrorResponse = {
    status: 500,
    message: 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR',
  };
  if (isDev && err instanceof Error) body.stack = err.stack;
  res.status(500).json(body);
}