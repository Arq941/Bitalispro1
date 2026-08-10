'use client';

import { useState, useMemo, useCallback } from 'react';
import { Producto, Cliente, Venta, Usuario } from '@/types';
import { triggerHaptic } from '@/lib/utils';
import {
  ShoppingCart,
  X,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Package,
  DollarSign,
  Calendar,
  Sparkles,
  ShoppingBag,
  CreditCard,
  Tag,
  Boxes,
  ArrowRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface CarritoProductosModalProps {
  isOpen: boolean;
  cliente?: Cliente | null;
  clientes?: Cliente[];
  productos: Producto[];
  currentUser?: Usuario | null;
  onClose: () => void;
  onConfirmSale: (
    clienteTarget: Cliente,
    nuevaVenta: Venta,
    productosActualizados: Producto[]
  ) => void;
  onViewPhoto?: (url: string, title?: string) => void;
}

export default function CarritoProductosModal({
  isOpen,
  cliente,
  clientes = [],
  productos,
  currentUser,
  onClose,
  onConfirmSale,
  onViewPhoto,
}: CarritoProductosModalProps) {
  // Target Client State (if opened generically or pre-filled)
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(
    cliente?.id || (clientes.length > 0 ? clientes[0].id : null)
  );

  // Search & Category Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');

  // Shopping Cart Quantities Map: { [productoId: number]: quantity }
  const [cartItems, setCartItems] = useState<Record<number, number>>({});

  // Mobile drawer collapse state
  const [isMobileCartExpanded, setIsMobileCartExpanded] = useState<boolean>(false);

  // Sale Contract Options
  const [tipoVenta, setTipoVenta] = useState<'CREDITO' | 'CONTADO'>('CREDITO');
  const [customEnganche, setCustomEnganche] = useState<string>('');
  const [descuentoEmpresa, setDescuentoEmpresa] = useState<string>('0');
  const [semanasPlazo, setSemanasPlazo] = useState<number>(14);

  // Resolved Target Client
  const activeCliente = useMemo(() => {
    return cliente || clientes.find((c) => c.id === selectedClienteId) || null;
  }, [cliente, clientes, selectedClienteId]);

  // Categories list
  const categories = useMemo(() => {
    return ['TODAS', ...Array.from(new Set(productos.map((p) => p.categoria || 'General')))];
  }, [productos]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return productos.filter((p) => {
      if (!p.activo) return false;
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        p.nombre.toLowerCase().includes(term) ||
        p.descripcion.toLowerCase().includes(term) ||
        (p.categoria && p.categoria.toLowerCase().includes(term));
      const matchesCat =
        selectedCategory === 'TODAS' || p.categoria === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [productos, searchTerm, selectedCategory]);

  // Cart Calculations
  const cartEntries = useMemo(() => {
    return Object.entries(cartItems)
      .map(([idStr, qty]) => {
        const prod = productos.find((p) => p.id === Number(idStr));
        return { prod, qty };
      })
      .filter((entry): entry is { prod: Producto; qty: number } => Boolean(entry.prod) && entry.qty > 0);
  }, [cartItems, productos]);

  const totalItemsCount = useMemo(() => {
    return cartEntries.reduce((sum, item) => sum + item.qty, 0);
  }, [cartEntries]);

  const subtotalBase = useMemo(() => {
    return cartEntries.reduce(
      (sum, item) => sum + item.prod.precioBase * item.qty,
      0
    );
  }, [cartEntries]);

  const totalEngancheSugerido = useMemo(() => {
    return cartEntries.reduce(
      (sum, item) => sum + (item.prod.engancheMinimo || 0) * item.qty,
      0
    );
  }, [cartEntries]);

  const totalPagoSemanalSugerido = useMemo(() => {
    return cartEntries.reduce(
      (sum, item) => sum + (item.prod.pagoSemanalSugerido || 0) * item.qty,
      0
    );
  }, [cartEntries]);

  // Applied discount & final prices
  const montoDescuento = useMemo(() => Number(descuentoEmpresa) || 0, [descuentoEmpresa]);
  const precioFinalCalculado = useMemo(() => Math.max(0, subtotalBase - montoDescuento), [subtotalBase, montoDescuento]);

  const engancheEfectivo = useMemo(() => {
    if (tipoVenta === 'CONTADO') return precioFinalCalculado;
    if (customEnganche !== '') return Number(customEnganche);
    return totalEngancheSugerido;
  }, [tipoVenta, precioFinalCalculado, customEnganche, totalEngancheSugerido]);

  const saldoInicial = useMemo(() => Math.max(0, precioFinalCalculado - engancheEfectivo), [precioFinalCalculado, engancheEfectivo]);

  const pagoSemanalFinal = useMemo(() => {
    if (semanasPlazo > 0) {
      return Math.ceil(saldoInicial / semanasPlazo);
    }
    return totalPagoSemanalSugerido;
  }, [semanasPlazo, saldoInicial, totalPagoSemanalSugerido]);

  // Cart Handlers with Haptic feedback & Memoization
  const handleAddToCart = useCallback((prod: Producto) => {
    const stockAvailable = prod.stock ?? 10;
    const currentQty = cartItems[prod.id] || 0;

    if (currentQty >= stockAvailable) {
      triggerHaptic([100, 50, 100]);
      alert(`⚠️ Stock máximo alcanzado (${stockAvailable} unidades disponibles en inventario de ${prod.nombre}).`);
      return;
    }

    triggerHaptic(20);
    setCartItems((prev) => ({
      ...prev,
      [prod.id]: (prev[prod.id] || 0) + 1,
    }));
  }, [cartItems]);

  const handleRemoveFromCart = useCallback((prodId: number) => {
    triggerHaptic(15);
    setCartItems((prev) => {
      const currentQty = prev[prodId] || 0;
      if (currentQty <= 1) {
        const copy = { ...prev };
        delete copy[prodId];
        return copy;
      }
      return { ...prev, [prodId]: currentQty - 1 };
    });
  }, []);

  const handleClearCart = useCallback(() => {
    triggerHaptic([30, 30]);
    setCartItems({});
  }, []);

  // Submit Sale & Update Stock
  const handleCheckout = useCallback(() => {
    if (!activeCliente) {
      triggerHaptic([100, 50]);
      alert('⚠️ Por favor selecciona un cliente para asignar la venta.');
      return;
    }

    if (cartEntries.length === 0) {
      triggerHaptic([100, 50]);
      alert('⚠️ El carrito de compras está vacío. Agrega al menos un producto.');
      return;
    }

    // Check stock sufficiency again
    for (const item of cartEntries) {
      const available = item.prod.stock ?? 10;
      if (item.qty > available) {
        alert(`❌ Stock insuficiente para ${item.prod.nombre}. Disponible: ${available}, Requerido: ${item.qty}.`);
        return;
      }
    }

    triggerHaptic([50, 100, 50]);

    // Build Product Names list
    const productosNombres = cartEntries
      .map((item) => `${item.qty}x ${item.prod.nombre}`)
      .join(', ');

    const vendedoraIdActual = currentUser?.id || 1;
    const vendedoraNombreActual = currentUser?.nombre || 'Vendedora Campo';
    const fechaHoy = new Date().toISOString().split('T')[0];

    const nuevaVenta: Venta = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      clienteId: activeCliente.id,
      clienteNombre: activeCliente.nombreCompleto,
      clienteFolio: activeCliente.folio,
      vendedoraId: vendedoraIdActual,
      vendedoraNombre: vendedoraNombreActual,
      productoId: cartEntries[0].prod.id,
      productoNombre: productosNombres,
      piezas: totalItemsCount,
      tipo: tipoVenta,
      precioBase: subtotalBase,
      engancheMonto: engancheEfectivo,
      aporteEmpresa: 0,
      descuentoOtorgado: montoDescuento,
      saldoInicial: saldoInicial,
      saldoActual: saldoInicial,
      pagoSemanal: pagoSemanalFinal,
      comisionVendedora: Math.round(subtotalBase * 0.05) || 150,
      estado: 'PENDIENTE_VALIDACION',
      fechaVenta: fechaHoy,
      fechaPrimerPago: fechaHoy,
    };

    // Calculate updated stock for each product
    const productosActualizados = productos.map((p) => {
      const cartQty = cartItems[p.id];
      if (cartQty) {
        const currentStock = p.stock ?? 10;
        return {
          ...p,
          stock: Math.max(0, currentStock - cartQty),
        };
      }
      return p;
    });

    onConfirmSale(activeCliente, nuevaVenta, productosActualizados);
    onClose();
  }, [
    activeCliente,
    cartEntries,
    currentUser,
    engancheEfectivo,
    montoDescuento,
    onConfirmSale,
    onClose,
    pagoSemanalFinal,
    productos,
    cartItems,
    saldoInicial,
    subtotalBase,
    tipoVenta,
    totalItemsCount
  ]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-5 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-2 border-indigo-500/70 rounded-3xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden shadow-2xl text-white select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="bg-slate-950 border-b border-slate-800/90 px-4 py-3 sm:px-5 sm:py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/20 shrink-0">
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                Catálogo & Carrito
                <span className="text-[10px] bg-indigo-950 text-indigo-300 font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-800/80">
                  Stock Real
                </span>
              </h2>
              <p className="text-xs text-slate-400 hidden sm:block">
                Selecciona productos con los controles +/-, revisa el resumen y confirma la venta.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CLIENT SELECTOR BANNER */}
        <div className="bg-slate-950/90 border-b border-slate-800/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-300">
            <ShoppingBag className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Cliente Asignado:</span>
          </div>

          {cliente ? (
            <div className="flex items-center gap-2 bg-indigo-950/90 px-3 py-1 rounded-xl border border-indigo-800 font-extrabold text-indigo-200">
              <span className="truncate max-w-[200px] sm:max-w-none">{cliente.nombreCompleto}</span>
              <span className="text-[10px] bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded-md font-mono shrink-0">
                {cliente.folio}
              </span>
            </div>
          ) : (
            <select
              value={selectedClienteId || ''}
              onChange={(e) => setSelectedClienteId(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1 text-white font-bold text-xs focus:outline-none focus:border-indigo-500 max-w-full"
            >
              <option value="">-- Selecciona Cliente --</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombreCompleto} ({c.folio})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* MAIN BODY: LEFT CATALOG / RIGHT CART DRAWER */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* CATALOG PANEL (LEFT 7 COLS) */}
          <div className="lg:col-span-7 p-3 sm:p-4 space-y-3 overflow-y-auto border-b lg:border-b-0 lg:border-r border-slate-800/80">
            {/* Search & Category Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800/90 rounded-2xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* Horizontal Scroll Category Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px] font-bold">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      triggerHaptic(10);
                      setSelectedCategory(cat);
                    }}
                    className={`px-3 py-1 rounded-xl transition cursor-pointer shrink-0 border ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* PRODUCT CARDS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
              {filteredProducts.map((prod) => {
                const stockLeft = prod.stock ?? 10;
                const inCartQty = cartItems[prod.id] || 0;
                const isOutOfStock = stockLeft <= 0;

                return (
                  <div
                    key={prod.id}
                    className={`bg-slate-950/90 border p-3 rounded-2xl flex flex-col justify-between gap-2.5 transition relative overflow-hidden group ${
                      inCartQty > 0
                        ? 'border-indigo-500 shadow-lg shadow-indigo-500/10'
                        : 'border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    {/* Top image & stock badge */}
                    <div className="relative h-28 rounded-xl bg-slate-900 overflow-hidden border border-slate-800/90">
                      {prod.fotoUrl ? (
                        <img
                          src={prod.fotoUrl}
                          alt={prod.nombre}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300 cursor-pointer"
                          onClick={() => onViewPhoto && onViewPhoto(prod.fotoUrl!, prod.nombre)}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-1">
                          <Package className="w-7 h-7" />
                          <span className="text-[10px]">Sin imagen</span>
                        </div>
                      )}

                      {/* Stock Badge */}
                      <span
                        className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-black border backdrop-blur-md ${
                          isOutOfStock
                            ? 'bg-rose-950/90 text-rose-300 border-rose-800'
                            : stockLeft <= 3
                            ? 'bg-amber-950/90 text-amber-300 border-amber-800'
                            : 'bg-emerald-950/90 text-emerald-300 border-emerald-800'
                        }`}
                      >
                        {isOutOfStock ? 'Agotado (0)' : `Stock: ${stockLeft}`}
                      </span>

                      {/* In Cart Counter Badge */}
                      {inCartQty > 0 && (
                        <span className="absolute bottom-2 left-2 bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-400 shadow">
                          {inCartQty} en carrito
                        </span>
                      )}
                    </div>

                    {/* Content info */}
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-extrabold text-xs text-white leading-tight line-clamp-1">
                          {prod.nombre}
                        </h4>
                        <span className="text-[10px] text-indigo-300 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-800 shrink-0 font-bold">
                          {prod.categoria || 'General'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1">
                        {prod.descripcion}
                      </p>

                      <div className="flex items-baseline justify-between pt-1 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Precio:</span>
                          <span className="font-black text-emerald-400">
                            ${prod.precioBase.toLocaleString()} MXN
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Pago Semanal:</span>
                          <span className="font-bold text-indigo-300">
                            ${prod.pagoSemanalSugerido}/sem
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Add / Quantity buttons */}
                    <div className="pt-1">
                      {inCartQty === 0 ? (
                        <button
                          type="button"
                          disabled={isOutOfStock}
                          onClick={() => handleAddToCart(prod)}
                          className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow cursor-pointer ${
                            isOutOfStock
                              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                          <span>Añadir al Carrito</span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-between bg-slate-900 border border-indigo-500/70 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(prod.id)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition cursor-pointer active:scale-90"
                            title="Restar 1"
                          >
                            <Minus className="w-4 h-4 text-indigo-300" />
                          </button>
                          <span className="font-black text-xs text-indigo-200 px-3 font-mono">
                            {inCartQty} pzas
                          </span>
                          <button
                            type="button"
                            disabled={inCartQty >= stockLeft}
                            onClick={() => handleAddToCart(prod)}
                            className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition cursor-pointer disabled:opacity-50 active:scale-90"
                            title="Sumar 1"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SHOPPING CART SUMMARY PANEL (RIGHT 5 COLS) */}
          <div className="lg:col-span-5 bg-slate-950 p-3 sm:p-4 space-y-3 flex flex-col justify-between overflow-y-auto">
            {/* Cart Items List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-indigo-400" />
                  Resumen de Compra ({totalItemsCount} artículos)
                </h3>
                {cartEntries.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearCart}
                    className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Vaciar</span>
                  </button>
                )}
              </div>

              {cartEntries.length === 0 ? (
                <div className="py-10 text-center space-y-2 text-slate-500">
                  <ShoppingCart className="w-10 h-10 mx-auto text-slate-700" />
                  <p className="text-xs font-semibold">El carrito está vacío</p>
                  <p className="text-[11px] text-slate-600">
                    Selecciona productos del catálogo a la izquierda para agregarlos al cliente.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {cartEntries.map(({ prod, qty }) => (
                    <div
                      key={prod.id}
                      className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <h5 className="font-bold text-white truncate">{prod.nombre}</h5>
                        <p className="text-[11px] text-slate-400">
                          {qty} x ${prod.precioBase.toLocaleString()} MXN
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-emerald-400">
                          ${(prod.precioBase * qty).toLocaleString()} MXN
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(prod.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                          title="Eliminar artículo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* SALE CONTRACT CONFIGURATION */}
              {cartEntries.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-800 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Tipo de Venta</label>
                      <select
                        value={tipoVenta}
                        onChange={(e) => setTipoVenta(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-bold"
                      >
                        <option value="CREDITO">Crédito Semanal</option>
                        <option value="CONTADO">Contado Directo</option>
                      </select>
                    </div>

                    {tipoVenta === 'CREDITO' && (
                      <div>
                        <label className="block text-slate-400 font-bold mb-1">Plazo Semanas</label>
                        <select
                          value={semanasPlazo}
                          onChange={(e) => setSemanasPlazo(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-bold"
                        >
                          <option value={10}>10 Semanas</option>
                          <option value={14}>14 Semanas</option>
                          <option value={16}>16 Semanas</option>
                          <option value={20}>20 Semanas</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {tipoVenta === 'CREDITO' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-400 font-bold mb-1">
                          Enganche Solicitado ($)
                        </label>
                        <input
                          type="number"
                          placeholder={`Mín: $${totalEngancheSugerido}`}
                          value={customEnganche}
                          onChange={(e) => setCustomEnganche(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 font-bold mb-1">
                          Descuento Especial ($)
                        </label>
                        <input
                          type="number"
                          value={descuentoEmpresa}
                          onChange={(e) => setDescuentoEmpresa(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* TOTALS & CHECKOUT FOOTER */}
            {cartEntries.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="bg-slate-900 p-3 rounded-2xl border border-indigo-500/30 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Monto Total Productos:</span>
                    <span className="font-bold text-white">${subtotalBase.toLocaleString()} MXN</span>
                  </div>

                  {montoDescuento > 0 && (
                    <div className="flex justify-between text-emerald-400 font-bold">
                      <span>Descuento Aplicado:</span>
                      <span>-${montoDescuento.toLocaleString()} MXN</span>
                    </div>
                  )}

                  <div className="flex justify-between text-indigo-300 font-bold">
                    <span>Enganche Requerido:</span>
                    <span>${engancheEfectivo.toLocaleString()} MXN</span>
                  </div>

                  <div className="flex justify-between text-slate-300 font-extrabold pt-1 border-t border-slate-800 text-sm">
                    <span>Saldo Inicial en Tarjeta:</span>
                    <span className="text-emerald-400">${saldoInicial.toLocaleString()} MXN</span>
                  </div>

                  {tipoVenta === 'CREDITO' && (
                    <div className="flex justify-between text-indigo-400 font-black text-xs pt-0.5">
                      <span>Pago Semanal Estimado:</span>
                      <span>${pagoSemanalFinal.toLocaleString()} MXN / sem</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Confirmar Venta y Descontar Stock</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

