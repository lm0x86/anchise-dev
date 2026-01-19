import { Module, forwardRef } from '@nestjs/common';
import { TributesController } from './tributes.controller';
import { TributesService } from './tributes.service';
import { PartnersModule } from '../partners/partners.module';

@Module({
  imports: [forwardRef(() => PartnersModule)],
  controllers: [TributesController],
  providers: [TributesService],
  exports: [TributesService],
})
export class TributesModule {}

