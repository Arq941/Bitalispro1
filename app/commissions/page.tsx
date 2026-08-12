'use client';
import ProductionModule from '@/components/ProductionModule';
export default function CommissionsPage(){return <ProductionModule title="Comisiones" subtitle="Panel de comisiones por ventas y cobranza para administración y operación." endpoint="/api/commissions/dashboard" dataKeys={['dashboard','commissions','items']} emptyText="No hay datos de comisiones para mostrar."/>;}
