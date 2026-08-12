import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface MediaUploadParams {
  clientId: string;
  mediaType: string;
  url?: string;
  fileContent?: string | Buffer;
  mimeType?: string;
  fileSize?: number;
  latitude?: number;
  longitude?: number;
  uploadedBy?: string;
}

function extensionFor(mimeType?: string) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('heic') || mime.includes('heif')) return '.heic';
  return '.jpg';
}

export class MediaStorageService {
  public static storageRoot() {
    return process.env.BITALIS_UPLOAD_DIR || path.join(process.cwd(), 'storage', 'client-media');
  }

  public static resolveStoragePath(storageKey: string) {
    const clean = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
    const root = path.resolve(this.storageRoot());
    const absolute = path.resolve(root, clean);
    if (!absolute.startsWith(root + path.sep) && absolute !== root) throw new Error('Ruta de archivo inválida.');
    return absolute;
  }

  /**
   * Persiste evidencia en disco y genera metadata. En Hostinger puede apuntarse
   * BITALIS_UPLOAD_DIR a una carpeta persistente fuera del directorio de build.
   */
  public static processMediaUpload(params: MediaUploadParams) {
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(6).toString('hex');
    const extension = extensionFor(params.mimeType);
    const storageKey = `clients/${params.clientId}/${params.mediaType.toLowerCase()}_${timestamp}_${randomSuffix}${extension}`;

    let buffer: Buffer | null = null;
    if (Buffer.isBuffer(params.fileContent)) buffer = params.fileContent;
    else if (typeof params.fileContent === 'string' && params.fileContent) {
      const base64 = params.fileContent.includes(',') ? params.fileContent.split(',').pop() || '' : params.fileContent;
      buffer = Buffer.from(base64, 'base64');
    }

    const checksum = crypto.createHash('sha256').update(buffer || `${storageKey}_${timestamp}`).digest('hex');
    if (buffer?.length) {
      const absolute = this.resolveStoragePath(storageKey);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, buffer);
    }

    return {
      storageKey,
      url: params.url || `/api/client-media/${storageKey}`,
      checksum,
      mimeType: params.mimeType || 'image/jpeg',
      fileSize: params.fileSize || buffer?.length || 0,
    };
  }
}
