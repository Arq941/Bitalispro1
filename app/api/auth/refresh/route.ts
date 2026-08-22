import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/src/server/auth/auth.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(()=>({}));
    const refreshToken = req.cookies.get('bitalis_refresh_token')?.value || body.refreshToken;

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

    const {refreshToken:newRefreshToken,...publicResult}=result;
    const response=NextResponse.json(publicResult);
    if(newRefreshToken)response.cookies.set('bitalis_refresh_token',newRefreshToken,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/auth',maxAge:7*24*60*60});
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Error interno en refresh.' },
      { status: 500 }
    );
  }
}
