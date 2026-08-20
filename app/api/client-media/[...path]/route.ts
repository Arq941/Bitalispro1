import { NextRequest, NextResponse } from 'next/server';
import { PrismaService } from '@/src/database/prisma.service';
import { getClientUserContext } from '@/src/crm/auth-helper';
import { MediaStorageService } from '@/src/crm/media-storage.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const user = getClientUserContext(req);
    const { path } = await params;
    const storageKey = path.join('/');
    const prisma = PrismaService.getInstance();
    const media = await prisma.clientMedia.findFirst({ where: { storageKey } });
    if (!media) return NextResponse.json({ error: 'Evidencia no encontrada.' }, { status: 404 });
    if (user.role === 'VENDEDORA') return NextResponse.json({ error: 'El rol de vendedora no puede visualizar imágenes.' }, { status: 403 });
    const stored = await MediaStorageService.read(storageKey,media.mimeType||'image/jpeg');
    if (!stored) {
      if (media.url && /^https:\/\//i.test(media.url)) return NextResponse.redirect(media.url);
      return NextResponse.json({ error: 'El archivo de evidencia no está disponible.' }, { status: 404 });
    }
    return new NextResponse(stored.content, { headers: { 'Content-Type': stored.mimeType || media.mimeType || 'image/jpeg', 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
  } catch (err: any) {
    const message = String(err?.message || 'No pudimos abrir la evidencia.');
    return NextResponse.json({ error: message }, { status: message.includes('UNAUTHORIZED') ? 401 : 500 });
  }
}
