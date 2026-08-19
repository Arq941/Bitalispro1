'use client';

import {useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {BarChart3,Bell,Boxes,ChevronRight,ClipboardCheck,Coins,FileClock,KeyRound,Menu,ReceiptText,Route,Search,Settings,ShieldCheck,ShoppingCart,UserPlus,Users,WalletCards} from 'lucide-react';
import AppShell,{useShellPermissions,useShellSessionUser} from '@/components/phase15/AppShell';
import {haptic} from '@/lib/ux/haptics';

type Group='Operación'|'Comercial'|'Inventario'|'Administración';
type Item={label:string;description:string;href:string;icon:any;permission:string;group:Group};
const items:Item[]=[
 {label:'Alta rápida',description:'Captura cliente, GPS y fotos',href:'/clients/new',icon:UserPlus,permission:'clients.create',group:'Comercial'},
 {label:'Clientes',description:'Expedientes y CRM 360',href:'/clients',icon:Users,permission:'clients.view',group:'Comercial'},
 {label:'Ventas',description:'Consulta y seguimiento',href:'/sales',icon:ShoppingCart,permission:'sales.view',group:'Comercial'},
 {label:'Nueva venta',description:'Contado o crédito',href:'/sales/new',icon:ShoppingCart,permission:'sales.create',group:'Comercial'},
 {label:'Autorizaciones',description:'Excepciones pendientes',href:'/authorizations',icon:ShieldCheck,permission:'sales.approve',group:'Comercial'},
 {label:'Renovaciones',description:'Oportunidades de recompra',href:'/renewals',icon:ClipboardCheck,permission:'renewals.view',group:'Comercial'},
 {label:'Cartera',description:'Saldos y riesgo',href:'/portfolio',icon:WalletCards,permission:'collections.view',group:'Operación'},
 {label:'Cobranza',description:'Registro de cobros',href:'/collections',icon:WalletCards,permission:'collections.view',group:'Operación'},
 {label:'Ruta',description:'Planeación y navegación',href:'/route',icon:Route,permission:'route.view',group:'Operación'},
 {label:'Caja',description:'Efectivo y arqueo',href:'/cash',icon:ReceiptText,permission:'cash.view',group:'Operación'},
 {label:'Alertas operativas',description:'Pendientes prioritarios',href:'/notifications',icon:Bell,permission:'dashboard.view',group:'Operación'},
 {label:'Inventario',description:'Existencias disponibles',href:'/inventory',icon:Boxes,permission:'inventory.view',group:'Inventario'},
 {label:'Operaciones',description:'Mermas y devoluciones',href:'/inventory/operations',icon:Boxes,permission:'inventory.manage',group:'Inventario'},
 {label:'Conteos y transferencias',description:'Control entre almacenes',href:'/inventory/counts',icon:Boxes,permission:'inventory.manage',group:'Inventario'},
 {label:'Proveedores y almacenes',description:'Catálogos operativos',href:'/inventory/catalogs',icon:Boxes,permission:'inventory.manage',group:'Inventario'},
 {label:'Órdenes de compra',description:'Compra y recepción',href:'/orders',icon:ShoppingCart,permission:'inventory.manage',group:'Inventario'},
 {label:'Productos',description:'Catálogo y precios',href:'/products',icon:Boxes,permission:'inventory.view',group:'Inventario'},
 {label:'Comisiones',description:'Cálculo y periodos',href:'/commissions',icon:Coins,permission:'commissions.view',group:'Administración'},
 {label:'Centro de control',description:'Operación en tiempo real',href:'/control-center',icon:BarChart3,permission:'reports.view',group:'Administración'},
 {label:'Reportes',description:'Análisis y exportación',href:'/reports',icon:BarChart3,permission:'reports.view',group:'Administración'},
 {label:'Auditoría',description:'Historial de cambios',href:'/audit',icon:FileClock,permission:'audit.view',group:'Administración'},
 {label:'Usuarios',description:'Roles y permisos',href:'/settings/users',icon:Users,permission:'users.manage',group:'Administración'},
 {label:'Enlaces de contraseña',description:'Acceso inicial seguro',href:'/settings/password-links',icon:KeyRound,permission:'users.manage',group:'Administración'},
 {label:'Configuración',description:'Reglas del sistema',href:'/settings',icon:Settings,permission:'settings.manage',group:'Administración'},
];
const order:Group[]=['Operación','Comercial','Inventario','Administración'];

export default function AdminMenu(){
 const router=useRouter(),permissions=useShellPermissions(),user=useShellSessionUser();
 const[query,setQuery]=useState('');
 const visible=useMemo(()=>{const q=query.trim().toLowerCase();return items.filter(item=>permissions?.has(item.permission)&&(!q||`${item.label} ${item.description} ${item.group}`.toLowerCase().includes(q)));},[permissions,query]);
 const open=(href:string)=>{haptic('tap');router.push(href);};
 if(user&&user.role!=='ADMIN')return <AppShell title="Menú"><div className="bitalis-page"><div className="bitalis-error-state"><ShieldCheck className="h-8 w-8"/><b className="mt-3">Solo administración</b><p className="mt-1 text-xs">Este menú no está habilitado para tu rol.</p></div></div></AppShell>;
 return <AppShell title="Menú administrador"><main className="bitalis-page">
  <header className="bitalis-page-heading"><div><p className="bitalis-page-eyebrow">Administración</p><h1 className="bitalis-page-title">Todas las funciones</h1><p className="bitalis-page-description">Encuentra rápidamente cualquier módulo habilitado para tu usuario.</p></div><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--bitalis-primary)] text-white"><Menu className="h-6 w-6"/></div></header>
  <label className="relative mt-4 block"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar función" aria-label="Buscar función administrativa" className="min-h-12 w-full rounded-2xl border border-[var(--bitalis-border)] bg-white pl-12 pr-4 text-base font-semibold text-[var(--bitalis-primary)] shadow-sm outline-none"/></label>
  {order.map(group=>{const groupItems=visible.filter(item=>item.group===group);if(!groupItems.length)return null;return <section key={group}><div className="bitalis-section-heading"><h2 className="bitalis-section-title">{group}</h2><span className="bitalis-status bitalis-status-neutral">{groupItems.length}</span></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{groupItems.map(({label,description,href,icon:Icon})=><button key={href} onClick={()=>open(href)} className="bitalis-card bitalis-card-interactive flex min-h-[88px] items-center gap-3 p-3.5 text-left"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--bitalis-surface-soft)] text-[var(--bitalis-action-dark)]"><Icon className="h-5 w-5"/></div><div className="min-w-0 flex-1"><b className="block truncate text-sm text-[var(--bitalis-primary)]">{label}</b><span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-slate-500">{description}</span></div><ChevronRight className="h-4 w-4 shrink-0 text-slate-300"/></button>)}</div></section>})}
  {!visible.length&&<div className="bitalis-empty-state mt-5"><Search className="h-7 w-7"/><b className="mt-3 text-[var(--bitalis-primary)]">Sin coincidencias</b><p className="mt-1 text-xs">Prueba con otro nombre de módulo.</p></div>}
 </main></AppShell>;
}
