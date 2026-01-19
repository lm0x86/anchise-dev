import { registerAs } from '@nestjs/config';

export const AWS_CONFIG_KEY = 'aws';

export type AwsConfigType = {
  accessKeyId: string;
  secretAccessKey: string;
  // S3 config
  s3Region: string;
  s3Bucket: string;
  s3Endpoint?: string; // For LocalStack or MinIO in development
  // SES config
  sesRegion: string;
};

export const awsConfig = registerAs(
  AWS_CONFIG_KEY,
  (): AwsConfigType => ({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    // S3 config
    s3Region: process.env.AWS_S3_REGION || 'us-east-2', // Ohio
    s3Bucket: process.env.AWS_S3_BUCKET || '',
    s3Endpoint: process.env.AWS_S3_ENDPOINT, // Optional: for local dev
    // SES config
    sesRegion: process.env.AWS_SES_REGION || 'us-east-1', // Virginia
  }),
);

