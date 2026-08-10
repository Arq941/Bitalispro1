import crypto from 'crypto';

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

export class MediaStorageService {
  /**
   * Genera metadata y abstrae el almacenamiento de archivos (compatible con Supabase Storage / S3)
   */
  public static processMediaUpload(params: MediaUploadParams) {
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const storageKey = `clients/${params.clientId}/${params.mediaType.toLowerCase()}_${timestamp}_${randomSuffix}`;
    
    let checksum = '';
    if (params.fileContent) {
      checksum = crypto.createHash('sha256').update(params.fileContent).digest('hex');
    } else {
      checksum = crypto.createHash('sha256').update(`${storageKey}_${timestamp}`).digest('hex');
    }

    const publicUrl = params.url || `https://storage.supabase.co/v0/object/public/crm-media/${storageKey}`;

    return {
      storageKey,
      url: publicUrl,
      checksum,
      mimeType: params.mimeType || 'image/jpeg',
      fileSize: params.fileSize || 1024 * 250, // 250 KB default
    };
  }
}
