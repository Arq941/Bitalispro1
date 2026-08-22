import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/src/server/auth/auth.service';
import { SecurityService } from '@/src/server/auth/security.service';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = SecurityService.verifyAccessToken(token);

    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Token inválido o expirado' }, { status: 401 });
    }

    const revokedCount = AuthService.logoutAll(decoded.sub);
    const response=NextResponse.json({
      success: true,
      revokedSessionsCount: revokedCount,
      message: 'Todas las sesiones activas han sido cerradas.',
    });
    response.cookies.set('bitalis_refresh_token','',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/auth',maxAge:0});
    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'Error en logout-all' }, { status: 500 });
  }
}
