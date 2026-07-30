import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { SupabaseProvider } from './supabase.provider';

@Module({
  controllers: [UploadController],
  providers: [UploadService, SupabaseProvider],
  exports: [UploadService],
})
export class UploadModule {}
