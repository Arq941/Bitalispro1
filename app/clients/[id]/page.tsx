"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  Clock3,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  ReceiptText,
  ShieldAlert,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import AppShell, { useShellPermissions } from "@/components/phase15/AppShell";
import ClientLocationSheet, {
  ClientLocationValue,
} from "@/components/client/ClientLocationSheet";
import EvidenceImage from "@/components/client/EvidenceImage";
import { apiClient } from "@/lib/phase15/apiClient";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});
const tabs = ["Resumen", "Financiero", "Historial", "Evidencias", "Notas"];

export default function Client360Page() {
  const params = useParams<{ id: string }>(),
    router = useRouter(),
    permissions = useShellPermissions();
  const [data, setData] = useState<any>(null),
    [tab, setTab] = useState("Resumen"),
    [role, setRole] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [locationOpen, setLocationOpen] = useState(false);
  const canEdit = permissions?.has("clients.edit") === true;
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const j: any = await apiClient(`/api/clients/${params.id}/360`);
      setData(j?.client360 || j?.data || j);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    try {
      const raw = localStorage.getItem("bitalis_auth_user");
      setRole(String(raw ? JSON.parse(raw)?.role : "").toUpperCase());
    } catch {}
    void load();
  }, [params.id]);
  const c = data?.client || data?.profile || data || {};
  const primaryAddress = (c.addresses || data?.addresses || [])[0] || {};
  const credits = data?.credits || c?.credits || [],
    payments = credits.flatMap((credit: any) =>
      (credit.payments || []).map((payment: any) => ({
        ...payment,
        _credit: credit,
      })),
    ),
    purchases = data?.sales || data?.purchases || [],
    visits = data?.collectionVisits || data?.visits || [],
    timeline = data?.timeline || [],
    media = data?.media || c?.media || [];
  const totalBalance = useMemo(
    () =>
      credits.reduce(
        (s: number, x: any) => s + Number(x.saldoActual ?? x.balance ?? 0),
        0,
      ),
    [credits],
  );
  const totalPaid = useMemo(
    () => payments.reduce((s: number, x: any) => s + Number(x.amount ?? 0), 0),
    [payments],
  );
  const overdue = useMemo(
    () =>
      credits.reduce(
        (s: number, x: any) => s + Number(x.overdueAmount ?? x.vencido ?? 0),
        0,
      ),
    [credits],
  );
  const nextPayment = credits
    .map((x: any) => ({
      amount: Number(
        x.installmentAmount ?? x.weeklyPayment ?? x.nextPaymentAmount ?? 0,
      ),
      date: x.nextPaymentDate || x.nextDueDate,
    }))
    .filter((x: any) => x.date)
    .sort((a: any, b: any) => +new Date(a.date) - +new Date(b.date))[0];
  const lastPayment = [...payments].sort(
    (a: any, b: any) =>
      +new Date(b.clientCapturedAt || b.createdAt) -
      +new Date(a.clientCapturedAt || a.createdAt),
  )[0];
  const risk = String(c.riskLevel || "LOW").toUpperCase();
  const riskLabel =
    risk === "CRITICAL"
      ? "CRÍTICA"
      : risk === "HIGH"
        ? "ALTA"
        : risk === "MEDIUM"
          ? "MEDIA"
          : "BAJA";
  const riskTone =
    risk === "CRITICAL" || risk === "HIGH"
      ? "border-red-300 bg-red-50 text-red-700"
      : risk === "MEDIUM"
        ? "border-amber-300 bg-amber-50 text-amber-700"
        : "border-emerald-300 bg-emerald-50 text-emerald-700";
  const byType = (t: string) => media.find((m: any) => m.mediaType === t),
    pending =
      c.customerType === "PENDING_SUPERVISOR" || c.lastName === "PENDIENTE",
    hasGps = c.latitude != null && c.longitude != null;
  const facade = byType("FACADE_PHOTO");
  const name =
    [
      c.firstName,
      c.lastName === "PENDIENTE" ? "" : c.lastName,
      c.secondLastName,
    ]
      .filter(Boolean)
      .join(" ") || "Cliente";
  const phone = String(c.phone || "").replace(/\D/g, "");
  const openWhatsApp = () =>
    phone && (location.href = `https://wa.me/52${phone.replace(/^52/, "")}`);
  const navigate = () =>
    hasGps &&
    (location.href = `https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`);
  const updateLocation = (value: ClientLocationValue) =>
    setData((prev: any) =>
      prev?.client
        ? { ...prev, client: { ...prev.client, ...value } }
        : { ...prev, ...value },
    );
  const evidence = (
    <div className="grid grid-cols-3 gap-2">
      {[
        ["FACADE_PHOTO", "Fachada"],
        ["CLIENT_PHOTO", "Cliente"],
        ["CONTRACT_PHOTO", "Contrato"],
      ].map(([type, label]) => (
        <button
          key={type}
          onClick={() => setTab("Evidencias")}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left active:scale-[.98]"
        >
          <div className="aspect-[4/3] overflow-hidden bg-slate-100">
            <EvidenceImage
              storageKey={byType(type)?.storageKey}
              alt={`Fotografía de ${label.toLowerCase()}`}
            />
          </div>
          <div className="p-2">
            <p className="truncate text-[10px] font-black text-[var(--bitalis-primary)]">
              {label}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
  return (
    <AppShell title="Cliente 360">
      <main className="mx-auto max-w-3xl px-3 pb-28 pt-3 sm:px-4">
        {loading ? (
          <div className="flex justify-center p-16">
            <Loader2 className="h-7 w-7 animate-spin text-[var(--bitalis-primary)]" />
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={() => router.push("/clients")}
                className="flex min-h-12 items-center gap-2 rounded-2xl px-3 text-sm font-black text-[var(--bitalis-primary)] active:bg-slate-100"
              >
                <ArrowLeft className="h-5 w-5" />
                Clientes
              </button>
              <span className="text-[9px] font-bold text-slate-300">
                Ref. {c.clientNumber || String(c.id || "CLIENTE").slice(-6)}
              </span>
            </div>
            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <button
                onClick={() => setTab("Evidencias")}
                className="relative block w-full bg-slate-100 text-left"
              >
                <div className="h-52 w-full overflow-hidden sm:h-72">
                  <EvidenceImage
                    storageKey={facade?.storageKey}
                    alt="Fachada del cliente"
                  />
                </div>
                <span className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-slate-950/70 px-3 py-2 text-xs font-black text-white backdrop-blur">
                  <Camera className="h-4 w-4" />
                  Fachada · Ver evidencias
                </span>
                <span className="absolute right-3 top-3 rounded-full bg-slate-950/70 px-3 py-1.5 text-[10px] font-black text-white">
                  {media.length} FOTOS
                </span>
              </button>
              <div className="p-3">{evidence}</div>
            </section>
            <section className="mt-3 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50">
                  <UserRound className="h-6 w-6 text-[var(--bitalis-action)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-black text-[var(--bitalis-primary)]">
                      {name}
                    </h1>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                      {c.status || "ACTIVO"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {c.phone || "Sin teléfono"}
                  </p>
                  <p className="mt-1 flex items-start gap-1 text-xs text-slate-500">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {[
                      primaryAddress.street,
                      primaryAddress.exteriorNumber &&
                        `Lote ${primaryAddress.exteriorNumber}`,
                      primaryAddress.neighborhood,
                    ]
                      .filter(Boolean)
                      .join(", ") ||
                      c.address ||
                      c.profile?.address ||
                      c.street ||
                      "Domicilio registrado"}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                <Quick
                  icon={Phone}
                  label="Llamar"
                  disabled={!phone}
                  onClick={() => phone && (location.href = `tel:${phone}`)}
                />
                <Quick
                  icon={MessageCircle}
                  label="WhatsApp"
                  disabled={!phone}
                  onClick={openWhatsApp}
                />
                <Quick
                  icon={Navigation}
                  label="Navegar"
                  disabled={!hasGps}
                  onClick={navigate}
                />
                <Quick
                  icon={Camera}
                  label="Fotos"
                  onClick={() => setTab("Evidencias")}
                />
              </div>
            </section>
            <button
              onClick={() => setTab("Financiero")}
              className={`mt-3 flex min-h-16 w-full items-center gap-3 rounded-[22px] border-2 px-4 text-left active:scale-[.99] ${riskTone}`}
            >
              <ShieldAlert className="h-6 w-6 shrink-0" />
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-[.12em]">
                  Morosidad
                </p>
                <p className="text-base font-black">
                  {riskLabel}
                  {overdue > 0 ? ` · ${money.format(overdue)} vencido` : ""}
                </p>
              </div>
              <span className="rounded-full bg-current/10 px-3 py-1 text-[10px] font-black">
                RIESGO {riskLabel}
              </span>
              <ChevronRight className="h-5 w-5" />
            </button>
            <section className="mt-3 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black text-[var(--bitalis-primary)]">
                  Resumen financiero
                </h2>
                <button
                  onClick={() => setTab("Financiero")}
                  className="min-h-10 px-2 text-xs font-black text-[var(--bitalis-action)]"
                >
                  Ver más
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Finance
                  label="Saldo actual"
                  value={money.format(totalBalance)}
                  alert={totalBalance > 0}
                />
                <Finance
                  label="Vencido"
                  value={money.format(overdue)}
                  alert={overdue > 0}
                />
                <Finance
                  label="Próximo pago"
                  value={
                    nextPayment ? money.format(nextPayment.amount) : "Sin fecha"
                  }
                  sub={
                    nextPayment?.date
                      ? new Date(nextPayment.date).toLocaleDateString("es-MX")
                      : undefined
                  }
                />
                <Finance label="Total pagado" value={money.format(totalPaid)} />
                <Finance
                  label="Día de cobro"
                  value={c.profile?.preferredCollectionDay || "Sin definir"}
                />
                <Finance
                  label="Último pago"
                  value={
                    lastPayment
                      ? money.format(Number(lastPayment.amount || 0))
                      : "Sin pagos"
                  }
                  sub={
                    lastPayment
                      ? new Date(
                          lastPayment.clientCapturedAt || lastPayment.createdAt,
                        ).toLocaleDateString("es-MX")
                      : undefined
                  }
                />
              </div>
            </section>
            {visits[0] && (
              <section className="mt-3 flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white p-4">
                <Clock3 className="h-5 w-5 text-[var(--bitalis-action)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase text-slate-400">
                    Última visita
                  </p>
                  <p className="truncate text-sm font-bold text-[var(--bitalis-primary)]">
                    {visits[0].result ||
                      visits[0].visitType ||
                      "Visita registrada"}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300" />
              </section>
            )}
            <div
              data-no-swipe
              className="sticky top-0 z-10 -mx-1 mt-4 flex gap-1 overflow-x-auto rounded-2xl bg-white/95 p-1 shadow-sm backdrop-blur"
            >
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`min-h-11 shrink-0 rounded-xl px-4 text-xs font-black ${tab === t ? "bg-[var(--bitalis-primary)] text-white" : "text-slate-500"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <section className="mt-2 rounded-3xl border border-slate-200 bg-white p-4">
              {tab === "Resumen" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Info label="Teléfono principal" value={c.phone} />
                  <Info label="Teléfono adicional" value={c.secondaryPhone} />
                  <Info label="Calle" value={primaryAddress.street} />
                  <Info label="Colonia" value={primaryAddress.neighborhood} />
                  <Info
                    label="Manzana, lote y referencias"
                    value={primaryAddress.references}
                  />
                  <Info label="Correo" value={c.email} />
                  <Info
                    label="Ocupación"
                    value={c.occupation || c.profile?.occupation}
                  />
                  <Info
                    label="Día de cobro"
                    value={c.profile?.preferredCollectionDay}
                  />
                  <Info
                    label="Coordenadas"
                    value={
                      hasGps
                        ? `${Number(c.latitude).toFixed(6)}, ${Number(c.longitude).toFixed(6)}`
                        : "Sin ubicación"
                    }
                  />
                  <Info
                    label="Precisión GPS"
                    value={
                      c.locationAccuracy != null
                        ? `±${Math.round(c.locationAccuracy)} m`
                        : "Sin dato"
                    }
                  />
                </div>
              )}
              {tab === "Financiero" && (
                <div className="space-y-2">
                  <FinanceRow
                    label="Saldo actual"
                    value={money.format(totalBalance)}
                    strong
                  />
                  <FinanceRow
                    label="Vencido"
                    value={money.format(overdue)}
                    alert={overdue > 0}
                  />
                  <FinanceRow
                    label="Pagado acumulado"
                    value={money.format(totalPaid)}
                  />
                  <FinanceRow
                    label="Créditos activos"
                    value={String(credits.length)}
                  />
                  <div className="pt-3">
                    <h3 className="mb-2 text-xs font-black uppercase text-slate-400">
                      Ventas y productos
                    </h3>
                    <div className="space-y-2">
                      {purchases.map((sale: any) => (
                        <button
                          key={sale.id}
                          onClick={() => router.push(`/sales/${sale.id}`)}
                          className="w-full rounded-2xl bg-slate-50 p-3 text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <b className="block text-sm text-[var(--bitalis-primary)]">
                                {sale.saleNumber || "Venta"}
                              </b>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {(sale.items || []).map((item: any) => (
                                  <span
                                    key={item.id}
                                    className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-emerald-800"
                                  >
                                    {item.quantity}×{" "}
                                    {item.product?.name || "Producto"}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="text-right">
                              <b className="text-sm text-[var(--bitalis-primary)]">
                                {money.format(
                                  Number(
                                    sale.totalFinanced ?? sale.totalAmount ?? 0,
                                  ),
                                )}
                              </b>
                              <p className="text-[8px] text-slate-300">
                                Ref. {String(sale.id).slice(-6).toUpperCase()}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                      {!purchases.length && (
                        <p className="rounded-2xl bg-slate-50 p-4 text-center text-xs text-slate-500">
                          Este cliente todavía no tiene ventas.
                        </p>
                      )}
                    </div>
                  </div>
                  {credits.length > 0 && (
                    <div className="pt-3">
                      <h3 className="mb-2 text-xs font-black uppercase text-slate-400">
                        Créditos relacionados
                      </h3>
                      <div className="space-y-2">
                        {credits.map((credit: any) => (
                          <article
                            key={credit.id}
                            className="rounded-2xl bg-slate-50 p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <b className="text-sm text-[var(--bitalis-primary)]">
                                  {credit.sale?.saleNumber ||
                                    "Crédito de venta"}
                                </b>
                                <p className="mt-1 truncate text-[10px] text-slate-500">
                                  {(credit.sale?.items || [])
                                    .map(
                                      (item: any) =>
                                        item.product?.name || "Producto",
                                    )
                                    .join(" · ")}
                                </p>
                              </div>
                              <div className="text-right">
                                <b className="text-sm text-emerald-700">
                                  Saldo{" "}
                                  {money.format(
                                    Number(credit.saldoActual || 0),
                                  )}
                                </b>
                                <p className="text-[8px] text-slate-300">
                                  Ref.{" "}
                                  {String(credit.id).slice(-6).toUpperCase()}
                                </p>
                              </div>
                            </div>
                            <p className="mt-2 text-[10px] font-bold text-slate-500">
                              {(credit.payments || []).length} abono(s) ·{" "}
                              {credit.paymentFrequency || "Sin frecuencia"}
                            </p>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {tab === "Evidencias" && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["FACADE_PHOTO", "Fachada"],
                    ["CLIENT_PHOTO", "Cliente"],
                    ["CONTRACT_PHOTO", "Contrato"],
                  ].map(([type, label]) => (
                    <article
                      key={type}
                      className="rounded-3xl border border-slate-200 p-3"
                    >
                      <EvidenceImage
                        storageKey={byType(type)?.storageKey}
                        alt={label}
                      />
                      <p className="mt-2 text-xs font-black text-[var(--bitalis-primary)]">
                        {label}
                      </p>
                    </article>
                  ))}
                </div>
              )}
              {tab === "Historial" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 text-xs font-black uppercase text-slate-400">
                      Pagos
                    </h3>
                    <List
                      rows={payments}
                      render={(x: any) => (
                        <>
                          <b>{money.format(Number(x.amount || 0))}</b>
                          <span className="font-bold text-[var(--bitalis-primary)]">
                            {x._credit?.sale?.saleNumber || "Abono"} ·{" "}
                            {(x._credit?.sale?.items || [])
                              .map(
                                (item: any) => item.product?.name || "Producto",
                              )
                              .join(" · ")}
                          </span>
                          <span>
                            {new Date(
                              x.clientCapturedAt || x.createdAt,
                            ).toLocaleString("es-MX")}
                          </span>
                          <small className="text-[8px] text-slate-300">
                            Ref. {String(x.id).slice(-6).toUpperCase()}
                          </small>
                        </>
                      )}
                    />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-black uppercase text-slate-400">
                      Visitas
                    </h3>
                    <List
                      rows={visits}
                      render={(x: any) => (
                        <>
                          <b>{x.result || x.visitType}</b>
                          <span>
                            {new Date(
                              x.clientCapturedAt || x.createdAt,
                            ).toLocaleString("es-MX")}
                          </span>
                        </>
                      )}
                    />
                  </div>
                </div>
              )}
              {tab === "Notas" && (
                <List
                  rows={timeline}
                  render={(x: any) => (
                    <>
                      <b>{x.eventType || x.action || "Evento"}</b>
                      <span>
                        {x.description ||
                          new Date(x.createdAt).toLocaleString("es-MX")}
                      </span>
                    </>
                  )}
                />
              )}
            </section>
            {pending && ["SUPERVISORA", "ADMIN"].includes(role) && (
              <button
                onClick={() => router.push(`/clients/${params.id}/complete`)}
                className="mt-3 min-h-12 w-full rounded-2xl bg-amber-300 text-xs font-black text-[var(--bitalis-primary)]"
              >
                COMPLETAR EXPEDIENTE
              </button>
            )}
            <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-3xl gap-2 border-t border-slate-200 bg-white/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
              <button
                onClick={() =>
                  router.push(`/collections?clientId=${params.id}`)
                }
                className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--bitalis-action)] px-3 text-sm font-black text-white shadow-lg active:scale-[.98]"
              >
                <ReceiptText className="h-5 w-5" />
                Cobrar
              </button>
              <button
                onClick={() =>
                  router.push(
                    `/collections?clientId=${params.id}&action=no-payment`,
                  )
                }
                className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-amber-400 bg-amber-50 px-3 text-sm font-black text-amber-800 active:scale-[.98]"
              >
                No pagó
              </button>
              <button
                onClick={() =>
                  router.push(
                    `/collections?clientId=${params.id}&action=reschedule`,
                  )
                }
                className="flex min-h-14 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-[var(--bitalis-primary)] active:scale-[.98]"
              >
                Reagendar
              </button>
            </div>
          </>
        )}
        {!loading && !error && (
          <ClientLocationSheet
            open={locationOpen}
            clientId={params.id}
            clientLabel={name}
            value={{
              latitude: c.latitude ?? null,
              longitude: c.longitude ?? null,
              locationAccuracy: c.locationAccuracy ?? null,
              locationCapturedAt: c.locationCapturedAt ?? null,
            }}
            canEdit={canEdit}
            onClose={() => setLocationOpen(false)}
            onUpdated={updateLocation}
          />
        )}
      </main>
    </AppShell>
  );
}
function Quick({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-slate-50 text-[10px] font-black text-[var(--bitalis-primary)] active:scale-95 disabled:opacity-35"
    >
      <Icon className="h-5 w-5 text-[var(--bitalis-action)]" />
      {label}
    </button>
  );
}
function Finance({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 text-base font-black ${alert ? "text-red-600" : "text-[var(--bitalis-primary)]"}`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-[10px] font-bold text-slate-400">{sub}</p>
      )}
    </div>
  );
}
function FinanceRow({
  label,
  value,
  strong,
  alert,
}: {
  label: string;
  value: string;
  strong?: boolean;
  alert?: boolean;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between border-b border-slate-100 py-2 text-sm">
      <span
        className={
          strong
            ? "font-black text-[var(--bitalis-primary)]"
            : "font-bold text-slate-500"
        }
      >
        {label}
      </span>
      <span
        className={`font-black ${alert ? "text-red-600" : "text-[var(--bitalis-primary)]"}`}
      >
        {value}
      </span>
    </div>
  );
}
function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-[var(--bitalis-primary)]">
        {value || "Sin dato"}
      </p>
    </div>
  );
}
function List({ rows, render }: { rows: any[]; render: (x: any) => any }) {
  if (!rows?.length)
    return (
      <div className="p-6 text-center text-sm text-slate-500">
        Sin registros.
      </div>
    );
  return (
    <div className="space-y-2">
      {rows.map((x: any, i: number) => (
        <div
          key={x.id || i}
          className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4 text-sm"
        >
          <div className="flex min-w-0 flex-col gap-1">{render(x)}</div>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
        </div>
      ))}
    </div>
  );
}
