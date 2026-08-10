import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/src/inventory/inventory.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: productId } = await params;
    const { searchParams } = new URL(req.url);
    const warehouseId = searchParams.get('warehouseId') || undefined;

    const kardex = await InventoryService.getKardex(productId, warehouseId);
    return NextResponse.json({ success: true, kardex });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
