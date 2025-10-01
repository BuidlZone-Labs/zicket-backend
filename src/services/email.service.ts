import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

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

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${options.to}`);
    } catch (error: any) {
      console.error('Error sending email:', error.message);
      throw new Error('Failed to send email');
    }
  }

  async sendMagicLink(email: string, token: string): Promise<void> {
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

    await this.sendEmail({
      to: email,
      subject: 'Your Zicket Magic Link',
      html,
      text,
    });
  }
}

export default new EmailService();
