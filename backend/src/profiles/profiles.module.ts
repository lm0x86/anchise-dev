import { Module, forwardRef } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { ProfileContentService } from './profile-content.service';
import { PartnersModule } from '../partners/partners.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [forwardRef(() => PartnersModule), UploadsModule],
  controllers: [ProfilesController],
  providers: [ProfilesService, ProfileContentService],
  exports: [ProfilesService, ProfileContentService],
})
export class ProfilesModule {}

