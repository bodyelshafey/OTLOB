import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { SUPABASE_CLIENT } from './supabase.provider';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Matches the Storage buckets that already exist on the Supabase project —
// one bucket per entity type, all public (so getPublicUrl works directly).
const ALLOWED_BUCKETS = ['avatars', 'products', 'offers', 'stores'] as const;
type UploadBucket = (typeof ALLOWED_BUCKETS)[number];

@Injectable()
export class UploadService {
  constructor(@Inject(SUPABASE_CLIENT) private supabase: SupabaseClient) {}

  async uploadImage(
    file: Express.Multer.File,
    bucket: string = 'products',
  ): Promise<{ url: string; path: string; bucket: string }> {
    if (!file) throw new BadRequestException('No file provided');
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, WEBP, or GIF images are allowed');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('Image must be smaller than 5MB');
    }
    if (!ALLOWED_BUCKETS.includes(bucket as UploadBucket)) {
      throw new BadRequestException(`bucket must be one of: ${ALLOWED_BUCKETS.join(', ')}`);
    }

    const extension = file.originalname.split('.').pop() ?? 'jpg';
    const path = `${randomUUID()}.${extension}`;

    const { error } = await this.supabase.storage.from(bucket).upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

    if (error) {
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }

    const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl, path, bucket };
  }

  async deleteImage(bucket: string, path: string): Promise<void> {
    await this.supabase.storage.from(bucket).remove([path]);
  }
}
