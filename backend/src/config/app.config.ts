import { registerAs } from '@nestjs/config';

export const APP_CONFIG_KEY = 'app';

export interface AppConfigType {
  port: number;
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

export const appConfig = registerAs(
  APP_CONFIG_KEY,
  (): AppConfigType => {
    const nodeEnv = process.env.NODE_ENV || 'development';
    return {
      port: parseInt(process.env.PORT || '3000', 10),
      nodeEnv,
      isDevelopment: nodeEnv === 'development',
      isProduction: nodeEnv === 'production',
    };
  },
);

