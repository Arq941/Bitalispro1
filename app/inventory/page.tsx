'use client';
import ProductionModule from '@/components/ProductionModule';
export default function InventoryPage(){return <ProductionModule title="Inventario" subtitle="Existencias, disponibilidad y operación de almacenes conectadas a MySQL." endpoint="/api/inventory" dataKeys={['inventory','stocks','items']} emptyText="No hay existencias registradas."/>;}
