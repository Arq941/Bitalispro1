import { NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';

export async function GET() {
  try {
    const dashboardData = await CashService.getSupervisorDashboard();
    return NextResponse.json({ success: true, data: dashboardData }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch supervisor cash dashboard' }, { status: 400 });
  }
}
