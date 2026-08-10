import { NextRequest, NextResponse } from 'next/server';
import { InventoryReorderEngine } from '@/src/procurement/procurement.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';

export async function GET(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    const { searchParams } = new URL(req.url);
    const warehouseId = searchParams.get('warehouseId') || undefined;

    const suggestions = await InventoryReorderEngine.evaluateStockAndGenerateAlerts(warehouseId);
    return NextResponse.json({ success: true, data: suggestions });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
