export type UserRole = 
  | 'vendedora'
  | 'sup_vendedores'
  | 'cobrador'
  | 'sup_cobradores'
  | 'admin';

export type MorosidadStatus = 'VERDE' | 'AMARILLO' | 'ROJO';

export type VentaEstado = 'PENDIENTE_VALIDACION' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA';

export type VentaTipo = 'CREDITO' | 'CONTADO';

export type DiaSemana = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo';

export interface Producto {
  id: number;
  nombre: string;
  precioBase: number;
  precioContado?: number;
  engancheMinimo: number;
  descuentoEmpresa?: number;
  pagoSemanalSugerido: number;
  descripcion: string;
  categoria: string;
  fotoUrl?: string;
  activo: boolean;
  stock?: number;
  stockMinimo?: number;
  fechaCompra?: string;
  proveedor?: string;
}

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  usuario?: string;
  password?: string;
  pin?: string;
  rol: UserRole;
  telefono: string;
  activo: boolean;
  avatarUrl?: string;
  sueldoBase?: number;
  porcentajeComision?: number;
  comisionPorVenta?: number;
}

export interface Zona {
  id: number;
  nombre: string;
  diaCobro: DiaSemana;
  colonias: string[];
  cuadrante: string;
  descripcion: string;
  secuenciaCalles?: string[];
}

export interface Cliente {
  id: number;
  folio: string;
  nombreCompleto: string;
  direccion: string;
  colonia?: string;
  entreCalles?: string;
  referencias: string;
  telefono: string;
  latitud: number;
  longitud: number;
  latitudSecundaria?: number;
  longitudSecundaria?: number;
  zonaId: number;
  zonaNombre?: string;
  fotoFachada?: string;
  fotoCliente?: string;
  fotoContrato?: string;
  fotoIdentificacion?: string;
  tarjetaImpresa: boolean;
  estadoMorosidad: MorosidadStatus;
  fechaRegistro: string;
  creadoPorVendedoraId: number;
  vendedoraNombre?: string;
  creadoPorUsuarioId?: number;
  creadoPorUsuarioNombre?: string;
  fotosEditadasPorNombre?: string;
  fotosEditadasFecha?: string;
  diaCobroZona?: string;
  ordenRuta?: number;
  instruccionRuta?: string;
  notaUrgente?: string;
  fechaNotaUrgente?: string;
  proximoPagoFecha?: string;
  deudaCalculada?: number;
  diasMora?: number;
  frecuenciaPago?: 'SEMANAL' | 'CATORCENAL' | 'QUINCENAL' | 'MENSUAL';
  enganchePendiente?: boolean;
  enganchePendienteMonto?: number;
}

export interface Venta {
  id: number;
  clienteId: number;
  clienteNombre?: string;
  clienteFolio?: string;
  vendedoraId: number;
  vendedoraNombre?: string;
  supervisorId?: number;
  supervisoraAprobadoPor?: string;
  fechaAprobacion?: string;
  productoId?: number;
  productoNombre?: string;
  piezas?: number;
  tipo: VentaTipo;
  precioBase: number;
  montoACobrarContado?: number;
  engancheMonto?: number;
  engancheEstatus?: string;
  enganchePagado?: boolean;
  engancheCobrado?: boolean;
  enganchePendiente?: boolean;
  enganchePendienteMonto?: number;
  lugarCobroEnganche?: 'SUPERVISION' | 'RUTA_COBRADOR';
  frecuenciaPago?: 'SEMANAL' | 'CATORCENAL' | 'QUINCENAL' | 'MENSUAL';
  esquemaPagoTipo?: 'SEMANAL' | 'QUINCENAL' | 'CORTO_2_PAGOS' | 'CORTO_3_PAGOS';
  aporteEmpresa: number;
  descuentoOtorgado: number;
  saldoInicial: number;
  saldoActual: number;
  pagoSemanal: number;
  abonoSemanal?: number;
  comisionVendedora?: number;
  estado: VentaEstado;
  fechaVenta: string;
  fechaPrimerPago: string;
  diaCobroZona?: DiaSemana;
  archivadoHistorico?: boolean;
  fechaArchivoHistorico?: string;
}

export interface Abono {
  id: number;
  ventaId: number;
  clienteId: number;
  clienteNombre?: string;
  clienteFolio?: string;
  cobradorId: number;
  cobradorNombre?: string;
  monto: number;
  tipoPago: 'EFECTIVO' | 'TRANSFERENCIA' | 'MIXTO';
  semanaNumero: number;
  observaciones?: string;
  fechaPago: string;
  latitudCobro?: number;
  longitudCobro?: number;
  waEnviado?: boolean;
  esEnganche?: boolean;
  fechaProximoPago?: string;
  lugarCobroEnganche?: 'SUPERVISION' | 'RUTA_COBRADOR';
}

export interface CorteCaja {
  id: number;
  usuarioId: number;
  usuarioNombre?: string;
  rolTipo: 'VENDEDORA' | 'SUPERVISOR_VEND' | 'COBRADOR' | 'SUPERVISOR_COBR';
  fecha: string;
  fondoInicial: number;
  gastosGasolina: number;
  viaticos: number;
  efectivoRecolectado: number;
  efectivoEntregado: number;
  diferencia: number;
  estado: 'ABIERTO' | 'CERRADO' | 'AUDITADO';
  observaciones?: string;
}

export interface PuntoRutaOptimizado {
  orden: number;
  cliente: Cliente;
  distanciaAnteriorKm: number;
}

export interface CambioCampo {
  campo: string;
  valorAnterior: string;
  valorNuevo: string;
}

export interface LogAuditoria {
  id: number;
  fechaHora: string;
  usuarioId: number;
  usuarioNombre: string;
  usuarioRol: UserRole | string;
  tipoEntidad: 'CLIENTE' | 'VENTA' | 'ABONO';
  entidadId: number;
  entidadFolio?: string;
  clienteNombre?: string;
  accion: 'CREACION' | 'EDICION' | 'ELIMINACION' | 'APROBACION' | 'RECHAZO';
  resumenCambio: string;
  cambios: CambioCampo[];
}

export function diffCliente(oldC: Cliente, newC: Cliente): CambioCampo[] {
  const diffs: CambioCampo[] = [];
  if (oldC.nombreCompleto !== newC.nombreCompleto) {
    diffs.push({ campo: 'Nombre Completo', valorAnterior: oldC.nombreCompleto || '-', valorNuevo: newC.nombreCompleto || '-' });
  }
  if (oldC.direccion !== newC.direccion) {
    diffs.push({ campo: 'Dirección Domicilio', valorAnterior: oldC.direccion || '-', valorNuevo: newC.direccion || '-' });
  }
  if (oldC.colonia !== newC.colonia) {
    diffs.push({ campo: 'Colonia', valorAnterior: oldC.colonia || '-', valorNuevo: newC.colonia || '-' });
  }
  if (oldC.referencias !== newC.referencias) {
    diffs.push({ campo: 'Referencias Domicilio', valorAnterior: oldC.referencias || '-', valorNuevo: newC.referencias || '-' });
  }
  if (oldC.telefono !== newC.telefono) {
    diffs.push({ campo: 'Teléfono de Contacto', valorAnterior: oldC.telefono || '-', valorNuevo: newC.telefono || '-' });
  }
  if (oldC.zonaId !== newC.zonaId || oldC.zonaNombre !== newC.zonaNombre) {
    diffs.push({ campo: 'Zona Asignada', valorAnterior: `${oldC.zonaNombre || oldC.zonaId}`, valorNuevo: `${newC.zonaNombre || newC.zonaId}` });
  }
  if (oldC.estadoMorosidad !== newC.estadoMorosidad) {
    diffs.push({ campo: 'Estatus de Morosidad', valorAnterior: oldC.estadoMorosidad || '-', valorNuevo: newC.estadoMorosidad || '-' });
  }
  if (oldC.latitud !== newC.latitud || oldC.longitud !== newC.longitud) {
    diffs.push({ campo: 'Ubicación GPS (Lat/Lng)', valorAnterior: `${oldC.latitud}, ${oldC.longitud}`, valorNuevo: `${newC.latitud}, ${newC.longitud}` });
  }
  if (oldC.fotoFachada !== newC.fotoFachada) {
    diffs.push({ campo: 'Foto Fachada Domicilio', valorAnterior: 'Fotografía anterior', valorNuevo: 'Nueva foto cargada' });
  }
  if (oldC.fotoCliente !== newC.fotoCliente) {
    diffs.push({ campo: 'Foto Cliente / Identificación', valorAnterior: 'Fotografía anterior', valorNuevo: 'Nueva foto cargada' });
  }
  if (oldC.fotoContrato !== newC.fotoContrato) {
    diffs.push({ campo: 'Foto Contrato Firmado', valorAnterior: 'Fotografía anterior', valorNuevo: 'Nueva foto cargada' });
  }
  if (oldC.fotosEditadasPorNombre !== newC.fotosEditadasPorNombre) {
    diffs.push({ campo: 'Fotografías Editadas Por', valorAnterior: oldC.fotosEditadasPorNombre || 'Sin edición previa', valorNuevo: newC.fotosEditadasPorNombre || '-' });
  }
  if (oldC.notaUrgente !== newC.notaUrgente) {
    diffs.push({ campo: 'Nota Urgente Visual', valorAnterior: oldC.notaUrgente || 'Sin nota', valorNuevo: newC.notaUrgente || 'Nota removida' });
  }
  return diffs;
}

export function diffVenta(oldV: Venta, newV: Venta): CambioCampo[] {
  const diffs: CambioCampo[] = [];
  if (oldV.estado !== newV.estado) {
    diffs.push({ campo: 'Estado de Validación Contrato', valorAnterior: oldV.estado, valorNuevo: newV.estado });
  }
  if (oldV.saldoActual !== newV.saldoActual) {
    diffs.push({ campo: 'Saldo Actual por Cobrar', valorAnterior: `$${oldV.saldoActual}`, valorNuevo: `$${newV.saldoActual}` });
  }
  if (oldV.pagoSemanal !== newV.pagoSemanal) {
    diffs.push({ campo: 'Pago Semanal Pactado', valorAnterior: `$${oldV.pagoSemanal}`, valorNuevo: `$${newV.pagoSemanal}` });
  }
  if (oldV.precioBase !== newV.precioBase) {
    diffs.push({ campo: 'Precio Base Producto', valorAnterior: `$${oldV.precioBase}`, valorNuevo: `$${newV.precioBase}` });
  }
  if (oldV.engancheMonto !== newV.engancheMonto) {
    diffs.push({ campo: 'Monto Enganche', valorAnterior: `$${oldV.engancheMonto}`, valorNuevo: `$${newV.engancheMonto}` });
  }
  if (oldV.comisionVendedora !== newV.comisionVendedora) {
    diffs.push({ campo: 'Comisión Vendedora', valorAnterior: `$${oldV.comisionVendedora}`, valorNuevo: `$${newV.comisionVendedora}` });
  }
  return diffs;
}

export interface Prospecto {
  id: number;
  folio?: string;
  nombreCliente: string;
  telefono?: string;
  direccion: string;
  colonia?: string;
  referencias?: string;
  latitud: number;
  longitud: number;
  fotoFachada?: string;
  fechaAgendada: string;
  notaAdicional?: string;
  vendedoraId?: number;
  vendedoraNombre?: string;
  estado: 'PENDIENTE' | 'AGENDADO' | 'CONVERTIDO' | 'RECHAZADO';
  fechaRegistro: string;
}

export interface PushNotificationRule {
  id: string;
  role: UserRole;
  roleName: string;
  titulo: string;
  mensajePlantilla: string;
  activa: boolean;
  prioridad: 'ALTA' | 'MEDIA' | 'BAJA';
  icono?: string;
}

export interface CalculoFinanciero {
  precioBase: number;
  enganche: number;
  aporteEmpresa: number;
  descuentoOtorgado: number;
  saldoFinal: number;
  semanasEstimadas: number;
  pagoSemanal: number;
  comisionVendedora: number;
}

// Haversine formula for route distance estimation
export function calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

// Financial Rules Helper Function - Bitalis Enganche Bonus Matrix
export function calcularReglasFinancieras(enganche: number, pagoSemanalCustom?: number, precioBaseInput?: number): CalculoFinanciero {
  const PRECIO_BASE = precioBaseInput || 1490;
  let aporteEmpresa = 0;
  let descuentoOtorgado = 0;
  let comisionVendedora = 0;

  if (enganche === 100) {
    // Client $100 -> Empresa +$100 -> Total Discount $200 (Bonificación Parcial Estándar)
    aporteEmpresa = 100;
    comisionVendedora = 20;
  } else if (enganche === 200) {
    // Client $200 -> Empresa +$200 -> Total Discount $400 (Doble Bono / Estímulo Completo)
    aporteEmpresa = 200;
    comisionVendedora = 40;
  } else if (enganche >= 300) {
    // Client $300 or more (e.g. $500) -> Empresa +$200 (Tope Máximo Empresa) -> Total Discount Enganche + $200
    aporteEmpresa = 200;
    comisionVendedora = 50;
  } else if (enganche > 0 && enganche < 100) {
    // Proportional match
    aporteEmpresa = enganche;
    comisionVendedora = 20;
  } else if (enganche > 100 && enganche < 200) {
    aporteEmpresa = 100;
    comisionVendedora = 30;
  } else if (enganche > 200 && enganche < 300) {
    aporteEmpresa = 200;
    comisionVendedora = 40;
  }

  const totalDescuentoAplicado = enganche + aporteEmpresa + descuentoOtorgado;
  const saldoFinal = Math.max(0, PRECIO_BASE - totalDescuentoAplicado);
  const pagoSemanal = pagoSemanalCustom || (enganche >= 200 ? 150 : 100);
  const semanasEstimadas = pagoSemanal > 0 ? Math.ceil(saldoFinal / pagoSemanal) : 0;

  return {
    precioBase: PRECIO_BASE,
    enganche,
    aporteEmpresa,
    descuentoOtorgado,
    saldoFinal,
    semanasEstimadas,
    pagoSemanal,
    comisionVendedora,
  };
}

export interface VisitaAbonoLog {
  id: number;
  clienteId: number;
  clienteNombre: string;
  clienteFolio?: string;
  colonia?: string;
  cobradorId: number;
  cobradorNombre: string;
  fechaHora: string;
  resultadoVisita:
    | 'ABONO_COBRADO'
    | 'PROMESA_PAGO'
    | 'NO_ENCONTRADO'
    | 'NO_PAGO_SE_NEGO'
    | 'CLIENTE_AUSENTE'
    | 'DIRECCION_INCORRECTA'
    | 'GESTION_APREMIO';
  montoCobrado?: number;
  fechaProximaVisita?: string;
  observaciones: string;
  latitudVisita?: number;
  longitudVisita?: number;
  diasMoraMomento?: number;
}
