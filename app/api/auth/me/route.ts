import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/src/server/auth/auth.service';
import { SecurityService } from '@/src/server/auth/security.service';

export async function GET(req: NextRequest) {
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

    const user = AuthService.getUserById(decoded.sub);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Usuario no encontrado' }, { status: 404 });
    }

    // Verificar si la versión de permisos del token coincide con la actual del usuario
    if (decoded.permissionVersion !== user.permissionVersion) {
      return NextResponse.json(
        { success: false, message: 'La versión de permisos del token ha expirado. Vuelva a autenticarse.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        accountStatus: user.accountStatus,
        permissionVersion: user.permissionVersion,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'Error en /api/auth/me' }, { status: 500 });
  }
}
