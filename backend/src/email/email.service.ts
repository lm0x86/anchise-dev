import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { AwsConfigType, AWS_CONFIG_KEY } from '../config/aws.config';
import { EmailConfigType, EMAIL_CONFIG_KEY } from '../config/email.config';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

@Injectable()
export class EmailService {
  private sesClient: SESClient;
  private fromAddress: string;
  private fromName: string;
  private defaultReplyTo?: string;

  constructor(private configService: ConfigService) {
    const awsConfig = this.configService.get<AwsConfigType>(AWS_CONFIG_KEY);
    const emailCfg = this.configService.get<EmailConfigType>(EMAIL_CONFIG_KEY);

    if (!awsConfig?.accessKeyId || !awsConfig?.secretAccessKey) {
      console.warn('AWS credentials not configured - emails will fail');
    }

    this.fromAddress = emailCfg?.fromAddress || 'develop@opentech.dev';
    this.fromName = emailCfg?.fromName || 'Anchise';
    this.defaultReplyTo = emailCfg?.replyTo;

    this.sesClient = new SESClient({
      region: emailCfg?.region || 'us-east-1', // Virginia (SES)
      credentials: {
        accessKeyId: awsConfig?.accessKeyId || '',
        secretAccessKey: awsConfig?.secretAccessKey || '',
      },
    });
  }

  /**
   * Send an email via AWS SES
   */
  async send(options: SendEmailOptions): Promise<void> {
    const { to, subject, html, text, replyTo } = options;

    const toAddresses = Array.isArray(to) ? to : [to];

    try {
      await this.sesClient.send(
        new SendEmailCommand({
          Source: `${this.fromName} <${this.fromAddress}>`,
          Destination: {
            ToAddresses: toAddresses,
          },
          Message: {
            Subject: {
              Charset: 'UTF-8',
              Data: subject,
            },
            Body: {
              Html: {
                Charset: 'UTF-8',
                Data: html,
              },
              ...(text && {
                Text: {
                  Charset: 'UTF-8',
                  Data: text,
                },
              }),
            },
          },
          ReplyToAddresses: replyTo
            ? [replyTo]
            : this.defaultReplyTo
              ? [this.defaultReplyTo]
              : undefined,
        }),
      );
    } catch (error) {
      console.error('SES email error:', error);
      throw new InternalServerErrorException('Failed to send email');
    }
  }

  // ============================================
  // TEMPLATE METHODS
  // ============================================

  /**
   * Send email verification email
   */
  async sendVerificationEmail(email: string, verifyToken: string, userName: string): Promise<void> {
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/verify-email?token=${verifyToken}`;

    await this.send({
      to: email,
      subject: 'Verify your email - Anchise',
      html: this.wrapInTemplate(`
        <h1 style="color: #FFFFFF; font-size: 28px; font-weight: 600; margin: 0 0 24px; text-align: center;">
          Verify your email
        </h1>
        <p style="color: #E5E5E5; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
          Hello <strong style="color: #FFFFFF;">${userName}</strong>,
        </p>
        <p style="color: #E5E5E5; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          Thank you for registering on Anchise! Please click the button below to verify your email address:
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verifyUrl}" style="display: inline-block; background: #C9A75E; color: #0F0F12; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Verify my email
          </a>
        </div>
        <p style="color: #9CA3AF; font-size: 14px; line-height: 1.6; margin: 24px 0 8px;">
          Or copy this link into your browser:
        </p>
        <p style="margin: 0 0 24px;">
          <a href="${verifyUrl}" style="color: #C9A75E; font-size: 14px; word-break: break-all;">${verifyUrl}</a>
        </p>
        <div style="border-top: 1px solid #374151; padding-top: 24px; margin-top: 24px;">
          <p style="color: #9CA3AF; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
            This link will expire in 24 hours.
          </p>
          <p style="color: #6B7280; font-size: 13px; line-height: 1.6; margin: 0;">
            If you did not create an account, please ignore this email.
          </p>
        </div>
      `),
      text: `
Verify your email

Hello ${userName},

Thank you for registering on Anchise! Please click the link below to verify your email address:

${verifyUrl}

This link will expire in 24 hours.

If you did not create an account, please ignore this email.

© ${new Date().getFullYear()} Anchise
      `.trim(),
    });
  }

  /**
   * Wrap content in a consistent email template
   */
  private wrapInTemplate(content: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Anchise</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0F0F12; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0F0F12;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width: 560px; width: 100%;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <span style="font-size: 32px;">🏺</span>
              <span style="color: #C9A75E; font-size: 28px; font-weight: 600; margin-left: 8px; vertical-align: middle;">Anchise</span>
            </td>
          </tr>
          <!-- Content Card -->
          <tr>
            <td style="background-color: #1F2937; border-radius: 16px; padding: 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="color: #6B7280; font-size: 13px; margin: 0;">
                © ${new Date().getFullYear()} Anchise. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email: string, resetToken: string, userName: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${resetToken}`;

    await this.send({
      to: email,
      subject: 'Reset your password - Anchise',
      html: this.wrapInTemplate(`
        <h1 style="color: #FFFFFF; font-size: 28px; font-weight: 600; margin: 0 0 24px; text-align: center;">
          Reset your password
        </h1>
        <p style="color: #E5E5E5; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
          Hello <strong style="color: #FFFFFF;">${userName}</strong>,
        </p>
        <p style="color: #E5E5E5; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          You requested to reset your password. Click the button below to create a new password:
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #C9A75E; color: #0F0F12; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Reset my password
          </a>
        </div>
        <p style="color: #9CA3AF; font-size: 14px; line-height: 1.6; margin: 24px 0 8px;">
          Or copy this link into your browser:
        </p>
        <p style="margin: 0 0 24px;">
          <a href="${resetUrl}" style="color: #C9A75E; font-size: 14px; word-break: break-all;">${resetUrl}</a>
        </p>
        <div style="border-top: 1px solid #374151; padding-top: 24px; margin-top: 24px;">
          <p style="color: #9CA3AF; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
            This link will expire in 1 hour.
          </p>
          <p style="color: #6B7280; font-size: 13px; line-height: 1.6; margin: 0;">
            If you did not request this, please ignore this email.
          </p>
        </div>
      `),
      text: `
Reset your password

Hello ${userName},

You requested to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour.

If you did not request this, please ignore this email.

© ${new Date().getFullYear()} Anchise
      `.trim(),
    });
  }

  /**
   * Send partner invitation email
   */
  async sendPartnerInvite(
    email: string,
    inviterName: string,
    partnerName: string,
    tempPassword: string,
  ): Promise<void> {
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/login`;

    await this.send({
      to: email,
      subject: `You've been invited to join ${partnerName} on Anchise`,
      html: this.wrapInTemplate(`
        <h1 style="color: #FFFFFF; font-size: 28px; font-weight: 600; margin: 0 0 24px; text-align: center;">
          Welcome to Anchise
        </h1>
        <p style="color: #E5E5E5; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
          <strong style="color: #FFFFFF;">${inviterName}</strong> has invited you to join 
          <strong style="color: #C9A75E;">${partnerName}</strong> on Anchise.
        </p>
        <p style="color: #E5E5E5; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
          Here are your login credentials:
        </p>
        <div style="background: #111827; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="color: #9CA3AF; font-size: 14px; margin: 0 0 8px;">
            <strong style="color: #FFFFFF;">Email:</strong> ${email}
          </p>
          <p style="color: #9CA3AF; font-size: 14px; margin: 0;">
            <strong style="color: #FFFFFF;">Temporary password:</strong> ${tempPassword}
          </p>
        </div>
        <p style="color: #9CA3AF; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          We recommend changing your password after your first login.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${loginUrl}" style="display: inline-block; background: #C9A75E; color: #0F0F12; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Sign in
          </a>
        </div>
      `),
      text: `
Welcome to Anchise

${inviterName} has invited you to join ${partnerName} on Anchise.

Your login credentials:
- Email: ${email}
- Temporary password: ${tempPassword}

Sign in here: ${loginUrl}

We recommend changing your password after your first login.

© ${new Date().getFullYear()} Anchise
      `.trim(),
    });
  }

  /**
   * Send welcome email after registration
   */
  async sendWelcome(email: string, userName: string): Promise<void> {
    const exploreUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/board`;

    await this.send({
      to: email,
      subject: 'Welcome to Anchise',
      html: this.wrapInTemplate(`
        <h1 style="color: #FFFFFF; font-size: 28px; font-weight: 600; margin: 0 0 24px; text-align: center;">
          Welcome, ${userName}!
        </h1>
        <p style="color: #E5E5E5; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
          Thank you for joining Anchise.
        </p>
        <p style="color: #E5E5E5; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          Anchise helps you honor your loved ones, discover obituaries in your area, and preserve their memory.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${exploreUrl}" style="display: inline-block; background: #C9A75E; color: #0F0F12; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Explore the Funeral Board
          </a>
        </div>
      `),
      text: `
Welcome, ${userName}!

Thank you for joining Anchise.

Anchise helps you honor your loved ones, discover obituaries in your area, and preserve their memory.

Explore the Funeral Board: ${exploreUrl}

© ${new Date().getFullYear()} Anchise
      `.trim(),
    });
  }

  /**
   * Send tribute notification to profile owner/partner
   */
  async sendTributeNotification(
    email: string,
    profileName: string,
    tributeContent: string,
    moderationUrl: string,
  ): Promise<void> {
    const truncatedContent = tributeContent.substring(0, 200) + (tributeContent.length > 200 ? '...' : '');

    await this.send({
      to: email,
      subject: `New tribute for ${profileName} - Anchise`,
      html: this.wrapInTemplate(`
        <h1 style="color: #FFFFFF; font-size: 28px; font-weight: 600; margin: 0 0 24px; text-align: center;">
          New tribute received
        </h1>
        <p style="color: #E5E5E5; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
          A new message has been posted for <strong style="color: #C9A75E;">${profileName}</strong>:
        </p>
        <div style="background: #111827; border-left: 3px solid #C9A75E; padding: 20px; margin: 24px 0; border-radius: 0 8px 8px 0;">
          <p style="color: #D1D5DB; font-size: 15px; font-style: italic; line-height: 1.6; margin: 0;">
            "${truncatedContent}"
          </p>
        </div>
        <p style="color: #9CA3AF; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          This message is pending moderation.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${moderationUrl}" style="display: inline-block; background: #C9A75E; color: #0F0F12; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Review this tribute
          </a>
        </div>
      `),
      text: `
New tribute received

A new message has been posted for ${profileName}:

"${truncatedContent}"

This message is pending moderation.

Review it here: ${moderationUrl}

© ${new Date().getFullYear()} Anchise
      `.trim(),
    });
  }
}

