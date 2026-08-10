import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/src/notifications/notifications.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';

export async function GET(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    const notifications = await NotificationService.getUserNotifications(userContext.userId, 'UNREAD', userContext);
    return NextResponse.json({ success: true, data: notifications });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
