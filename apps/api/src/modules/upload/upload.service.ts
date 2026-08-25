import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { SUPABASE_CLIENT } from './supabase.provider';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Nothing in this app's UI displays an image anywhere near this large —
// avatars, product/offer/store photos, and ad banners are all shown at a
// few hundred px at most. Capping the *stored* file at this size (not
// upscaling smaller images) cuts storage and, more importantly, mobile
// download size — unlike web, the mobile app has no equivalent to
// next/image's automatic on-demand resizing, so a full 4000x3000 camera
// photo would otherwise be downloaded at full resolution on every screen
// that shows it, every time.
const MAX_DIMENSION_PX = 1600;

// Matches the Storage buckets that already exist on the Supabase project —
// one bucket per entity type, all public (so getPublicUrl works directly).
const ALLOWED_BUCKETS = ['avatars', 'products', 'offers', 'stores'] as const;
type UploadBucket = (typeof ALLOWED_BUCKETS)[number];

// Real content sniffing (magic bytes), not just the client-supplied
// Content-Type header — that header is attacker-controlled and trivially
// spoofed (e.g. upload a script/HTML file with `Content-Type: image/jpeg`
// set manually). Extension is derived from the *verified* type, not from
// the client-supplied filename, so a spoofed filename can't smuggle a
// dangerous extension through either.
const MAGIC_BYTES: Array<{ mime: string; ext: string; check: (buf: Buffer) => boolean }> = [
  { mime: 'image/jpeg', ext: 'jpg', check: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    ext: 'png',
    check: (b) =>
      b.length > 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  { mime: 'image/gif', ext: 'gif', check: (b) => b.length > 5 && b.toString('ascii', 0, 6) === 'GIF89a' || b.toString('ascii', 0, 6) === 'GIF87a' },
  {
    mime: 'image/webp',
    ext: 'webp',
    check: (b) => b.length > 11 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  },
];

function sniffImageType(buffer: Buffer): { mime: string; ext: string } | null {
  for (const candidate of MAGIC_BYTES) {
    if (candidate.check(buffer)) return { mime: candidate.mime, ext: candidate.ext };
  }
  return null;
}

@Injectable()
export class UploadService {
  constructor(@Inject(SUPABASE_CLIENT) private supabase: SupabaseClient) {}

  async uploadImage(
    file: { mimetype: string; size: number; buffer: Buffer },
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

    // The claimed Content-Type passed the check above, but that header is
    // client-supplied and not trustworthy on its own — verify the actual
    // bytes match a real image format before accepting the upload.
    const sniffed = sniffImageType(file.buffer);
    if (!sniffed) {
      throw new BadRequestException('File content does not match a supported image format');
    }

    // Downscale oversized images before storing — same format, same visual
    // content, just capped dimensions. GIF is deliberately left untouched:
    // sharp's resize would silently collapse an animated GIF to its first
    // frame, which would be a real (if rare) functional regression for
    // whatever avatar/content actually uses animation.
    //
    // Wrapped in try/catch rather than a trailing `.catch()` on the promise
    // chain: `sharp(buffer)` itself runs synchronously and can throw
    // synchronously (bad/truncated image data, or the native libvips
    // binding failing to load on this platform) — a throw at that point
    // happens before the promise chain exists, so a `.catch()` further
    // down the chain never sees it. That left every upload whose buffer
    // hit this path failing with an uncaught exception (500) instead of
    // falling back to the original buffer as intended.
    let uploadBuffer = file.buffer;
    if (sniffed.mime !== 'image/gif') {
      try {
        uploadBuffer = await sharp(file.buffer)
          .resize({
            width: MAX_DIMENSION_PX,
            height: MAX_DIMENSION_PX,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toBuffer();
      } catch {
        uploadBuffer = file.buffer; // sharp couldn't process it — store the original rather than failing the upload
      }
    }

    const path = `${randomUUID()}.${sniffed.ext}`;

    const { error } = await this.supabase.storage.from(bucket).upload(path, uploadBuffer, {
      contentType: sniffed.mime,
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
