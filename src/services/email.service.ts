import dotenv from 'dotenv';
import queueService from './queue.service';

dotenv.config();

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * EmailService - Queue-based email service
 * Enqueues email jobs for async processing instead of blocking the request cycle
 * This ensures fast response times and reliable email delivery with retries
 */
class EmailService {
  /**
   * Queue an email to be sent asynchronously
   * Returns immediately - does not wait for actual send
   */
  async sendEmail(options: EmailOptions): Promise<string> {
    try {
      const jobId = await queueService.enqueueEmail(
        options.to,
        options.subject,
        options.html,
        options.text,
      );
      console.log(
        `Email queued successfully for ${options.to}, Job ID: ${jobId}`,
      );
      return jobId;
    } catch (error: any) {
      console.error('Error queuing email:', error.message);
      throw new Error('Failed to queue email');
    }
  }

  /**
   * Queue a magic link email for async processing
   */
  async sendMagicLink(email: string, token: string): Promise<string> {
    try {
      const jobId = await queueService.enqueueMagicLink(email, token);
      console.log(`Magic link email queued for ${email}, Job ID: ${jobId}`);
      return jobId;
    } catch (error: any) {
      console.error('Error queuing magic link:', error.message);
      throw new Error('Failed to queue magic link email');
    }
  }

  /**
   * Queue a verification OTP email for async processing
   */
  async sendVerificationOtp(email: string, otp: number): Promise<string> {
    try {
      const jobId = await queueService.enqueueVerificationOtp(email, otp);
      console.log(`Verification OTP email queued for ${email}, Job ID: ${jobId}`);
      return jobId;
    } catch (error: any) {
      console.error('Error queuing verification OTP:', error.message);
      throw new Error('Failed to queue verification OTP email');
    }
  }
}

export default new EmailService();
