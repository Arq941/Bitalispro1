import { NextRequest, NextResponse } from 'next/server';
import { OfflineSyncService } from '@/src/offline/offline-sync.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';

export async function POST(req: NextRequest) {
  try {
    const user = await extractUserContext(req);
    const body = await req.json();
    const deviceId = body.deviceId || 'DEVICE-UNKNOWN';
    const authUserId = user.userId;

    let operations = [];
    if (Array.isArray(body.operations)) {
      operations = body.operations;
    } else if (body.idempotencyKey) {
      operations = [body];
    } else {
      return NextResponse.json(
        { success: false, error: 'Payload de sincronización inválido. Se requieren operaciones o idempotencyKey.' },
        { status: 400 }
      );
    }

    const results = await OfflineSyncService.processSyncBatch(deviceId, authUserId, operations);

    const hasConflicts = results.some((r) => r.status === 'CONFLICT');
    const hasRejections = results.some((r) => r.status === 'REJECTED');
    const hasFailures = results.some((r) => r.status === 'FAILED');

    return NextResponse.json({
      success: !hasFailures,
      processedCount: results.length,
      syncedCount: results.filter((r) => r.status === 'SYNCED').length,
      duplicateCount: results.filter((r) => r.status === 'DUPLICATE').length,
      conflictCount: results.filter((r) => r.status === 'CONFLICT').length,
      rejectedCount: results.filter((r) => r.status === 'REJECTED').length,
      failedCount: results.filter((r) => r.status === 'FAILED').length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error durante la sincronización' },
      { status: String(error?.message||'').includes('UNAUTHORIZED') ? 401 : String(error?.message||'').startsWith('FORBIDDEN:') ? 403 : 500 }
    );
  }
}
