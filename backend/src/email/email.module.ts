import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';

@Global() // Make EmailService available everywhere without importing
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}

