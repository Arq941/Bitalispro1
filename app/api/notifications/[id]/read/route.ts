import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/src/notifications/notifications.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = await extractUserContext(req);
    const notification = await NotificationService.markAsRead(id, userContext.userId);
    return NextResponse.json({ success: true, data: notification });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
