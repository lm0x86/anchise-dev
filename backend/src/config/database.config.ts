import { registerAs } from '@nestjs/config';

export const DATABASE_CONFIG_KEY = 'database';

export interface DatabaseConfigType {
  url: string;
}

export const databaseConfig = registerAs(
  DATABASE_CONFIG_KEY,
  (): DatabaseConfigType => ({
    url: process.env.DATABASE_URL || '',
  }),
);

