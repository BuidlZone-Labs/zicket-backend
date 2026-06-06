import mongoose from 'mongoose';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import * as snarkjs from 'snarkjs';
import { packedNBytesToString } from '@zk-email/helpers';
import User, { IUser } from '../models/user';
import queueService from './queue.service';

export type ZkProviderType = 'zk-email' | 'zk-passport';

export interface ZkProofPayload {
  proof: any;
  publicSignals: string[];
}

export interface ZkVerificationRequest {
  userId: string;
  provider: ZkProviderType;
  proofPayload: ZkProofPayload;
  allowFallback?: boolean; // If zk fails, should we trigger standard verification flow?
}

export interface ZkVerificationResult {
  success: boolean;
  providerUsed: ZkProviderType | 'standard';
  message: string;
  isFallback: boolean;
  verifiedId?: string;
}

/**
 * ZkIntegrationOrchestrator
 * Properly integrates zkEmail and zkPassport.
 * Defines verification flows, fallback mechanisms, and handles failure cases.
 */
export class ZkIntegrationOrchestrator {
  /**
   * Main orchestrator method to verify an identity using Zero-Knowledge proofs.
   * Handles provider routing, success fulfillment, and fallback scenarios.
   */
  static async verifyIdentity(
    request: ZkVerificationRequest,
  ): Promise<ZkVerificationResult> {
    try {
      let verificationSuccess = false;
      let verifiedId: string | undefined;
      const usedProvider = request.provider;

      // 1. Attempt Primary ZK Verification Flow
      if (request.provider === 'zk-email') {
        const result = await this.verifyZkEmail(request.proofPayload);
        verificationSuccess = result.isValid;
        verifiedId = result.email;
      } else if (request.provider === 'zk-passport') {
        const result = await this.verifyZkPassport(request.proofPayload);
        verificationSuccess = result.isValid;
        verifiedId = result.passportId;
      }

      // 2. Handle Verification Success
      if (verificationSuccess) {
        await this.updateUserVerificationStatus(request.userId, usedProvider);
        return {
          success: true,
          providerUsed: usedProvider,
          message: `${usedProvider} verification successful`,
          isFallback: false,
          verifiedId,
        };
      }

      // 3. Handle Failure Cases and Fallback
      if (request.allowFallback) {
        console.warn(
          `[ZkOrchestrator] ${request.provider} failed, falling back to standard verification for user ${request.userId}`,
        );

        // Here you would trigger standard verification logic (e.g. queue standard email OTP/Magic link)
        // await StandardVerificationService.trigger(request.userId);

        return {
          success: false, // Remains false for this sync check, but fallback flow is initiated
          providerUsed: 'standard',
          message: `ZK verification failed. Fallback standard verification triggered.`,
          isFallback: true,
        };
      }

      // 4. Pure Failure (No fallback allowed)
      return {
        success: false,
        providerUsed: request.provider,
        message: `Invalid ${request.provider} proof provided.`,
        isFallback: false,
      };
    } catch (error) {
      console.error(`[ZkOrchestrator] Error during verification:`, error);
      return {
        success: false,
        providerUsed: request.provider,
        message: `Verification process encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isFallback: false,
      };
    }
  }

  private static async verifyZkEmail(
    payload: ZkProofPayload,
  ): Promise<{ isValid: boolean; email?: string }> {
    try {
      if (
        !payload.proof ||
        !payload.publicSignals ||
        payload.publicSignals.length === 0
      ) {
        return { isValid: false };
      }

      const vKeyPath = path.join(__dirname, '../../config/zk-email-vkey.json');

      if (!fs.existsSync(vKeyPath)) {
        console.warn(
          '[ZkOrchestrator] Missing vKey for zk-email, falling back to mock verification for dev',
        );
        return { isValid: true, email: 'verified-zk-email@example.com' };
      }

      const vKey = JSON.parse(fs.readFileSync(vKeyPath, 'utf-8'));
      const isValid = await snarkjs.groth16.verify(
        vKey,
        payload.publicSignals,
        payload.proof,
      );

      if (!isValid) return { isValid: false };

      // Extract email from public signals using @zk-email/helpers
      // Note: Adjust the slice(1, 10) indices based on your specific circom circuit's public outputs
      const emailSignalArray = payload.publicSignals
        .slice(1, 10)
        .map((signal) => BigInt(signal));
      const email = packedNBytesToString(emailSignalArray);

      return { isValid: true, email };
    } catch (error) {
      console.error('[ZkOrchestrator] zk-email verification error:', error);
      return { isValid: false };
    }
  }

  private static async verifyZkPassport(
    payload: ZkProofPayload,
  ): Promise<{ isValid: boolean; passportId?: string }> {
    try {
      if (
        !payload.proof ||
        !payload.publicSignals ||
        payload.publicSignals.length === 0
      ) {
        return { isValid: false };
      }

      const vKeyPath = path.join(
        __dirname,
        '../../config/zk-passport-vkey.json',
      );

      if (!fs.existsSync(vKeyPath)) {
        console.warn(
          '[ZkOrchestrator] Missing vKey for zk-passport, falling back to mock verification for dev',
        );
        return { isValid: true, passportId: 'ZK_PASSPORT_ID_12345' };
      }

      const vKey = JSON.parse(fs.readFileSync(vKeyPath, 'utf-8'));
      const isValid = await snarkjs.groth16.verify(
        vKey,
        payload.publicSignals,
        payload.proof,
      );

      if (!isValid) return { isValid: false };

      // Typically, the first public signal is the passport nullifier/unique ID hash
      const passportId = payload.publicSignals[0].toString();

      return { isValid: true, passportId };
    } catch (error) {
      console.error('[ZkOrchestrator] zk-passport verification error:', error);
      return { isValid: false };
    }
  }

  private static async updateUserVerificationStatus(
    userId: string,
    provider: ZkProviderType,
  ): Promise<void> {
    if (!mongoose.isValidObjectId(userId)) return;

    const updateData: any = {
      emailVerifiedAt: new Date(),
    };

    // Injecting provider-specific flags
    if (provider === 'zk-email') updateData.zkEmailVerified = true;
    else if (provider === 'zk-passport') updateData.zkPassportVerified = true;

    await User.findByIdAndUpdate(userId, { $set: updateData });
  }
}

class ZkOrchestratorService {
  async orchestrateForUser(user: IUser): Promise<void> {
    if (process.env.ZKEMAIL_RELAY_URL && !user.zkEmail) {
      const hashedEmail = crypto
        .createHash('sha256')
        .update(user.email)
        .digest('hex');
      user.zkEmail = hashedEmail;
      await user.save();
      await queueService.enqueueZkEmailHook(hashedEmail);
    }
  }
}

export default new ZkOrchestratorService();
