import { NextRequest, NextResponse } from 'next/server';
import { ConflictResolverService } from '@/src/offline/conflict-resolver.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as any;
    const conflictType = searchParams.get('conflictType') || undefined;
    const severity = searchParams.get('severity') || undefined;

    const conflicts = await ConflictResolverService.listConflicts({
      status: status || 'ALL',
      conflictType,
      severity,
    });

    return NextResponse.json({
      success: true,
      count: conflicts.length,
      conflicts,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
