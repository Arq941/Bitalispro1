import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CollectionService } from '@/src/collections/collection.service';

export async function GET(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined;
    const lng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : undefined;

    const gpsCoords = lat && lng ? { latitude: lat, longitude: lng } : undefined;
    const route = await CollectionService.getCollectorRouteToday(userContext, gpsCoords);
    return NextResponse.json({ success: true, count: route.length, route });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error al obtener la ruta del día' }, { status: 400 });
  }
}
