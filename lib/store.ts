import {
  Usuario,
  Zona,
  Cliente,
  Venta,
  Abono,
  CorteCaja,
  Producto,
  UserRole,
  DiaSemana,
  LogAuditoria
} from '@/types';

// Products catalog seed data with initial stock
export const INITIAL_PRODUCTOS: Producto[] = [
  {
    id: 1,
    nombre: 'Colchón Matrimonial Ortopédico Premium',
    precioBase: 4500,
    engancheMinimo: 300,
    descuentoEmpresa: 100,
    pagoSemanalSugerido: 200,
    descripcion: 'Colchón ergonómico alta densidad con resortes embolsados.',
    categoria: 'Hogar',
    fotoUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=500',
    activo: true,
    stock: 25,
    stockMinimo: 5,
    fechaCompra: '2026-05-10',
    proveedor: 'Colchones Muebleros S.A.',
  },
  {
    id: 2,
    nombre: 'Juego de Sartenes Antiadherentes (12 piezas)',
    precioBase: 1800,
    engancheMinimo: 150,
    descuentoEmpresa: 50,
    pagoSemanalSugerido: 100,
    descripcion: 'Batería de cocina de granito antiadherente de grado quirúrgico.',
    categoria: 'Cocina',
    fotoUrl: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=500',
    activo: true,
    stock: 3,
    stockMinimo: 8,
    fechaCompra: '2026-06-01',
    proveedor: 'Enseres del Norte',
  },
  {
    id: 3,
    nombre: 'Licuadora Industrial 1500W BITALIS Pro',
    precioBase: 2200,
    engancheMinimo: 200,
    descuentoEmpresa: 80,
    pagoSemanalSugerido: 120,
    descripcion: 'Licuadora de alta potencia con vaso de tritan libre de BPA.',
    categoria: 'Electrodomésticos',
    fotoUrl: 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=500',
    activo: true,
    stock: 2,
    stockMinimo: 5,
    fechaCompra: '2026-06-15',
    proveedor: 'ElectroHogar Direct',
  },
];

// Base System Users (Default Admin for initial configuration)
export const INITIAL_USUARIOS: Usuario[] = [
  { id: 1, nombre: 'Administrador BITALIS', usuario: 'admin', email: 'admin@bitalis.com', password: 'admin', pin: '1234', rol: 'admin', telefono: '', activo: true },
];

export const INITIAL_ZONAS: Zona[] = [];

export const INITIAL_CLIENTES: Cliente[] = [];

export const INITIAL_VENTAS: Venta[] = [];

export const INITIAL_ABONOS: Abono[] = [];

export const INITIAL_CORTES: CorteCaja[] = [];

export const INITIAL_AUDIT_LOGS: LogAuditoria[] = [];

/**
 * Helper: Calculates the exact payment plan and schedule
 * - Total a financiar: max(0, precioBase - engancheMonto - aporteEmpresa)
 * - Pago Semanal: si no se especifica o es 0, se calcula como totalAFinanciar
 * - Total semanas requeridas: Math.ceil(saldoInicial / pagoSemanal)
 */
export function calcularPlanDePagos(precioBase: number, engancheMonto: number, aporteEmpresa: number = 0, pagoSemanalPropuesto: number = 0) {
  const saldoInicial = Math.max(0, precioBase - engancheMonto - aporteEmpresa);
  const pagoSemanal = pagoSemanalPropuesto > 0 ? pagoSemanalPropuesto : (saldoInicial > 0 ? Math.min(saldoInicial, 150) : 0);
  const totalSemanas = pagoSemanal > 0 ? Math.ceil(saldoInicial / pagoSemanal) : 0;
  return {
    saldoInicial,
    pagoSemanal,
    totalSemanas
  };
}


