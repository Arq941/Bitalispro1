import fs from 'fs';
import { MediaStorageService } from '@/src/crm/media-storage.service';
import { ProductMediaStorageService } from '@/src/products/product-media-storage.service';

const PRODUCT_MEDIA_PREFIX = '/api/product-media/';
const MAX_INLINE_BYTES = 3 * 1024 * 1024;

export function isBitalisAndroidRequest(request: Request) {
  return /BITALIS-Android\//i.test(request.headers.get('user-agent') || '');
}

function storageKeyFromUrl(url?: string | null) {
  if (!url) return '';
  try {
    const value = url.startsWith('http') ? new URL(url).pathname : url.split('?')[0];
    const index = value.indexOf(PRODUCT_MEDIA_PREFIX);
    return index >= 0 ? decodeURIComponent(value.slice(index + PRODUCT_MEDIA_PREFIX.length)) : '';
  } catch {
    return '';
  }
}

export function inlineProductImageUrl(url?: string | null, storageKey?: string | null) {
  const key = String(storageKey || storageKeyFromUrl(url)).replace(/^\/+/, '');
  if (!key) return url || null;
  try {
    const absolute = MediaStorageService.resolveStoragePath(key);
    if (!fs.existsSync(absolute)) return url || null;
    const stat = fs.statSync(absolute);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_INLINE_BYTES) return url || null;
    const mime = ProductMediaStorageService.contentTypeFor(key);
    const data = fs.readFileSync(absolute).toString('base64');
    return `data:${mime};base64,${data}`;
  } catch {
    return url || null;
  }
}

export function inlineAndroidProductImages<T extends { images?: any[] }>(products: T[]) {
  return products.map((product) => ({
    ...product,
    images: Array.isArray(product.images)
      ? product.images.map((image: any) => ({
          ...image,
          url: inlineProductImageUrl(image?.url, image?.storageKey),
        }))
      : product.images,
  }));
}
