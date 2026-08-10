import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/src/inventory/inventory.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: productId } = await params;
    const { searchParams } = new URL(req.url);
    const warehouseId = searchParams.get('warehouseId') || 'WH_CENTRAL_01';

    const stock = await InventoryService.getStock(warehouseId, productId);
    return NextResponse.json({ success: true, stock });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
