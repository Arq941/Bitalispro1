import { NextRequest } from 'next/server';
import { GET as runPhase9Tests } from '@/app/api/offline/run-phase9-tests/route';

export async function GET(req: NextRequest) {
  return runPhase9Tests(req);
}
