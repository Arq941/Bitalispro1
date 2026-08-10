import { NextRequest, NextResponse } from 'next/server';
import { ProductService } from '@/src/products/product.service';
import { SecurityService } from '@/src/server/auth/security.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    let userId = 'usr_system';
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const verified = SecurityService.verifyAccessToken(token);
      if (verified) userId = verified.sub;
    }

    const body = await req.json();
    const price = await ProductService.setProductPrice(
      id,
      body.priceType,
      body.amount || body.price,
      userId,
      body.reason,
      body.idempotencyKey,
      req.headers.get('x-forwarded-for') || undefined
    );
    return NextResponse.json({ success: true, price }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
