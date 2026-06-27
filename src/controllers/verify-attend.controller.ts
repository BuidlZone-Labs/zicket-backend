import { RequestHandler } from 'express';
import { VerifyAttendBodySchema } from '../validators/verify-attend.validator';
import { VerifyAttendService } from '../services/verify-attend.service';
import {
  NullifierAlreadyUsedError,
  VerifyAttendFailedError,
} from '../errors/verifyAttendError';

/**
 * POST /events/:id/verify-attend
 * Anonymous zkPassport proof submission for verified-access events (#121).
 */
export const verifyAttend: RequestHandler = async (req, res) => {
  try {
    const eventId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const parsed = VerifyAttendBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new VerifyAttendFailedError();
    }

    const result = await VerifyAttendService.verifyAttend(eventId, {
      proof: parsed.data.proof,
      publicSignals: parsed.data.publicSignals,
    });

    res.status(200).json({
      success: true,
      data: {
        eventId: result.eventId,
        txHash: result.txHash,
      },
    });
  } catch (error) {
    if (error instanceof NullifierAlreadyUsedError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.code,
        message: error.message,
      });
    }

    if (error instanceof VerifyAttendFailedError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.code,
        message: error.message,
      });
    }

    console.error('[VerifyAttend] unexpected error:', error);
    res.status(400).json({
      success: false,
      error: 'VERIFICATION_FAILED',
      message: 'Attendance verification failed.',
    });
  }
};
