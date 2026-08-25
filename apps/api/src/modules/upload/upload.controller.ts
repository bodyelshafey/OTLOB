import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UploadService } from './upload.service';

@ApiTags('upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private service: UploadService) {}

  @ApiConsumes('multipart/form-data')
  // Rejects oversized bodies at the multipart-parsing stage instead of
  // buffering the whole thing into memory first — the service-level size
  // check alone runs too late to prevent that.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  // Uploads are more expensive (network + storage) than a typical read —
  // capped tighter than the general default so one account can't hammer
  // storage costs or flood the bucket.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('image')
  uploadImage(@UploadedFile() file: Express.Multer.File, @Body('bucket') bucket?: string) {
    // bucket: "avatars" | "products" | "offers" | "stores" — matches the
    // Storage buckets that already exist on the Supabase project.
    return this.service.uploadImage(file, bucket);
  }
}
