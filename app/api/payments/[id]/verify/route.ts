import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CollectionService } from '@/src/collections/collection.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = await extractUserContext(req);
    const body = await req.json();
    const result = await CollectionService.verifyPayment(
      id,
      body.action || 'VERIFY',
      body.notes,
      userContext,
      body.idempotencyKey
    );
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error al verificar transferencia' }, { status: 400 });
  }
}
