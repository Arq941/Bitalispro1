import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { SalesService } from '@/src/sales/sales.service';

export async function GET(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    const credits = await SalesService.getAllCredits();
    return NextResponse.json({ success: true, count: credits.length, clients: credits });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error al obtener clientes' }, { status: 400 });
  }
}
