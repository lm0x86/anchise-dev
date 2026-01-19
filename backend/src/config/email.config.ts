import { registerAs } from '@nestjs/config';

export const EMAIL_CONFIG_KEY = 'email';

export type EmailConfigType = {
  fromAddress: string;
  fromName: string;
  replyTo?: string;
  region: string;
  // Use AWS credentials from aws.config
};

export const emailConfig = registerAs(
  EMAIL_CONFIG_KEY,
  (): EmailConfigType => ({
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'develop@opentech.dev',
    fromName: process.env.EMAIL_FROM_NAME || 'Anchise',
    replyTo: process.env.EMAIL_REPLY_TO,
    region: process.env.AWS_SES_REGION || 'us-east-1', // Virginia (SES)
  }),
);

