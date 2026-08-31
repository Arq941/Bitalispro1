import { NextRequest, NextResponse } from 'next/server';
import { CashService } from '@/src/cash/cash.service';
import {requireTrustedRole} from '@/src/server/auth/request-context';
import {httpStatusForCashError} from '@/src/cash/cash-route-auth';

export async function GET(req:NextRequest) {
  try {
    requireTrustedRole(req,['ADMIN','SUPERVISORA']);
    const dashboardData = await CashService.getSupervisorDashboard();
    return NextResponse.json({ success: true, data: dashboardData }, { status: 200 });
  } catch (error: any) {
    const message=error.message||'No pudimos consultar el tablero de caja.';
    return NextResponse.json({ error: message }, { status: httpStatusForCashError(message) });
  }
}
