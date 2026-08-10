import { NextRequest, NextResponse } from 'next/server';
import { ProductService } from '@/src/products/product.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const image = await ProductService.addProductImage(
      id,
      body.url,
      Boolean(body.isPrimary || body.isMain),
      body.storageKey
    );
    return NextResponse.json({ success: true, image }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
