import { registerAs } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

export const JWT_CONFIG_KEY = 'jwt';

export interface JwtConfigType {
  secret: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
}

export const jwtConfig = registerAs(
  JWT_CONFIG_KEY,
  (): JwtConfigType => ({
    secret: process.env.JWT_SECRET || 'default-dev-secret-change-in-production',
    accessExpiresIn: parseInt(process.env.JWT_ACCESS_EXPIRES_IN || '900', 10), // 15 minutes
    refreshExpiresIn: parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '604800', 10), // 7 days in seconds
  }),
);

export const getJwtModuleOptions = (config: JwtConfigType): JwtModuleOptions => ({
  secret: config.secret,
  signOptions: {
    expiresIn: config.accessExpiresIn,
  },
});

