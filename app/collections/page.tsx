'use client';
import ProductionModule from '@/components/ProductionModule';
export default function CollectionsPage(){return <ProductionModule title="Cobranza" subtitle="Cartera operativa de ventas y créditos para seguimiento de cobro en campo." endpoint="/api/sales" dataKeys={['sales']} emptyText="No hay cartera registrada."/>;}
