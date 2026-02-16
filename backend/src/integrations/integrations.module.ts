import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

// INSEE integration
import { InseeService, InseeSyncService, InseeFileSyncService } from './insee';

// Controller
import { IntegrationsController } from './integrations.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
  ],
  providers: [
    // INSEE
    InseeService,
    InseeSyncService,
    InseeFileSyncService,
    // Future integrations go here...
  ],
  controllers: [IntegrationsController],
  exports: [
    InseeService,
    InseeSyncService,
    InseeFileSyncService,
  ],
})
export class IntegrationsModule {}

