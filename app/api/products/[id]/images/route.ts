import { NextRequest, NextResponse } from 'next/server';
import { PrismaService } from '@/src/database/prisma.service';
import { AuditLogService } from '@/src/audit/audit-log.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';
import { ProductMediaStorageService } from '@/src/products/product-media-storage.service';

const prisma = PrismaService.getInstance();

function statusFromError(error: unknown) {
  const message = String((error as any)?.message || '');
  if (message.includes('UNAUTHORIZED')) return 401;
  if (message.includes('FORBIDDEN')) return 403;
  if (message.includes('no encontrado')) return 404;
  return 400;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let storedKey: string | null = null;
  try {
    const ctx = await extractUserContext(req);
    await PermissionService.requirePermission(ctx.userId, 'inventory.manage');
    const { id } = await params;
    const product = await prisma.product.findUnique({ where: { id }, select: { id: true, sku: true } });
    if (!product) throw new Error('Producto no encontrado.');

    const contentType = req.headers.get('content-type') || '';
    let url = '';
    let storageKey: string | undefined;
    let isPrimary = true;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const value = form.get('image');
      if (!(value instanceof File)) throw new Error('Selecciona una imagen válida.');
      const mimeType = String(value.type || 'image/jpeg').toLowerCase();
      const buffer = Buffer.from(await value.arrayBuffer());
      const stored = await ProductMediaStorageService.store(product.id, buffer, mimeType);
      storedKey = stored.storageKey;
      storageKey = stored.storageKey;
      url = stored.url;
      isPrimary = String(form.get('isPrimary') ?? 'true') !== 'false';
    } else {
      const body = await req.json();
      url = String(body?.url || '').trim();
      storageKey = body?.storageKey ? String(body.storageKey) : undefined;
      isPrimary = Boolean(body?.isPrimary ?? body?.isMain ?? true);
      if (!url) throw new Error('La URL de imagen es obligatoria.');
    }

    const image = await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.productImage.updateMany({
          where: { productId: product.id },
          data: { isPrimary: false, isMain: false },
        });
      }
      return tx.productImage.create({
        data: {
          productId: product.id,
          url,
          storageKey,
          isPrimary,
          isMain: isPrimary,
          status: 'ACTIVE',
        },
      });
    });

    await AuditLogService.log({
      userId: ctx.userId,
      action: 'PRODUCT_IMAGE_ADDED',
      entity: 'Product',
      entityId: product.id,
      newValues: JSON.stringify({ imageId: image.id, sku: product.sku, isPrimary }),
    });

    return NextResponse.json({ success: true, image }, { status: 201 });
  } catch (error: any) {
    if (storedKey) await ProductMediaStorageService.remove(storedKey);
    return NextResponse.json(
      { success: false, error: String(error?.message || 'No se pudo guardar la imagen.') },
      { status: statusFromError(error) }
    );
  }
}
