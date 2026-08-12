import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { PrismaService } from '@/src/database/prisma.service';
import { getClientUserContext } from '@/src/crm/auth-helper';
import { ClientService } from '@/src/crm/client.service';
import { MediaStorageService } from '@/src/crm/media-storage.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const user = getClientUserContext(req);
    const { path } = await params;
    const storageKey = path.join('/');
    const prisma = PrismaService.getInstance();
    const media = await prisma.clientMedia.findFirst({ where: { storageKey } });
    if (!media) return NextResponse.json({ error: 'Evidencia no encontrada.' }, { status: 404 });
    const allowed = await ClientService.checkClientAccess(media.clientId, user);
    if (!allowed) return NextResponse.json({ error: 'No tienes acceso a esta evidencia.' }, { status: 403 });
    const absolute = MediaStorageService.resolveStoragePath(storageKey);
    if (!fs.existsSync(absolute)) return NextResponse.json({ error: 'El archivo de evidencia no está disponible.' }, { status: 404 });
    const bytes = fs.readFileSync(absolute);
    return new NextResponse(bytes, { headers: { 'Content-Type': media.mimeType || 'image/jpeg', 'Cache-Control': 'private, max-age=300' } });
  } catch (err: any) {
    const message = String(err?.message || 'No pudimos abrir la evidencia.');
    return NextResponse.json({ error: message }, { status: message.includes('UNAUTHORIZED') ? 401 : 500 });
  }
}
