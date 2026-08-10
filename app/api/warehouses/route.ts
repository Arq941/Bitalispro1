import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/src/inventory/inventory.service';
import { SecurityService } from '@/src/server/auth/security.service';

export async function GET() {
  try {
    const warehouses = await InventoryService.getWarehouses();
    return NextResponse.json({ success: true, warehouses });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    let userId = 'usr_system';
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const verified = SecurityService.verifyAccessToken(token);
      if (verified) userId = verified.sub;
    }

    const body = await req.json();
    const warehouse = await InventoryService.createWarehouse(body, userId);
    return NextResponse.json({ success: true, warehouse }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
