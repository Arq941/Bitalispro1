import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { MediaStorageService } from '@/src/crm/media-storage.service';

const MAX_PRODUCT_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

function extensionFor(mimeType: string) {
  const mime = mimeType.toLowerCase();
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/heic') return '.heic';
  if (mime === 'image/heif') return '.heif';
  return '.jpg';
}

export class ProductMediaStorageService {
  static store(productId: string, buffer: Buffer, mimeType: string) {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase())) {
      throw new Error('Formato de imagen no permitido. Usa JPG, PNG, WEBP o HEIC.');
    }
    if (!buffer.length) throw new Error('La imagen está vacía.');
    if (buffer.length > MAX_PRODUCT_IMAGE_BYTES) throw new Error('La imagen no puede superar 10 MB.');

    const safeProductId = productId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeProductId) throw new Error('Producto inválido.');

    const storageKey = `products/${safeProductId}/image_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${extensionFor(mimeType)}`;
    const absolute = MediaStorageService.resolveStoragePath(storageKey);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, buffer);

    return {
      storageKey,
      url: `/api/product-media/${storageKey}`,
      mimeType: mimeType.toLowerCase(),
      fileSize: buffer.length,
    };
  }

  static remove(storageKey?: string | null) {
    if (!storageKey) return;
    try {
      const absolute = MediaStorageService.resolveStoragePath(storageKey);
      if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
    } catch {
      // Best effort cleanup only; DB operation remains authoritative.
    }
  }

  static contentTypeFor(storageKey: string) {
    const extension = path.extname(storageKey).toLowerCase();
    if (extension === '.png') return 'image/png';
    if (extension === '.webp') return 'image/webp';
    if (extension === '.heic') return 'image/heic';
    if (extension === '.heif') return 'image/heif';
    return 'image/jpeg';
  }
}
