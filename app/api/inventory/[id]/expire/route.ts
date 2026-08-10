import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/src/inventory/inventory.service';
import { SecurityService } from '@/src/server/auth/security.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: reservationId } = await params;
    const authHeader = req.headers.get('authorization');
    let userId = 'usr_system';
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const verified = SecurityService.verifyAccessToken(token);
      if (verified) userId = verified.sub;
    }

    const result = await InventoryService.expireReservations(userId);
    return NextResponse.json({ success: true, expired: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
