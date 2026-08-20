"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  ShoppingCart,
} from "lucide-react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/phase15/AppShell";
import { apiClient } from "@/lib/phase15/apiClient";

type Sale = {
  id: string;
  saleNumber: string;
  saleType: "CASH" | "CREDIT";
  status: string;
  totalAmount: number | string;
  totalFinanced?: number | string;
  createdAt: string;
  client?: {
    id: string;
    clientNumber?: string;
    firstName?: string;
    lastName?: string;
  };
  items?: Array<{
    quantity: number;
    product?: { name?: string; sku?: string };
  }>;
};
const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});
const n = (v: any) => Number(v || 0);
const statusLabel: Record<string, string> = {
  PENDING_AUTHORIZATION: "Por autorizar",
  APPROVED: "Aprobada",
  COMPLETED: "Completada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
};

export default function SalesPage() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const j: any = await apiClient("/api/sales");
      setSales(Array.isArray(j?.sales) ? j.sales : []);
    } catch (e: any) {
      setError(e?.message || "No pudimos cargar las ventas.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) =>
      `${s.saleNumber} ${s.status} ${s.saleType} ${s.client?.firstName || ""} ${s.client?.lastName || ""} ${s.client?.clientNumber || ""} ${(s.items || []).map((item) => `${item.product?.name || ""} ${item.product?.sku || ""}`).join(" ")}`
        .toLowerCase()
        .includes(q),
    );
  }, [sales, query]);
  const approved = sales.filter((s) =>
      ["APPROVED", "COMPLETED"].includes(s.status),
    ),
    pending = sales.filter((s) => s.status === "PENDING_AUTHORIZATION"),
    credit = sales.filter((s) => s.saleType === "CREDIT"),
    total = approved.reduce(
      (a, s) => a + n(s.totalFinanced ?? s.totalAmount),
      0,
    );
  return (
    <AppShell title="Ventas">
      <main className="mx-auto max-w-7xl px-3 py-3 sm:px-4 sm:py-5">
        <section className="rounded-[24px] bg-[#12224A] p-4 text-white sm:rounded-[28px] sm:p-7">
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#C79A3B]">
            Operación comercial
          </p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-black sm:text-2xl">Ventas</h1>
              <p className="mt-1 text-xs leading-5 text-slate-300 sm:mt-2 sm:text-sm">
                Consulta ventas de contado, crédito y autorizaciones pendientes.
              </p>
            </div>
            <button
              onClick={() => router.push("/sales/new")}
              className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#FF6A00] px-3 text-[10px] font-black text-white sm:min-h-12 sm:rounded-2xl sm:px-4 sm:text-xs"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden min-[390px]:inline">Nueva venta</span>
            </button>
          </div>
        </section>
        {error && (
          <div
            role="alert"
            className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 sm:mt-4 sm:p-4"
          >
            {error}
          </div>
        )}
        <section className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3 lg:grid-cols-4">
          <K icon={<ShoppingCart />} label="Ventas" value={sales.length} />
          <K
            icon={<CircleDollarSign />}
            label="Monto aprobado"
            value={money.format(total)}
          />
          <K icon={<Clock3 />} label="Crédito" value={credit.length} />
          <K
            icon={<ShieldAlert />}
            label="Por autorizar"
            value={pending.length}
            warning={pending.length > 0}
          />
        </section>
        <div className="relative mt-3 sm:mt-4">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente, producto, SKU o venta"
            className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#FF6A00] sm:min-h-12"
          />
        </div>
        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#12224A]" />
          </div>
        ) : (
          <section className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
            {filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/sales/${s.id}`)}
                className="block w-full rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#FF6A00] sm:rounded-3xl sm:p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#12224A] sm:h-12 sm:w-12 sm:rounded-2xl">
                    <BadgeDollarSign className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <h2 className="text-sm font-black text-[#12224A] sm:text-base">
                        {s.saleNumber}
                      </h2>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-600">
                        {s.saleType === "CREDIT" ? "CRÉDITO" : "CONTADO"}
                      </span>
                      <Status value={s.status} />
                    </div>
                    <p className="mt-1 truncate text-xs font-bold text-slate-600">
                      {s.client
                        ? `${s.client.firstName || ""} ${s.client.lastName || ""}`
                        : "Cliente registrado"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(s.items || []).slice(0, 3).map((item, index) => (
                        <span
                          key={`${item.product?.sku || index}-${index}`}
                          className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-800"
                        >
                          {item.quantity}× {item.product?.name || "Producto"}
                        </span>
                      ))}
                      {(s.items || []).length > 3 && (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500">
                          +{(s.items || []).length - 3} más
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-3 sm:mt-3">
                      <div>
                        <p className="text-[9px] font-black uppercase text-slate-400">
                          Importe
                        </p>
                        <p className="text-base font-black text-[#12224A] sm:text-lg">
                          {money.format(n(s.totalFinanced ?? s.totalAmount))}
                        </p>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {new Date(s.createdAt).toLocaleDateString("es-MX")}
                      </p>
                    </div>
                    <p className="mt-1 text-right text-[8px] font-bold text-slate-300">
                      Ref. {s.id.slice(-6).toUpperCase()}
                      {s.client?.clientNumber
                        ? ` · Cliente ${s.client.clientNumber}`
                        : ""}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                </div>
              </button>
            ))}
            {!filtered.length && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 sm:rounded-3xl">
                No hay ventas que coincidan con la búsqueda.
              </div>
            )}
          </section>
        )}
      </main>
    </AppShell>
  );
}

function K({
  icon,
  label,
  value,
  warning = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: any;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 sm:rounded-3xl sm:p-4 ${warning ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}
    >
      <div className={warning ? "text-amber-600" : "text-[#C79A3B]"}>
        {icon}
      </div>
      <p className="mt-2 text-[9px] font-black uppercase text-slate-400 sm:mt-3 sm:text-[10px]">
        {label}
      </p>
      <p
        className={`mt-1 break-words text-base font-black sm:text-xl ${warning ? "text-amber-800" : "text-[#12224A]"}`}
      >
        {value}
      </p>
    </div>
  );
}
function Status({ value }: { value: string }) {
  const pending = value === "PENDING_AUTHORIZATION",
    ok = ["APPROVED", "COMPLETED"].includes(value),
    bad = ["REJECTED", "CANCELLED"].includes(value);
  return (
    <span
      className={`rounded-full px-2 py-1 text-[9px] font-black ${pending ? "bg-amber-50 text-amber-700" : ok ? "bg-emerald-50 text-emerald-700" : bad ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}
    >
      {statusLabel[value] || value.replaceAll("_", " ")}
    </span>
  );
}
