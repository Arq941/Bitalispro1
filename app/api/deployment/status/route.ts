import { NextResponse } from 'next/server';
import { HealthService } from '@/src/health/health.service';
import { BITALIS_BUILD_COMMIT } from '@/lib/generated/buildInfo';

export async function GET() {
  const health=await HealthService.getHealth();
  return NextResponse.json({
    environment: process.env.NODE_ENV || 'production',
    version: '1.0.0',
    commit: BITALIS_BUILD_COMMIT,
    database: health.database,
    storage: health.storage,
  },{status:health.status==='ok'?200:503});
}
