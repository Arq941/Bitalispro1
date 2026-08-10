import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CollectionService } from '@/src/collections/collection.service';
import { SalesService } from '@/src/sales/sales.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = await extractUserContext(req);
    const credit = await SalesService.getCreditById(id);
    if (!credit) {
      return NextResponse.json({ success: false, error: 'Crédito no encontrado' }, { status: 404 });
    }
    const schedules = await CollectionService.getSchedulesForCredit(id);
    return NextResponse.json({ success: true, creditId: id, count: schedules.length, schedules });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error al obtener calendario' }, { status: 400 });
  }
}
