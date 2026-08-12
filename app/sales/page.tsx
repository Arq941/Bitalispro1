'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BadgeDollarSign,
  CheckCircle2,
  CreditCard,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  UserRound,
  X,
} from 'lucide-react';
import BitalisLogo from '@/components/BitalisLogo';

type ClientRecord = {
  id: string;
  clientNumber: string;
  firstName: string;
  lastName: string;
  secondLastName?: string | null;
  phone: string;
};

type ProductPrice = {
  priceType: string;
  price?: string | number;
  amount?: string | number;
  isActive?: boolean;
};

type ProductRecord = {
  id: string;
  sku: string;
  name: string;
  brand?: string | null;
  status: string;
  prices?: ProductPrice[];
};

type SaleRecord = {
  id: string;
  saleNumber: string;
  saleType: 'CASH' | 'CREDIT';
  status: string;
  totalAmount: string | number;
  totalFinanced?: string | number;
  createdAt: string;
  client?: ClientRecord;
  items?: Array<{ product?: ProductRecord; quantity: number }>;
};

const money = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

function numberValue(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function productPrice(product: ProductRecord) {
  const active = (product.prices || []).filter((p) => p.isActive !== false);
  const priority = ['LIST', 'LIST_PRICE', 'CREDIT', 'CASH'];
  for (const type of priority) {
    const found = active.find((p) => p.priceType === type);
    if (found) return numberValue(found.amount ?? found.price);
  }
  const first = active[0];
  return first ? numberValue(first.amount ?? first.price) : 0;
}

function minimumPrice(product: ProductRecord) {
  const found = (product.prices || []).find((p) => p.priceType === 'MINIMUM_AUTHORIZED' && p.isActive !== false);
  return found ? numberValue(found.amount ?? found.price) : productPrice(product);
}

export default function ProductionSalesPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [clientId, setClientId] = useState('');
  const [productId, setProductId] = useState('');
  const [saleType, setSaleType] = useState<'CASH' | 'CREDIT'>('CREDIT');
  const [negotiatedPrice, setNegotiatedPrice] = useState('');
  const [downPayment, setDownPayment] = useState('');

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('bitalis_access_token');
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadData = useCallback(async () => {
    const headers = authHeaders();
    if (!headers) {
      router.replace('/');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [clientsRes, productsRes, salesRes] = await Promise.all([
        fetch('/api/clients?page=1&limit=100', { headers, cache: 'no-store' }),
        fetch('/api/products', { headers, cache: 'no-store' }),
        fetch('/api/sales', { headers, cache: 'no-store' }),
      ]);

      if (clientsRes.status === 401 || salesRes.status === 401) {
        localStorage.removeItem('bitalis_access_token');
        localStorage.removeItem('bitalis_refresh_token');
        localStorage.removeItem('bitalis_auth_user');
        router.replace('/');
        return;
      }

      const clientsJson = await clientsRes.json().catch(() => ({}));
      const productsJson = await productsRes.json().catch(() => ({}));
      const salesJson = await salesRes.json().catch(() => ({}));

      if (!clientsRes.ok) throw new Error(clientsJson?.error || 'No fue posible cargar clientes.');
      if (!productsRes.ok) throw new Error(productsJson?.error || 'No fue posible cargar productos.');
      if (!salesRes.ok) throw new Error(salesJson?.error || 'No fue posible cargar ventas.');

      setClients(Array.isArray(clientsJson?.data) ? clientsJson.data : []);
      setProducts(Array.isArray(productsJson?.products) ? productsJson.products : []);
      setSales(Array.isArray(salesJson?.sales) ? salesJson.sales : []);
    } catch (err: any) {
      setError(err?.message || 'No fue posible cargar ventas.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedProduct = useMemo(() => products.find((p) => p.id === productId) || null, [products, productId]);
  const selectedListPrice = selectedProduct ? productPrice(selectedProduct) : 0;
  const selectedMinimum = selectedProduct ? minimumPrice(selectedProduct) : 0;
  const effectivePrice = numberValue(negotiatedPrice || selectedListPrice);
  const effectiveDownPayment = saleType === 'CREDIT' ? numberValue(downPayment) : 0;
  const estimatedFinanced = Math.max(0, effectivePrice - effectiveDownPayment * 2);

  useEffect(() => {
    if (selectedProduct) setNegotiatedPrice(String(selectedListPrice || ''));
  }, [selectedProduct, selectedListPrice]);

  const resetForm = () => {
    setClientId('');
    setProductId('');
    setSaleType('CREDIT');
    setNegotiatedPrice('');
    setDownPayment('');
    setError('');
  };

  const submitSale = async (event: FormEvent) => {
    event.preventDefault();
    const headers = authHeaders();
    if (!headers) {
      router.replace('/');
      return;
    }
    if (!clientId || !selectedProduct) {
      setError('Selecciona cliente y producto.');
      return;
    }
    if (effectivePrice <= 0) {
      setError('El precio de venta debe ser mayor a cero.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          saleType,
          items: [
            {
              productId: selectedProduct.id,
              quantity: 1,
              unitPrice: selectedListPrice || effectivePrice,
              negotiatedPrice: effectivePrice,
              minimumAuthorizedPrice: selectedMinimum || effectivePrice,
            },
          ],
          engancheCliente: saleType === 'CREDIT' ? effectiveDownPayment : 0,
          aporteEmpresaRatio: 1,
          idempotencyKey: `ux-sale-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || json?.message || 'No fue posible registrar la venta.');

      setSuccess(`Venta ${json?.saleNumber || json?.id || ''} registrada correctamente.`);
      setShowForm(false);
      resetForm();
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'No fue posible registrar la venta.');
    } finally {
      setSaving(false);
    }
  };

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((sale) => {
      const client = sale.client;
      const clientName = client ? `${client.firstName || ''} ${client.lastName || ''}` : '';
      return `${sale.saleNumber} ${sale.status} ${sale.saleType} ${clientName}`.toLowerCase().includes(q);
    });
  }, [sales, search]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300" aria-label="Volver al panel">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <BitalisLogo size="md" variant="dark" />
            <div className="hidden sm:block">
              <p className="text-xs font-black text-white">Ventas</p>
              <p className="text-[10px] text-slate-500">Operación MySQL</p>
            </div>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-emerald-500/15">
            <Plus className="h-4 w-4" /> Nueva venta
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <section className="rounded-[28px] border border-emerald-400/10 bg-gradient-to-br from-slate-900 to-emerald-950/20 p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 text-[11px] font-bold text-emerald-300">
                <ShoppingCart className="h-3.5 w-3.5" /> Venta en producción
              </div>
              <h1 className="text-2xl font-black text-white">Ventas BITALIS</h1>
              <p className="mt-2 text-sm text-slate-400">Registra contado o crédito, enganche y precio negociado directamente en MySQL.</p>
            </div>
            <button onClick={loadData} disabled={loading} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </button>
          </div>
        </section>

        {success && <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200"><CheckCircle2 className="h-5 w-5" />{success}</div>}
        {error && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

        <div className="mt-5 relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar folio, cliente o estado..." className="w-full rounded-2xl border border-slate-800 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-emerald-500/40" />
        </div>

        <section className="mt-4 overflow-hidden rounded-[24px] border border-white/5 bg-slate-900/70">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Cargando ventas...</div>
          ) : filteredSales.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">No hay ventas registradas todavía.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredSales.map((sale) => (
                <article key={sale.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/5 text-emerald-400"><BadgeDollarSign className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-white">{sale.saleNumber}</p>
                      <span className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[9px] font-black text-slate-400">{sale.saleType}</span>
                      <span className={`rounded-lg border px-2 py-1 text-[9px] font-black ${sale.status === 'APPROVED' || sale.status === 'COMPLETED' ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300' : 'border-amber-400/20 bg-amber-500/10 text-amber-300'}`}>{sale.status}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">{sale.client ? `${sale.client.firstName} ${sale.client.lastName} · ${sale.client.clientNumber}` : 'Cliente registrado'}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-lg font-black text-white">{money.format(numberValue(sale.totalFinanced ?? sale.totalAmount))}</p>
                    <p className="text-[10px] text-slate-600">{new Date(sale.createdAt).toLocaleDateString('es-MX')}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 p-4 backdrop-blur-md">
          <div className="mx-auto my-4 max-w-2xl overflow-hidden rounded-[28px] border border-white/10 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <div>
                <p className="text-lg font-black text-white">Nueva venta</p>
                <p className="mt-1 text-xs text-slate-500">Máximo 2 productos por política; esta UX inicia con 1 producto por venta.</p>
              </div>
              <button onClick={() => setShowForm(false)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-400"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={submitSale} className="space-y-5 p-5">
              <div>
                <label className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-300"><UserRound className="h-4 w-4 text-emerald-400" /> Cliente</label>
                <select required value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50">
                  <option value="">Selecciona cliente</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.clientNumber} · {client.firstName} {client.lastName}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-300"><Package className="h-4 w-4 text-emerald-400" /> Producto</label>
                <select required value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50">
                  <option value="">Selecciona producto</option>
                  {products.filter((p) => p.status === 'ACTIVE').map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name} · {money.format(productPrice(product))}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setSaleType('CREDIT')} className={`rounded-2xl border p-4 text-left ${saleType === 'CREDIT' ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-slate-800 bg-slate-950'}`}><CreditCard className="mb-2 h-5 w-5 text-emerald-400" /><p className="text-sm font-black text-white">Crédito</p><p className="mt-1 text-[10px] text-slate-500">Enganche + saldo financiado</p></button>
                <button type="button" onClick={() => setSaleType('CASH')} className={`rounded-2xl border p-4 text-left ${saleType === 'CASH' ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-slate-800 bg-slate-950'}`}><BadgeDollarSign className="mb-2 h-5 w-5 text-emerald-400" /><p className="text-sm font-black text-white">Contado</p><p className="mt-1 text-[10px] text-slate-500">Pago directo</p></button>
              </div>

              <div className={`grid gap-3 ${saleType === 'CREDIT' ? 'sm:grid-cols-2' : ''}`}>
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-300">Precio negociado</label>
                  <input type="number" min="1" step="0.01" required value={negotiatedPrice} onChange={(e) => setNegotiatedPrice(e.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50" />
                  {selectedProduct && <p className="mt-1 text-[10px] text-slate-600">Lista {money.format(selectedListPrice)} · mínimo autorizado {money.format(selectedMinimum)}</p>}
                </div>
                {saleType === 'CREDIT' && (
                  <div>
                    <label className="mb-2 block text-xs font-bold text-slate-300">Enganche cliente</label>
                    <input type="number" min="0" step="0.01" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50" />
                    <p className="mt-1 text-[10px] text-slate-600">Aporte empresa 1:1 aplicado automáticamente.</p>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/5 p-4">
                <div className="flex items-center justify-between text-xs"><span className="text-slate-400">Precio venta</span><span className="font-black text-white">{money.format(effectivePrice)}</span></div>
                {saleType === 'CREDIT' && <><div className="mt-2 flex items-center justify-between text-xs"><span className="text-slate-400">Enganche cliente</span><span className="font-bold text-emerald-300">− {money.format(effectiveDownPayment)}</span></div><div className="mt-2 flex items-center justify-between text-xs"><span className="text-slate-400">Aporte empresa</span><span className="font-bold text-emerald-300">− {money.format(effectiveDownPayment)}</span></div></>}
                <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3"><span className="text-sm font-bold text-slate-300">Saldo estimado</span><span className="text-xl font-black text-white">{money.format(saleType === 'CREDIT' ? estimatedFinanced : effectivePrice)}</span></div>
              </div>

              <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3.5 text-sm font-black text-slate-950 disabled:opacity-60">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Guardando venta...</> : <><ShoppingCart className="h-4 w-4" />Registrar venta</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
