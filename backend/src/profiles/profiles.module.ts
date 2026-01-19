import { Module, forwardRef } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { PartnersModule } from '../partners/partners.module';

@Module({
  imports: [forwardRef(() => PartnersModule)],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}

