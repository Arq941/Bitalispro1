import fs from 'fs';
import { NextResponse } from 'next/server';
import { PrismaService } from '@/src/database/prisma.service';
import { MediaStorageService } from '@/src/crm/media-storage.service';
import { ProductMediaStorageService } from '@/src/products/product-media-storage.service';

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const storageKey = path.join('/');
    const prisma = PrismaService.getInstance();
    const image = await prisma.productImage.findFirst({ where: { storageKey, status: 'ACTIVE' } });
    if (!image) return NextResponse.json({ error: 'Imagen no encontrada.' }, { status: 404 });

    const absolute = MediaStorageService.resolveStoragePath(storageKey);
    if (!fs.existsSync(absolute)) return NextResponse.json({ error: 'La imagen no está disponible.' }, { status: 404 });

    const bytes = fs.readFileSync(absolute);
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': ProductMediaStorageService.contentTypeFor(storageKey),
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'No pudimos abrir la imagen.') }, { status: 500 });
  }
}
