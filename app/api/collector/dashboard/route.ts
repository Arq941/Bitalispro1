import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CollectionService } from '@/src/collections/collection.service';

export async function GET(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    const dashboard = await CollectionService.getCollectorDashboard(userContext);
    return NextResponse.json({ success: true, dashboard });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error al obtener dashboard' }, { status: 400 });
  }
}
