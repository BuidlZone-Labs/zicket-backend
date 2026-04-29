import { Queue, Worker } from 'bullmq';
import { redisConfig, queueConfig } from '../config/queue';
import {
  EmailJobType,
  EmailJobPayload,
  SendTicketPurchaseNotificationPayload,
  SendTicketUpdateNotificationPayload,
  SendEventCancellationNotificationPayload,
  QUEUE_NAMES,
} from '../config/queue-jobs';

/**
 * QueueService - Manages BullMQ queue instances
 * Provides methods to enqueue jobs for async processing
 */
class QueueService {
  private emailQueue: Queue | null = null;
  private emailWorker: Worker | null = null;
  private initialized = false;

  /**
   * Initialize queue and worker instances
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('QueueService already initialized');
      return;
    }

    try {
      this.emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
        connection: redisConfig,
        ...queueConfig,
      });

      this.initialized = true;
      console.log('QueueService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize QueueService:', error);
      throw error;
    }
  }

  /**
   * Enqueue a verification OTP email
   */
  async enqueueVerificationOtp(email: string, otp: number): Promise<string> {
    if (!this.emailQueue) {
      throw new Error('Queue not initialized');
    }

    const job = await this.emailQueue.add(
      EmailJobType.SEND_VERIFICATION_OTP,
      { email, otp } as EmailJobPayload,
      {
        jobId: `otp-${email}-${Date.now()}`,
      },
    );

    console.log(
      `Queued verification OTP email for ${email}, Job ID: ${job.id}`,
    );
    return job.id!;
  }

  /**
   * Enqueue a magic link email
   */
  async enqueueMagicLink(email: string, token: string): Promise<string> {
    if (!this.emailQueue) {
      throw new Error('Queue not initialized');
    }

    const job = await this.emailQueue.add(
      EmailJobType.SEND_MAGIC_LINK,
      { email, token } as EmailJobPayload,
      {
        jobId: `magic-${email}-${Date.now()}`,
      },
    );

    console.log(`Queued magic link email for ${email}, Job ID: ${job.id}`);
    return job.id!;
  }

  /**
   * Enqueue a generic email
   */
  async enqueueEmail(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<string> {
    if (!this.emailQueue) {
      throw new Error('Queue not initialized');
    }

    const job = await this.emailQueue.add(
      EmailJobType.SEND_EMAIL,
      { to, subject, html, text } as EmailJobPayload,
      {
        jobId: `email-${to}-${Date.now()}`,
      },
    );

    console.log(
      `Queued email to ${to} with subject "${subject}", Job ID: ${job.id}`,
    );
    return job.id!;
  }

  /**
   * Enqueue a ticket purchase notification
   */
  async enqueueTicketPurchaseNotification(
    payload: SendTicketPurchaseNotificationPayload,
  ): Promise<string> {
    if (!this.emailQueue) {
      throw new Error('Queue not initialized');
    }

    const job = await this.emailQueue.add(
      EmailJobType.SEND_TICKET_PURCHASE_NOTIFICATION,
      payload as EmailJobPayload,
      {
        jobId: `purchase-${payload.userEmail}-${Date.now()}`,
      },
    );

    console.log(
      `Queued ticket purchase notification for ${payload.userEmail}, Job ID: ${job.id}`,
    );
    return job.id!;
  }

  /**
   * Enqueue a ticket update notification
   */
  async enqueueTicketUpdateNotification(
    payload: SendTicketUpdateNotificationPayload,
  ): Promise<string> {
    if (!this.emailQueue) {
      throw new Error('Queue not initialized');
    }

    const job = await this.emailQueue.add(
      EmailJobType.SEND_TICKET_UPDATE_NOTIFICATION,
      payload as EmailJobPayload,
      {
        jobId: `update-${payload.userEmail}-${Date.now()}`,
      },
    );

    console.log(
      `Queued ticket update notification for ${payload.userEmail}, Job ID: ${job.id}`,
    );
    return job.id!;
  }

  /**
   * Enqueue an event cancellation notification
   */
  async enqueueEventCancellationNotification(
    payload: SendEventCancellationNotificationPayload,
  ): Promise<string> {
    if (!this.emailQueue) {
      throw new Error('Queue not initialized');
    }

    const job = await this.emailQueue.add(
      EmailJobType.SEND_EVENT_CANCELLATION_NOTIFICATION,
      payload as EmailJobPayload,
      {
        jobId: `cancellation-${payload.userEmail}-${Date.now()}`,
      },
    );

    console.log(
      `Queued event cancellation notification for ${payload.userEmail}, Job ID: ${job.id}`,
    );
    return job.id!;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    if (!this.emailQueue) {
      return null;
    }

    return {
      name: QUEUE_NAMES.EMAIL,
      active: await this.emailQueue.getActiveCount(),
      waiting: await this.emailQueue.getWaitingCount(),
      failed: await this.emailQueue.getFailedCount(),
      completed: await this.emailQueue.getCompletedCount(),
      delayed: await this.emailQueue.getDelayedCount(),
    };
  }

  /**
   * Close queue connections (for graceful shutdown)
   */
  async close(): Promise<void> {
    if (this.emailQueue) {
      await this.emailQueue.close();
    }
    if (this.emailWorker) {
      await this.emailWorker.close();
    }
    console.log('QueueService closed');
  }

  /**
   * Get queue instance (for worker registration)
   */
  getEmailQueue(): Queue | null {
    return this.emailQueue;
  }
}

export default new QueueService();
