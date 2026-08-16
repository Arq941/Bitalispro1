import { GoogleGenAI, Type } from '@google/genai';

export type ContractAddressOcr = {
  calle?: string;
  numeroExterior?: string;
  numeroInterior?: string;
  entreCalles?: string;
  colonia?: string;
  manzana?: string;
  lote?: string;
  municipio?: string;
  ciudad?: string;
  estado?: string;
  codigoPostal?: string;
  referencias?: string;
  fachada?: string;
};

export type ContractProductOcr = {
  nombreProducto?: string;
  cantidad?: number;
  precioUnitario?: number;
  subtotal?: number;
  importe?: number;
};

export type ContractOcrData = {
  folio?: string;
  fechaVenta?: string;
  vendedora?: string;
  nombreCompleto?: string;
  telefono?: string;
  domicilio?: ContractAddressOcr;
  productos?: ContractProductOcr[];
  notas?: string;
  montoTotal?: number;
  montoEnganche?: number;
  montoDescuento?: number;
  pagoSemanal?: number;
  frecuenciaPago?: string;
  diaCobro?: string;
  fechaPrimerPago?: string;
  tipoVenta?: string;
  observaciones?: string;
  textoVisible?: string;
};

const cleanText = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ');
const cleanPhone = (value: unknown) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
};
const cleanNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return undefined;
  const normalized = typeof value === 'string' ? value.replace(/[$,\s]/g, '') : value;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : undefined;
};
const cleanDate = (value: unknown) => {
  const text = cleanText(value);
  if (!text) return undefined;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return text;
  const mx = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!mx) return text;
  const year = mx[3].length === 2 ? `20${mx[3]}` : mx[3];
  return `${year}-${mx[2].padStart(2, '0')}-${mx[1].padStart(2, '0')}`;
};

export function isContractOcrConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export async function extractContractOcr(input: { image: Buffer | string; mimeType?: string }): Promise<ContractOcrData> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY missing in environment');

  const imageBase64 = Buffer.isBuffer(input.image)
    ? input.image.toString('base64')
    : String(input.image).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
  if (!imageBase64) throw new Error('No image data provided');

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: [
      {
        inlineData: {
          mimeType: input.mimeType || 'image/jpeg',
          data: imageBase64,
        },
      },
      {
        text: `Eres el OCR especializado del contrato físico usado por BITALIS, cuyo formato de referencia actual es el contrato de Raíz Vital.

La hoja tiene zonas fijas. Lee únicamente información manuscrita o impresa realmente visible y nunca inventes datos. Cuando un campo esté vacío, ilegible o no exista, omítelo.

MAPEO DEL FORMATO:
- Encabezado superior derecho: "Folio", "Fecha Venta" y "Vendedora".
- Datos del cliente: "Nombre", "Número de contacto", "Calle", "Entre las calles", "Colonia", casillas "MZN" y "LTE", "Referencia" y "Fachada".
- Tabla central: hasta 3 renglones de "Nombre del producto" e "Importe". Si la cantidad no está escrita, usa cantidad 1 únicamente cuando el renglón contiene claramente un solo producto; si hay duda, omite cantidad.
- Bloque financiero: "Notas", "Enganche", "Descuento" y "Total".
- Bloque inferior: "Fecha de venta", "Fec. Primer abono", "Pago" (por ejemplo Semanal), "Importe de Abono" y "Observaciones".
- No confundas textos preimpresos de cláusulas, teléfonos de oficina/WhatsApp del pie, lema, nombre de marca o firmas con datos del cliente.

NORMALIZACIÓN:
- Teléfono del cliente: 10 dígitos mexicanos cuando sea legible.
- Fechas: intenta devolver AAAA-MM-DD.
- Importes: número sin signo $ ni separadores de miles.
- Si "Pago" dice Semanal, Quincenal, Mensual u otra frecuencia, colócalo en frecuenciaPago.
- diaCobro solo si el contrato contiene explícitamente un día de la semana para cobrar; no lo deduzcas de la fecha.
- tipoVenta solo si está explícitamente marcado o escrito como CONTADO/CREDITO/PAGOS; no lo inventes.
- En textoVisible incluye una transcripción corta de los campos útiles detectados para revisión humana.

Extrae la estructura solicitada y responde solo JSON válido.`,
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          folio: { type: Type.STRING },
          fechaVenta: { type: Type.STRING },
          vendedora: { type: Type.STRING },
          nombreCompleto: { type: Type.STRING },
          telefono: { type: Type.STRING },
          domicilio: {
            type: Type.OBJECT,
            properties: {
              calle: { type: Type.STRING },
              numeroExterior: { type: Type.STRING },
              numeroInterior: { type: Type.STRING },
              entreCalles: { type: Type.STRING },
              colonia: { type: Type.STRING },
              manzana: { type: Type.STRING },
              lote: { type: Type.STRING },
              municipio: { type: Type.STRING },
              ciudad: { type: Type.STRING },
              estado: { type: Type.STRING },
              codigoPostal: { type: Type.STRING },
              referencias: { type: Type.STRING },
              fachada: { type: Type.STRING },
            },
          },
          productos: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                nombreProducto: { type: Type.STRING },
                cantidad: { type: Type.NUMBER },
                precioUnitario: { type: Type.NUMBER },
                subtotal: { type: Type.NUMBER },
                importe: { type: Type.NUMBER },
              },
            },
          },
          notas: { type: Type.STRING },
          montoTotal: { type: Type.NUMBER },
          montoEnganche: { type: Type.NUMBER },
          montoDescuento: { type: Type.NUMBER },
          pagoSemanal: { type: Type.NUMBER },
          frecuenciaPago: { type: Type.STRING },
          diaCobro: { type: Type.STRING },
          fechaPrimerPago: { type: Type.STRING },
          tipoVenta: { type: Type.STRING },
          observaciones: { type: Type.STRING },
          textoVisible: { type: Type.STRING },
        },
      },
    },
  });

  if (!response.text) throw new Error('No response text from contract OCR');
  const raw = JSON.parse(response.text) as ContractOcrData;
  const domicilio = raw.domicilio || {};

  return {
    folio: cleanText(raw.folio) || undefined,
    fechaVenta: cleanDate(raw.fechaVenta),
    vendedora: cleanText(raw.vendedora) || undefined,
    nombreCompleto: cleanText(raw.nombreCompleto) || undefined,
    telefono: cleanPhone(raw.telefono) || undefined,
    domicilio: {
      calle: cleanText(domicilio.calle) || undefined,
      numeroExterior: cleanText(domicilio.numeroExterior) || undefined,
      numeroInterior: cleanText(domicilio.numeroInterior) || undefined,
      entreCalles: cleanText(domicilio.entreCalles) || undefined,
      colonia: cleanText(domicilio.colonia) || undefined,
      manzana: cleanText(domicilio.manzana) || undefined,
      lote: cleanText(domicilio.lote) || undefined,
      municipio: cleanText(domicilio.municipio) || undefined,
      ciudad: cleanText(domicilio.ciudad) || undefined,
      estado: cleanText(domicilio.estado) || undefined,
      codigoPostal: cleanText(domicilio.codigoPostal).replace(/\D/g, '').slice(0, 5) || undefined,
      referencias: cleanText(domicilio.referencias) || undefined,
      fachada: cleanText(domicilio.fachada) || undefined,
    },
    productos: Array.isArray(raw.productos)
      ? raw.productos.map((product) => ({
          nombreProducto: cleanText(product?.nombreProducto) || undefined,
          cantidad: cleanNumber(product?.cantidad),
          precioUnitario: cleanNumber(product?.precioUnitario),
          subtotal: cleanNumber(product?.subtotal),
          importe: cleanNumber(product?.importe),
        })).filter((product) => product.nombreProducto || product.cantidad || product.importe)
      : [],
    notas: cleanText(raw.notas) || undefined,
    montoTotal: cleanNumber(raw.montoTotal),
    montoEnganche: cleanNumber(raw.montoEnganche),
    montoDescuento: cleanNumber(raw.montoDescuento),
    pagoSemanal: cleanNumber(raw.pagoSemanal),
    frecuenciaPago: cleanText(raw.frecuenciaPago) || undefined,
    diaCobro: cleanText(raw.diaCobro) || undefined,
    fechaPrimerPago: cleanDate(raw.fechaPrimerPago),
    tipoVenta: cleanText(raw.tipoVenta).toUpperCase() || undefined,
    observaciones: cleanText(raw.observaciones) || undefined,
    textoVisible: cleanText(raw.textoVisible) || undefined,
  };
}
