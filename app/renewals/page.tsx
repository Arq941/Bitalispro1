'use client';
import ProductionModule from '@/components/ProductionModule';
export default function RenewalsPage(){return <ProductionModule title="Renovaciones" subtitle="Seguimiento de renovaciones de clientes, estatus y oportunidades de recompra." endpoint="/api/renewals" dataKeys={['renewals','data']} emptyText="No hay renovaciones registradas."/>;}
