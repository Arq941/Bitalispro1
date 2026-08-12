'use client';
import ProductionModule from '@/components/ProductionModule';
export default function OrdersPage(){return <ProductionModule title="Pedidos" subtitle="Pedidos de producto, surtido y seguimiento de abastecimiento." endpoint="/api/product-orders" dataKeys={['orders','productOrders','data']} emptyText="No hay pedidos registrados."/>;}
