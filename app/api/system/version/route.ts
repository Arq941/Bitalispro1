import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: '1.0.0',
    phase: 1,
    phaseName: 'Foundation ERP+CRM Infrastructure',
    buildTimestamp: new Date().toISOString(),
  });
}
