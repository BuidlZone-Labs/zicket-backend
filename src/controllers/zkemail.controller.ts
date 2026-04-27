import { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import queueService from '../services/queue.service';

const ZkEmailHookSchema = z.object({
  hashedEmail: z
    .string()
    .regex(
      /^[a-f0-9]{64}$/,
      'hashedEmail must be a SHA256 hex string (64 lowercase hex characters)',
    ),
});

export const zkEmailHookController: RequestHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const parsed = ZkEmailHookSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        message: parsed.error.issues[0].message,
      });
      return;
    }

    const { hashedEmail } = parsed.data;

    const jobId = await queueService.enqueueZkEmailHook(hashedEmail);

    res.status(202).json({
      message: 'zkEmail flow queued',
      jobId,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
