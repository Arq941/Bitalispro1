import { NextResponse } from 'next/server';
import { HealthService } from '@/src/health/health.service';

export async function GET() {
  return NextResponse.json(HealthService.getHealth());
}
