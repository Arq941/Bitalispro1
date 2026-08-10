import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY missing in environment' }, { status: 500 });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Remove data URL header if present
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

    const promptText = `
    Analiza esta fotografía de un contrato de venta a crédito o contado en campo.
    Extrae con máxima precisión la siguiente información estructurada:
    1. Nombre completo del cliente.
    2. Dirección completa (Calle, Número, Colonia, Municipio, Referencias).
    3. Teléfono de contacto a 10 dígitos.
    4. Productos contratados: nombre del producto, cantidad de piezas o artículos y precio unitario o total si aparece.
    5. Monto total del contrato/venta.
    6. Monto del enganche recibido (ej. 100, 200, 300, 400).
    7. Pago semanal o abono semanal pactado.
    8. Día de cobro asignado (Lunes, Martes, Miércoles, Jueves, Viernes, Sábado o Domingo).
    9. Fecha sugerida del primer pago (AAAA-MM-DD).
    10. Tipo de venta (CREDITO o CONTADO) y observaciones adicionales.

    Responde únicamente en formato JSON válido.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: cleanBase64,
          },
        },
        { text: promptText },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nombreCompleto: { type: Type.STRING, description: 'Nombre completo del cliente' },
            direccion: { type: Type.STRING, description: 'Dirección completa con calle, número y colonia' },
            referencias: { type: Type.STRING, description: 'Referencias visuales del domicilio' },
            telefono: { type: Type.STRING, description: 'Teléfono a 10 dígitos' },
            productos: {
              type: Type.ARRAY,
              description: 'Lista de productos contratados con sus piezas',
              items: {
                type: Type.OBJECT,
                properties: {
                  nombreProducto: { type: Type.STRING, description: 'Nombre o descripción del producto' },
                  cantidad: { type: Type.NUMBER, description: 'Número de piezas/unidades' },
                  precioEstimado: { type: Type.NUMBER, description: 'Precio unitario o subtotal estimado' },
                },
                required: ['nombreProducto', 'cantidad'],
              },
            },
            montoTotal: { type: Type.NUMBER, description: 'Precio o valor total de la venta' },
            montoEnganche: { type: Type.NUMBER, description: 'Monto del enganche en MXN' },
            pagoSemanal: { type: Type.NUMBER, description: 'Monto del pago o abono semanal' },
            diaCobro: { type: Type.STRING, description: 'Día de cobro asignado (ej. Lunes)' },
            fechaPrimerPago: { type: Type.STRING, description: 'Fecha AAAA-MM-DD del primer abono' },
            tipoVenta: { type: Type.STRING, description: 'CREDITO o CONTADO' },
            observaciones: { type: Type.STRING, description: 'Notas adicionales del contrato' },
          },
          required: ['nombreCompleto', 'direccion', 'montoEnganche'],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error('No response text from Gemini OCR');
    }

    const parsedData = JSON.parse(resultText);
    return NextResponse.json({ success: true, data: parsedData });
  } catch (err: any) {
    console.error('OCR Error:', err);
    return NextResponse.json(
      { error: err.message || 'Error al procesar el contrato con IA' },
      { status: 500 }
    );
  }
}
