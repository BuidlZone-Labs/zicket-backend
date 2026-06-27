import { RequestHandler } from 'express';
import { UserAuthenticatedReq } from '../utils/types';
import { ErasureAssessmentService } from '../services/erasure-assessment.service';
import { AnonymizationService } from '../services/anonymization.service';

/**
 * GET /account/erasure-assessment
 * Returns off-chain erasability and any permanent on-chain payment exposure.
 */
export const getErasureAssessment: RequestHandler = async (
  req: UserAuthenticatedReq,
  res,
) => {
  try {
    const userId = req.user?._id || (req.user as { id?: string })?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    }

    const assessment = await ErasureAssessmentService.assessUser(
      userId.toString(),
    );

    res.status(200).json({
      success: true,
      data: assessment,
    });
  } catch (error) {
    console.error('[Account] getErasureAssessment:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to assess erasure impact',
    });
  }
};

/**
 * POST /account/request-erasure
 * Anonymizes off-chain profile data. On-chain Soroban records are unchanged.
 */
export const requestErasure: RequestHandler = async (
  req: UserAuthenticatedReq,
  res,
) => {
  try {
    const userId = req.user?._id || (req.user as { id?: string })?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    }

    const result = await AnonymizationService.requestErasure(userId.toString());

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erasure request failed';

    if (
      message === 'User not found' ||
      message === 'Account has already been anonymized'
    ) {
      return res.status(404).json({ error: 'Not found', message });
    }

    if (message === 'An erasure request is already in progress') {
      return res.status(409).json({ error: 'Conflict', message });
    }

    console.error('[Account] requestErasure:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process erasure request',
    });
  }
};
