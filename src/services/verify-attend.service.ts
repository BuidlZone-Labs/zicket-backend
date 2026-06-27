import mongoose from 'mongoose';
import EventTicket from '../models/event-ticket';
import AttendanceNullifier from '../models/attendance-nullifier';
import { ZkProofPayload } from './zk-orchestrator.service';
import { ZkPassportAttendVerifier } from './zkpassport-attend-verifier.service';
import { getEventContractProvider } from '../provider/event-contract.factory';
import {
  NullifierAlreadyUsedError,
  VerifyAttendFailedError,
} from '../errors/verifyAttendError';
import { isZkPassportProofExpired } from '../utils/zkpassport-expiry';
import { attendanceNullifierDigest } from '../utils/attendance-nullifier-digest';
import { EventContractConfigError } from '../provider/event-contract.factory';

export interface VerifyAttendSuccess {
  eventId: string;
  onChainEventId: string;
  nullifier: string;
  txHash: string;
}

const VERIFIED_ACCESS_PRIVACY_LEVEL = 2;

/**
 * Orchestrates zkPassport verify-attend: proof relay, nullifier tracking, contract submit (#121).
 */
export class VerifyAttendService {
  /**
   * Verifies a zkPassport proof and records attendance for a verified-access event.
   */
  static async verifyAttend(
    eventId: string,
    proofPayload: ZkProofPayload,
  ): Promise<VerifyAttendSuccess> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      throw new VerifyAttendFailedError();
    }

    const event = await EventTicket.findById(eventId)
      .select('privacyLevel onChainEventId eventStatus')
      .lean();

    if (
      !event ||
      event.privacyLevel !== VERIFIED_ACCESS_PRIVACY_LEVEL ||
      !event.onChainEventId ||
      event.eventStatus === 'cancelled'
    ) {
      throw new VerifyAttendFailedError();
    }

    if (isZkPassportProofExpired(proofPayload.publicSignals)) {
      throw new VerifyAttendFailedError();
    }

    const nullifierFromProof = proofPayload.publicSignals[0]?.toString();
    if (!nullifierFromProof) {
      throw new VerifyAttendFailedError();
    }

    const nullifierDigest = attendanceNullifierDigest(
      eventId,
      nullifierFromProof,
    );

    const existing = await AttendanceNullifier.findOne({
      eventId: new mongoose.Types.ObjectId(eventId),
      nullifier: nullifierDigest,
    }).lean();

    if (existing) {
      throw new NullifierAlreadyUsedError();
    }

    const verification = await ZkPassportAttendVerifier.verify(proofPayload);
    if (!verification || verification.nullifier !== nullifierFromProof) {
      throw new VerifyAttendFailedError();
    }

    const { nullifier } = verification;

    const contract = getEventContractProvider();
    let txHash: string;

    try {
      const result = await contract.verifyAndAttend(
        event.onChainEventId,
        nullifier,
      );
      txHash = result.txHash;
    } catch (error) {
      if (error instanceof EventContractConfigError) {
        throw error;
      }
      console.error('[VerifyAttendService] contract verify_and_attend failed:', error);
      throw new VerifyAttendFailedError();
    }

    try {
      await AttendanceNullifier.create({
        eventId: new mongoose.Types.ObjectId(eventId),
        nullifier: nullifierDigest,
        onChainTxHash: txHash,
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: number }).code === 11000
      ) {
        throw new NullifierAlreadyUsedError();
      }
      throw error;
    }

    return {
      eventId,
      onChainEventId: event.onChainEventId,
      nullifier: nullifierDigest,
      txHash,
    };
  }
}
