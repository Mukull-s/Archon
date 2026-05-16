import { Resend } from 'resend';
import { env } from '../config';
import { logger } from '../utils';

const resend = new Resend(env.RESEND_API_KEY);

/**
 * Email Service — sends transactional emails via Resend.
 */
export class EmailService {

  /** Send email verification link */
  async sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
    const verifyUrl = `${env.CLIENT_URL}/auth/verify?token=${token}`;

    try {
      await resend.emails.send({
        from: 'Archon <onboarding@resend.dev>',
        to: [to],
        subject: 'Verify your Archon account',
        html: this.buildVerificationTemplate(name, verifyUrl),
      });

      logger.info(`Verification email sent to ${to}`);
    } catch (error) {
      logger.error('Failed to send verification email', {
        to,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw — email failure shouldn't block signup
    }
  }

  private buildVerificationTemplate(name: string, verifyUrl: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body style="margin:0;padding:0;background:#0a0514;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:480px;margin:0 auto;padding:48px 24px;">
        
        <!-- Logo -->
        <div style="text-align:center;margin-bottom:32px;">
          <div style="display:inline-block;width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#b026ff,#7b2ff7);line-height:40px;text-align:center;">
            <span style="color:#fff;font-size:18px;font-weight:700;">A</span>
          </div>
          <p style="color:#fff;font-size:18px;font-weight:700;margin:8px 0 0;letter-spacing:-0.02em;">Archon</p>
        </div>

        <!-- Card -->
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px 24px;">
          <h1 style="color:#fff;font-size:20px;font-weight:600;margin:0 0 8px;text-align:center;">
            Verify your email
          </h1>
          <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 24px;text-align:center;">
            Hey ${name}, click the button below to verify your email and activate your Archon account.
          </p>
          
          <div style="text-align:center;margin-bottom:24px;">
            <a href="${verifyUrl}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#b026ff,#7b2ff7);color:#fff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;letter-spacing:-0.01em;">
              Verify Email
            </a>
          </div>

          <p style="color:rgba(255,255,255,0.35);font-size:12px;text-align:center;margin:0;">
            If you didn't create an Archon account, you can safely ignore this email.
          </p>
        </div>

        <!-- Footer -->
        <p style="color:rgba(255,255,255,0.25);font-size:11px;text-align:center;margin-top:24px;">
          © 2026 Archon · AI Codebase Intelligence
        </p>
      </div>
    </body>
    </html>
    `;
  }
}

export const emailService = new EmailService();
