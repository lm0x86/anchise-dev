import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig, databaseConfig, jwtConfig, awsConfig, emailConfig } from './config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { ProfilesModule } from './profiles/profiles.module';
import { TributesModule } from './tributes/tributes.module';
import { PartnersModule } from './partners/partners.module';
import { UploadsModule } from './uploads/uploads.module';
import { EmailModule } from './email/email.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig, databaseConfig, jwtConfig, awsConfig, emailConfig],
    }),
    PrismaModule,
    EmailModule,
    AuthModule,
    HealthModule,
    ProfilesModule,
    TributesModule,
    PartnersModule,
    UploadsModule,
    IntegrationsModule,
    UsersModule,
  ],
})
export class AppModule {}
