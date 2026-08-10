import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/src/notifications/notifications.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';

export async function POST(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    const count = await NotificationService.markAllAsRead(userContext.userId);
    return NextResponse.json({ success: true, count });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
