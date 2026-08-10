import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CollectionService } from '@/src/collections/collection.service';

export async function POST(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    const body = await req.json();
    const result = await CollectionService.recordVisit(body, userContext);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error al registrar visita de cobranza' }, { status: 400 });
  }
}
