import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CollectionService } from '@/src/collections/collection.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = await extractUserContext(req);
    const body = await req.json();
    const result = await CollectionService.createPromise(id, body, userContext);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error al crear promesa de pago' }, { status: 400 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = await extractUserContext(req);
    const promises = await CollectionService.getPromisesForCredit(id);
    return NextResponse.json({ success: true, creditId: id, count: promises.length, promises });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error al obtener promesas' }, { status: 400 });
  }
}
