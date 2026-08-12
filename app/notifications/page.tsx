'use client';
import ProductionModule from '@/components/ProductionModule';
export default function NotificationsPage(){return <ProductionModule title="Notificaciones" subtitle="Centro de avisos operativos, alertas y seguimiento del sistema." endpoint="/api/notifications" dataKeys={['notifications','data']} emptyText="No hay notificaciones pendientes."/>;}
