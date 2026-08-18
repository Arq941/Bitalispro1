import Decimal from 'decimal.js';

export interface FinancialCalculationParams {
  precioLista: number | string | Decimal;
  engancheCliente: number | string | Decimal;
  aporteEmpresa: number | string | Decimal;
  frecuenciaPago?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
}

export interface FinancialCalculationResult {
  precioLista: Decimal;
  engancheCliente: Decimal;
  aporteEmpresa: Decimal;
  descuentoComercialTotal: Decimal;
  saldoFinanciado: Decimal;
  cuotaMinimaSugerida: Decimal;
  esInvarianteValida: boolean;
  mensajesValidacion: string[];
}

export class FinancialRulesService {
  public static readonly APORTE_EMPRESA_MAXIMO = new Decimal(200);

  /** Iguala el enganche del cliente, con un tope empresarial de $200. */
  public static calcularAporteEmpresa(engancheCliente: number | string | Decimal): Decimal {
    const enganche = Decimal.max(new Decimal(engancheCliente), 0);
    return Decimal.min(enganche, this.APORTE_EMPRESA_MAXIMO).toDecimalPlaces(2);
  }

  /**
   * Calculador de Regla Financiera Fundamental BITALIS
   * SALDO FINANCIADO = PRECIO LISTA - ENGANCHE CLIENTE - APORTE EMPRESA
   * Invariante $1,490 - $200 - $200 = $1,090
   */
  public static calcularSaldoFinanciado(params: FinancialCalculationParams): FinancialCalculationResult {
    const precioLista = new Decimal(params.precioLista);
    const engancheCliente = new Decimal(params.engancheCliente);
    const aporteEmpresa = new Decimal(params.aporteEmpresa);

    const descuentoComercialTotal = engancheCliente.plus(aporteEmpresa);
    const saldoFinanciado = precioLista.minus(descuentoComercialTotal);

    const mensajes: string[] = [];

    // Validaciones estrictas
    if (saldoFinanciado.isNegative()) {
      mensajes.push('El saldo financiado no puede ser negativo.');
    }

    if (precioLista.lessThanOrEqualTo(0)) {
      mensajes.push('El precio de lista debe ser mayor a cero.');
    }

    // Min de cuota según frecuencia
    let cuotaMinimaSugerida = new Decimal(100);
    if (params.frecuenciaPago === 'BIWEEKLY') {
      cuotaMinimaSugerida = new Decimal(200);
    } else if (params.frecuenciaPago === 'MONTHLY') {
      cuotaMinimaSugerida = new Decimal(400);
    }

    const esInvarianteValida =
      saldoFinanciado.equals(precioLista.minus(engancheCliente).minus(aporteEmpresa)) &&
      !saldoFinanciado.isNegative();

    return {
      precioLista: precioLista.toDecimalPlaces(2),
      engancheCliente: engancheCliente.toDecimalPlaces(2),
      aporteEmpresa: aporteEmpresa.toDecimalPlaces(2),
      descuentoComercialTotal: descuentoComercialTotal.toDecimalPlaces(2),
      saldoFinanciado: saldoFinanciado.toDecimalPlaces(2),
      cuotaMinimaSugerida: cuotaMinimaSugerida.toDecimalPlaces(2),
      esInvarianteValida,
      mensajesValidacion: mensajes,
    };
  }

  /**
   * Valida que una venta no contenga más de 2 productos
   */
  public static validarLimiteProductosVenta(itemsCount: number): { valido: boolean; mensaje?: string } {
    if (itemsCount > 2) {
      return {
        valido: false,
        mensaje: 'Restricción de backend: Una venta no puede incluir más de 2 productos.',
      };
    }
    return { valido: true };
  }

  /**
   * Valida que el aporte de empresa sea tratado como DESCUENTO COMERCIAL y NO como efectivo de caja.
   */
  public static esDescuentoComercialPuro(aporteEmpresa: number | Decimal): boolean {
    const val = new Decimal(aporteEmpresa);
    return val.greaterThanOrEqualTo(0);
  }

  /**
   * Valida el aporte de empresa y cuotas mínimas
   */
  public static validarAporteEmpresa(precioLista: number, aporteEmpresa: number): { valido: boolean; mensaje?: string } {
    if (aporteEmpresa < 0) {
      return { valido: false, mensaje: 'El aporte de empresa no puede ser negativo.' };
    }
    if (aporteEmpresa > precioLista) {
      return { valido: false, mensaje: 'El aporte de empresa no puede exceder el precio de lista.' };
    }
    return { valido: true };
  }
}
