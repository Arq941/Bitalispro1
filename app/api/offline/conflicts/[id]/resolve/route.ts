import { NextRequest, NextResponse } from 'next/server';
import { ConflictResolverService } from '@/src/offline/conflict-resolver.service';
import { requireTrustedRole } from '@/src/server/auth/request-context';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const supervisor = requireTrustedRole(req,['ADMIN','SUPERVISORA']);
    const body = await req.json();

    if (!body.resolution || !['FORCE_SYNC', 'REJECT', 'REVIEW'].includes(body.resolution)) {
      return NextResponse.json(
        { success: false, error: 'Resolución inválida. Debe ser FORCE_SYNC, REJECT o REVIEW.' },
        { status: 400 }
      );
    }

    const resolved = await ConflictResolverService.resolveConflict({
      conflictId: resolvedParams.id,
      supervisorId: supervisor.userId,
      resolution: body.resolution,
      notes: body.notes || body.resolutionNotes,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || 'NextJS-API',
    });

    return NextResponse.json({
      success: true,
      message: `Conflicto ${resolvedParams.id} resuelto como ${body.resolution}`,
      conflict: resolved,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: String(error?.message||'').startsWith('UNAUTHORIZED')?401:String(error?.message||'').startsWith('FORBIDDEN')?403:500 }
    );
  }
}
