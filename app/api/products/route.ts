import { NextRequest, NextResponse } from 'next/server';
import { ProductService } from '@/src/products/product.service';
import { getSalesUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';

function statusFromError(error: unknown, fallback: number) {
  const message = String((error as any)?.message || '');
  if (message.includes('UNAUTHORIZED')) return 401;
  if (message.includes('FORBIDDEN')) return 403;
  return fallback;
}

export async function GET(req: NextRequest) {
  try {
    const ctx = getSalesUserContext(req);
    await PermissionService.requirePermission(ctx.userId, 'inventory.view');
    const products = await ProductService.getProducts();
    return NextResponse.json({ success: true, products });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: statusFromError(err, 500) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = getSalesUserContext(req);
    await PermissionService.requirePermission(ctx.userId, 'inventory.manage');
    const body = await req.json();
    const product = await ProductService.createProduct(body, ctx.userId);
    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: statusFromError(err, 400) });
  }
}
