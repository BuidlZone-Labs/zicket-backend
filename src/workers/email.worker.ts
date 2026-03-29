import { Worker, Job } from 'bullmq';
import { redisConfig, queueConfig } from '../config/queue';
import {
  EmailJobType,
  EmailJobPayload,
  SendVerificationOtpPayload,
  SendMagicLinkPayload,
  SendEmailPayload,
  EmailJobResult,
  QUEUE_NAMES,
} from '../config/queue-jobs';
import nodemailer, { Transporter } from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class EmailWorker {
  private worker: Worker | null = null;
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  /**
   * Initialize the email worker
   */
  async initialize(): Promise<void> {
    try {
      this.worker = new Worker(
        QUEUE_NAMES.EMAIL,
        async (job: Job) => {
          return this.processJob(job);
        },
        {
          connection: redisConfig,
          concurrency: queueConfig.worker.concurrency,
        },
      );

      // Event handlers
      this.worker.on('completed', (job) => {
        console.log(`✓ Email job ${job.id} completed successfully`);
      });

      this.worker.on('failed', (job, error) => {
        console.error(
          `✗ Email job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts.attempts}):`,
          error.message,
        );
      });

      this.worker.on('error', (error) => {
        console.error('Email worker error:', error);
      });

      console.log('Email worker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize EmailWorker:', error);
      throw error;
    }
  }

  /**
   * Process individual email job
   */
  private async processJob(job: Job): Promise<EmailJobResult> {
    try {
      const jobType = job.name as EmailJobType;
      const payload = job.data as EmailJobPayload;

      console.log(
        `Processing email job: ${jobType} [ID: ${job.id}], Attempt: ${job.attemptsMade + 1}/${job.opts.attempts}`,
      );

      let result: EmailJobResult;

      switch (jobType) {
        case EmailJobType.SEND_VERIFICATION_OTP:
          result = await this.sendVerificationOtp(
            payload as SendVerificationOtpPayload,
          );
          break;

        case EmailJobType.SEND_MAGIC_LINK:
          result = await this.sendMagicLink(
            payload as SendMagicLinkPayload,
          );
          break;

        case EmailJobType.SEND_EMAIL:
          result = await this.sendEmail(payload as SendEmailPayload);
          break;

        default:
          throw new Error(`Unknown job type: ${jobType}`);
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`Job ${job.id} error:`, errorMessage);

      // Throw to trigger retry
      throw error;
    }
  }

  /**
   * Send verification OTP email
   */
  private async sendVerificationOtp(
    payload: SendVerificationOtpPayload,
  ): Promise<EmailJobResult> {
    const { email, otp } = payload;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .otp-box { font-size: 28px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; background-color: #e5e7eb; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎫 Zicket</h1>
            </div>
            <div class="content">
              <h2>Verify your account</h2>
              <p>Thanks for signing up. Use the code below to verify your email address:</p>
              <div class="otp-box">${otp}</div>
              <p>This code expires in 10 minutes. If you didn't create an account, you can ignore this email.</p>
            </div>
            <div class="footer">
              <p>This is an automated email from Zicket. Please do not reply.</p>
              <p>&copy; ${new Date().getFullYear()} Zicket. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Zicket - Verify your account

      Thanks for signing up. Use this code to verify your email: ${otp}

      This code expires in 10 minutes. If you didn't create an account, you can ignore this email.

      © ${new Date().getFullYear()} Zicket. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Verify your Zicket account',
      html,
      text,
    });
  }

  /**
   * Send magic link email
   */
  private async sendMagicLink(
    payload: SendMagicLinkPayload,
  ): Promise<EmailJobResult> {
    const { email, token } = payload;
    const magicLink = `${process.env.FRONTEND_URL}/auth/magic?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            .warning { background-color: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎫 Zicket Login</h1>
            </div>
            <div class="content">
              <h2>Magic Link Login</h2>
              <p>Hello!</p>
              <p>You requested a magic link to log in to your Zicket account. Click the button below to securely log in:</p>
              
              <div style="text-align: center;">
                <a href="${magicLink}" class="button">Log In to Zicket</a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background-color: #e5e7eb; padding: 10px; border-radius: 3px;">
                ${magicLink}
              </p>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <ul>
                  <li>This link expires in 15 minutes</li>
                  <li>It can only be used once</li>
                  <li>If you didn't request this, please ignore this email</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated email from Zicket. Please do not reply.</p>
              <p>&copy; ${new Date().getFullYear()} Zicket. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Zicket Magic Link Login
      
      Hello!
      
      You requested a magic link to log in to your Zicket account.
      
      Click or copy this link to log in:
      ${magicLink}
      
      Security Notice:
      - This link expires in 15 minutes
      - It can only be used once
      - If you didn't request this, please ignore this email
      
      This is an automated email from Zicket. Please do not reply.
      © ${new Date().getFullYear()} Zicket. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Your Zicket Magic Link',
      html,
      text,
    });
  }

  /**
   * Send generic email
   */
  private async sendEmail(
    payload: SendEmailPayload,
  ): Promise<EmailJobResult> {
    const { to, subject, html, text } = payload;

    const info = await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      html,
      text,
    });

    console.log(`Email sent successfully to ${to}, Message ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
      timestamp: new Date(),
    };
  }

  /**
   * Close worker connection
   */
  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      console.log('Email worker closed');
    }
  }
}

export default new EmailWorker();
