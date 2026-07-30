import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UploadService } from './upload.service';

@ApiTags('upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private service: UploadService) {}

  @ApiConsumes('multipart/form-data')
  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(@UploadedFile() file: Express.Multer.File, @Body('bucket') bucket?: string) {
    // bucket: "avatars" | "products" | "offers" | "stores" — matches the
    // Storage buckets that already exist on the Supabase project.
    return this.service.uploadImage(file, bucket);
  }
}
