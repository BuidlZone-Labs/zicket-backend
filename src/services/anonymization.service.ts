import mongoose from 'mongoose';
import User from '../models/user';
import AnonymizationJob, {
  IAnonymizationJob,
} from '../models/anonymization-job';
import { ErasureAssessmentService } from './erasure-assessment.service';

export interface AnonymizationResult {
  userId: string;
  jobId: string;
  status: 'completed' | 'failed';
  assessment: Awaited<ReturnType<typeof ErasureAssessmentService.assessUser>>;
  message: string;
}

const ANONYMIZED_EMAIL_DOMAIN = 'anonymized.zicket.local';

/**
 * Off-chain user erasure / anonymization (Issue #127).
 * On-chain Soroban data is never modified.
 */
export class AnonymizationService {
  static async requestErasure(userId: string): Promise<AnonymizationResult> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user id');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.anonymizedAt) {
      throw new Error('Account has already been anonymized');
    }

    const existingPending = await AnonymizationJob.findOne({
      targetUserId: user._id,
      status: 'pending',
    });
    if (existingPending) {
      throw new Error('An erasure request is already in progress');
    }

    const job = await AnonymizationJob.create({
      targetUserId: user._id,
      status: 'pending',
    });

    return this.executeJob(job);
  }

  /** Processes a queued anonymization job (worker retry path). */
  static async executeJob(
    job: IAnonymizationJob,
  ): Promise<AnonymizationResult> {
    const userId = job.targetUserId.toString();
    const user = await User.findById(job.targetUserId);

    if (!user) {
      job.status = 'failed';
      await job.save();
      throw new Error('User not found for anonymization job');
    }

    if (user.anonymizedAt) {
      job.status = 'completed';
      await job.save();
      const assessment = await ErasureAssessmentService.assessUser(userId);
      return {
        userId,
        jobId: (job._id as mongoose.Types.ObjectId).toString(),
        status: 'completed',
        assessment,
        message: 'Account was already anonymized',
      };
    }

    const assessment = await ErasureAssessmentService.assessUser(userId);

    try {
      await this.anonymizeUserDocument(user);
      job.status = 'completed';
      await job.save();

      return {
        userId,
        jobId: (job._id as mongoose.Types.ObjectId).toString(),
        status: 'completed',
        assessment,
        message: assessment.onChainPermanentData
          ? 'Off-chain profile data anonymized. On-chain payment records remain permanent as disclosed.'
          : 'Off-chain profile data anonymized. No Standard-payment on-chain wallet records found.',
      };
    } catch (error) {
      job.status = 'failed';
      await job.save();
      throw error;
    }
  }

  private static async anonymizeUserDocument(
    user: InstanceType<typeof User>,
  ): Promise<void> {
    const objectId = (user._id as mongoose.Types.ObjectId).toString();

    user.name = 'Deleted User';
    user.email = `deleted+${objectId}@${ANONYMIZED_EMAIL_DOMAIN}`;
    user.password = undefined;
    user.googleId = undefined;
    user.otp = undefined;
    user.otpExpires = undefined;
    user.magicToken = undefined;
    user.magicTokenExpires = undefined;
    user.zkEmail = undefined;
    user.zkPassport = undefined;
    user.zkEmailVerified = false;
    user.zkPassportVerified = false;
    user.anonymizedAt = new Date();
    user.notificationPreferences = {
      emailOnTicketPurchase: false,
      emailOnTicketUpdate: false,
    };

    await user.save();
  }
}
