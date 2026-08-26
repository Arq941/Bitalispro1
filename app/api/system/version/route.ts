import { NextResponse } from 'next/server';
import { BITALIS_BUILD_COMMIT } from '@/lib/generated/buildInfo';

export async function GET() {
  return NextResponse.json({
    version: '1.0.0',
    commit: BITALIS_BUILD_COMMIT,
    marker: 'client-build-coherence',
  });
}
