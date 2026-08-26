import { NextResponse } from 'next/server';
import { HealthService } from '@/src/health/health.service';

export async function GET() {
  const health=await HealthService.getHealth();
  return NextResponse.json(health,{status:health.status==='ok'?200:503});
}
