import { GoogleGenAI, Type } from '@google/genai';

export type ContractAddressOcr = {
  calle?: string;
  numeroExterior?: string;
  numeroInterior?: string;
  colonia?: string;
  municipio?: string;
  ciudad?: string;
  estado?: string;
  codigoPostal?: string;
  referencias?: string;
};

export type ContractProductOcr = {
  nombreProducto?: string;
  cantidad?: number;
  precioUnitario?: number;
  subtotal?: number;
};

export type ContractOcrData = {
  nombreCompleto?: string;
  telefono?: string;
  domicilio?: ContractAddressOcr;
  productos?: ContractProductOcr[];
  montoTotal?: number;
  montoEnganche?: number;
  pagoSemanal?: number;
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
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
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
        text: `Analiza la fotografía del contrato de BITALIS. Lee únicamente información realmente visible; no inventes ni completes datos que no aparezcan. Extrae los datos del cliente y de la operación. Separa el domicilio en calle, número exterior, número interior, colonia, municipio, ciudad, estado, código postal y referencias. Normaliza el teléfono mexicano a 10 dígitos cuando sea legible. Extrae productos, cantidades, precios, total, enganche, pago semanal, día de cobro, fecha de primer pago y tipo de venta cuando estén escritos. Si un dato no es legible, omítelo o déjalo vacío. En textoVisible incluye una transcripción breve de los fragmentos útiles para revisión humana.`,
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          nombreCompleto: { type: Type.STRING },
          telefono: { type: Type.STRING },
          domicilio: {
            type: Type.OBJECT,
            properties: {
              calle: { type: Type.STRING },
              numeroExterior: { type: Type.STRING },
              numeroInterior: { type: Type.STRING },
              colonia: { type: Type.STRING },
              municipio: { type: Type.STRING },
              ciudad: { type: Type.STRING },
              estado: { type: Type.STRING },
              codigoPostal: { type: Type.STRING },
              referencias: { type: Type.STRING },
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
              },
            },
          },
          montoTotal: { type: Type.NUMBER },
          montoEnganche: { type: Type.NUMBER },
          pagoSemanal: { type: Type.NUMBER },
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
    nombreCompleto: cleanText(raw.nombreCompleto) || undefined,
    telefono: cleanPhone(raw.telefono) || undefined,
    domicilio: {
      calle: cleanText(domicilio.calle) || undefined,
      numeroExterior: cleanText(domicilio.numeroExterior) || undefined,
      numeroInterior: cleanText(domicilio.numeroInterior) || undefined,
      colonia: cleanText(domicilio.colonia) || undefined,
      municipio: cleanText(domicilio.municipio) || undefined,
      ciudad: cleanText(domicilio.ciudad) || undefined,
      estado: cleanText(domicilio.estado) || undefined,
      codigoPostal: cleanText(domicilio.codigoPostal).replace(/\D/g, '').slice(0, 5) || undefined,
      referencias: cleanText(domicilio.referencias) || undefined,
    },
    productos: Array.isArray(raw.productos)
      ? raw.productos.map((product) => ({
          nombreProducto: cleanText(product?.nombreProducto) || undefined,
          cantidad: cleanNumber(product?.cantidad),
          precioUnitario: cleanNumber(product?.precioUnitario),
          subtotal: cleanNumber(product?.subtotal),
        })).filter((product) => product.nombreProducto || product.cantidad)
      : [],
    montoTotal: cleanNumber(raw.montoTotal),
    montoEnganche: cleanNumber(raw.montoEnganche),
    pagoSemanal: cleanNumber(raw.pagoSemanal),
    diaCobro: cleanText(raw.diaCobro) || undefined,
    fechaPrimerPago: cleanText(raw.fechaPrimerPago) || undefined,
    tipoVenta: cleanText(raw.tipoVenta).toUpperCase() || undefined,
    observaciones: cleanText(raw.observaciones) || undefined,
    textoVisible: cleanText(raw.textoVisible) || undefined,
  };
}
