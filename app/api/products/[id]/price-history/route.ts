import { NextRequest, NextResponse } from 'next/server';
import { ProductService } from '@/src/products/product.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const history = await ProductService.getPriceHistory(id);
    return NextResponse.json({ success: true, history });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
