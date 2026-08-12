'use client';
import ProductionModule from '@/components/ProductionModule';
export default function CashPage(){return <ProductionModule title="Caja" subtitle="Sesión de caja actual, apertura, conteo y control operativo por usuario." endpoint="/api/cash-sessions/current?userId={userId}" dataKeys={['data','session','movements']} emptyText="No hay una sesión de caja activa."/>;}
