import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/database/prisma.service';

export async function GET(req: NextRequest) {
  try {
    const totalOps = await prisma.syncOperation.count();
    const queuedOps = await prisma.syncOperation.count({ where: { status: 'QUEUED' } });
    const syncedOps = await prisma.syncOperation.count({ where: { status: 'SYNCED' } });
    const conflictOps = await prisma.syncOperation.count({ where: { status: 'CONFLICT' } });
    const rejectedOps = await prisma.syncOperation.count({ where: { status: 'REJECTED' } });
    const failedOps = await prisma.syncOperation.count({ where: { status: 'FAILED' } });

    const openConflicts = await prisma.syncConflict.count({ where: { resolvedAt: null } });
    const resolvedConflicts = await prisma.syncConflict.count({ where: { resolvedAt: { not: null } } });

    return NextResponse.json({
      success: true,
      status: 'OPERATIONAL',
      syncEngine: {
        totalOperations: totalOps,
        queued: queuedOps,
        synced: syncedOps,
        conflict: conflictOps,
        rejected: rejectedOps,
        failed: failedOps,
      },
      conflicts: {
        totalOpen: openConflicts,
        totalResolved: resolvedConflicts,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
