import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';
import { DATABASE_CONFIG_KEY, DatabaseConfigType, APP_CONFIG_KEY, AppConfigType } from '../config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    const dbConfig = configService.get<DatabaseConfigType>(DATABASE_CONFIG_KEY)!;
    const appConfig = configService.get<AppConfigType>(APP_CONFIG_KEY)!;
    
    const adapter = new PrismaPg({ connectionString: dbConfig.url });

    super({
      adapter,
      log: appConfig.isDevelopment ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
