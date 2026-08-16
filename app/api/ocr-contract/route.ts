import { NextRequest, NextResponse } from 'next/server';
import { getClientUserContext } from '@/src/crm/auth-helper';
import { PermissionService } from '@/src/server/auth/permission.service';
import { extractContractOcr } from '@/lib/ocr/contract';

export async function POST(req: NextRequest) {
  try {
    const user = getClientUserContext(req);
    await PermissionService.requirePermission(user.userId, 'clients.create');

    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ success: false, error: 'No image data provided' }, { status: 400 });
    }

    const data = await extractContractOcr({
      image: String(imageBase64),
      mimeType: typeof mimeType === 'string' && mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    const message = String(err?.message || 'Error al procesar el contrato con IA');
    const status = message.includes('UNAUTHORIZED') ? 401 : message.includes('FORBIDDEN') ? 403 : message.includes('GEMINI_API_KEY') ? 503 : 500;
    console.error('OCR Error:', err);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
