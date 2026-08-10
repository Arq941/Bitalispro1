import { NextRequest, NextResponse } from 'next/server';
import { ProductService } from '@/src/products/product.service';
import { SecurityService } from '@/src/server/auth/security.service';

export async function GET() {
  try {
    const categories = await ProductService.getCategories();
    return NextResponse.json({ success: true, categories });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    let userId = 'usr_system';
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const verified = SecurityService.verifyAccessToken(token);
      if (verified) userId = verified.sub;
    }

    const body = await req.json();
    const category = await ProductService.createCategory(body, userId);
    return NextResponse.json({ success: true, category }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
