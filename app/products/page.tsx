'use client';
import ProductionModule from '@/components/ProductionModule';
export default function ProductsPage(){return <ProductionModule title="Productos" subtitle="Catálogo de productos, precios y disponibilidad para ventas." endpoint="/api/products" dataKeys={['products']} emptyText="No hay productos registrados."/>;}
