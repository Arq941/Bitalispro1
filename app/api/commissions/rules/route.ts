import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CommissionService } from '@/src/commissions/commission.service';

export async function GET(req: NextRequest) {
  try {
    const role = req.nextUrl.searchParams.get('role') || undefined;
    const rules = await CommissionService.getCommissionRules(role);

    return NextResponse.json({
      success: true,
      rules,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al consultar reglas de comisiones' },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    const body = await req.json();

    const rule = await CommissionService.upsertCommissionRule({
      role: body.role,
      ruleType: body.ruleType,
      rate: body.rate,
      minDownPaymentPercentage: body.minDownPaymentPercentage,
      description: body.description,
    });

    return NextResponse.json({
      success: true,
      rule,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al guardar regla de comisión' },
      { status: 400 }
    );
  }
}
