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

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'Se requieren la contraseña actual y la nueva contraseña.' },
        { status: 400 }
      );
    }

    const result = await AuthService.changePassword({
      userId: decoded.sub,
      currentPassword,
      newPassword,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'Error al cambiar la contraseña' }, { status: 500 });
  }
}
