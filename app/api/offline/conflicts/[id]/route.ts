import { NextRequest, NextResponse } from 'next/server';
import { ConflictResolverService } from '@/src/offline/conflict-resolver.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const conflict = await ConflictResolverService.getConflictById(resolvedParams.id);

    if (!conflict) {
      return NextResponse.json(
        { success: false, error: 'Conflicto no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      conflict,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
