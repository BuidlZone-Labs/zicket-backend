import { RequestHandler } from 'express';
import mongoose from 'mongoose';
import EventTicket from '../models/event-ticket';
import {
  DATA_RETENTION_MATRIX,
  PRIVACY_POLICY_SUMMARY,
  USER_FACING_PRIVACY_POLICY,
} from '../constants/data-retention-matrix';
import { PaymentPrivacyDisclosureService } from '../services/payment-privacy-disclosure.service';

/**
 * GET /compliance/data-retention
 * Public matrix of erasable off-chain vs permanent on-chain data.
 */
export const getDataRetentionMatrix: RequestHandler = async (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      matrix: DATA_RETENTION_MATRIX,
      summary: PRIVACY_POLICY_SUMMARY,
    },
  });
};

/**
 * GET /compliance/privacy-policy
 * User-facing summary separating erasable off-chain data from permanent on-chain records.
 */
export const getPrivacyPolicy: RequestHandler = async (_req, res) => {
  res.status(200).json({
    success: true,
    data: USER_FACING_PRIVACY_POLICY,
  });
};

/**
 * GET /compliance/payment-privacy-disclosure/:eventId
 * Pre-payment disclosure for paid events (Standard vs Anonymous).
 */
export const getPaymentPrivacyDisclosure: RequestHandler = async (req, res) => {
  try {
    const eventId = Array.isArray(req.params.eventId)
      ? req.params.eventId[0]
      : req.params.eventId;

    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid event ID',
      });
    }

    const event = await EventTicket.findById(eventId)
      .select('eventType paymentPrivacy name')
      .lean();

    if (!event) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Event not found',
      });
    }

    const disclosure = PaymentPrivacyDisclosureService.buildDisclosure(
      event.eventType,
      event.paymentPrivacy,
    );

    res.status(200).json({
      success: true,
      data: {
        eventId,
        eventName: event.name,
        paymentDisclosure: disclosure,
      },
    });
  } catch (error) {
    console.error('[PrivacyCompliance] getPaymentPrivacyDisclosure:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to load payment privacy disclosure',
    });
  }
};
