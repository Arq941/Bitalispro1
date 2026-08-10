import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/src/server/auth/auth.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, message: 'Se requiere el refresh token.' },
        { status: 400 }
      );
    }

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    const result = AuthService.refresh({ refreshToken, ipAddress, userAgent });

    if (!result.success) {
      return NextResponse.json(result, { status: 401 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Error interno en refresh.' },
      { status: 500 }
    );
  }
}
