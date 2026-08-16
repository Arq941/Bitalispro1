import { NextRequest, NextResponse } from 'next/server';
import { ClientService } from '@/src/crm/client.service';
import { getClientUserContext } from '@/src/crm/auth-helper';
import { PermissionService } from '@/src/server/auth/permission.service';
import { ContractOcrData, extractContractOcr, isContractOcrConfigured } from '@/lib/ocr/contract';

const MAX_FILE = 6 * 1024 * 1024;
const TYPES = [
  ['facade', 'FACADE_PHOTO'],
  ['clientPhoto', 'CLIENT_PHOTO'],
  ['contract', 'CONTRACT_PHOTO'],
] as const;

function splitName(fullName: string) {
  const parts = fullName.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: 'PENDIENTE' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function usefulOcrAddress(ocr: ContractOcrData | null) {
  const address = ocr?.domicilio;
  if (!address?.calle || !address?.colonia) return null;
  return address;
}

function buildOcrReferences(ocr: ContractOcrData['domicilio']) {
  if (!ocr) return undefined;
  const parts = [
    ocr.entreCalles ? `Entre calles: ${ocr.entreCalles}` : '',
    ocr.manzana ? `MZN: ${ocr.manzana}` : '',
    ocr.lote ? `LTE: ${ocr.lote}` : '',
    ocr.referencias ? `Referencia: ${ocr.referencias}` : '',
    ocr.fachada ? `Fachada: ${ocr.fachada}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const user = getClientUserContext(req);
    if (!['VENDEDORA', 'ADMIN', 'SUPERVISORA'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'No tienes autorización para registrar prospectos.' }, { status: 403 });
    }
    await PermissionService.requirePermission(user.userId, 'clients.create');

    const form = await req.formData();
    const typedName = String(form.get('name') || '').trim();
    const typedPhone = String(form.get('phone') || '').trim();

    const files = new Map<string, File>();
    for (const [field] of TYPES) {
      const value = form.get(field);
      if (!(value instanceof File) || value.size <= 0) {
        return NextResponse.json({ success: false, error: 'Las fotografías de fachada, cliente y contrato son obligatorias.' }, { status: 400 });
      }
      if (!value.type.startsWith('image/')) return NextResponse.json({ success: false, error: 'Las evidencias deben ser fotografías.' }, { status: 400 });
      if (value.size > MAX_FILE) return NextResponse.json({ success: false, error: 'Cada fotografía debe pesar menos de 6 MB.' }, { status: 400 });
      files.set(field, value);
    }

    let ocrData: ContractOcrData | null = null;
    let ocrStatus: 'processed' | 'not_configured' | 'failed' = isContractOcrConfigured() ? 'failed' : 'not_configured';
    let ocrMessage = '';
    if (isContractOcrConfigured()) {
      try {
        const contract = files.get('contract')!;
        ocrData = await extractContractOcr({
          image: Buffer.from(await contract.arrayBuffer()),
          mimeType: contract.type || 'image/jpeg',
        });
        ocrStatus = 'processed';
      } catch (ocrError: any) {
        ocrMessage = String(ocrError?.message || 'No se pudo leer el contrato');
        console.warn('BITALIS contract OCR intake:', ocrMessage);
      }
    }

    const fullName = typedName || ocrData?.nombreCompleto || '';
    const phone = typedPhone || ocrData?.telefono || '';
    if (!fullName) return NextResponse.json({ success: false, error: 'El nombre del cliente es obligatorio y no pudo leerse del contrato.' }, { status: 400 });

    const parsed = splitName(fullName);
    const idempotencyKey = String(form.get('idempotencyKey') || `seller-intake-${Date.now()}`);
    const latitude = Number(form.get('latitude'));
    const longitude = Number(form.get('longitude'));
    const locationAccuracy = Number(form.get('locationAccuracy'));
    const hasGps = Number.isFinite(latitude) && Number.isFinite(longitude);

    if (!hasGps) return NextResponse.json({ success: false, error: 'La ubicación del cliente es obligatoria para el alta en calle.' }, { status: 400 });

    const client = await ClientService.createClient({
      ...parsed,
      phone,
      customerType: 'PENDING_SUPERVISOR',
      assignedSellerId: user.userId,
      latitude,
      longitude,
      locationAccuracy: Number.isFinite(locationAccuracy) ? locationAccuracy : undefined,
      idempotencyKey,
    }, user);

    const media = [];
    for (const [field, mediaType] of TYPES) {
      const file = files.get(field)!;
      const buffer = Buffer.from(await file.arrayBuffer());
      media.push(await ClientService.uploadMedia(client.id, {
        mediaType,
        fileContent: buffer,
        mimeType: file.type || 'image/jpeg',
        fileSize: file.size,
        latitude,
        longitude,
      }, user));
    }

    let ocrAddressCreated = false;
    const ocrAddress = usefulOcrAddress(ocrData);
    if (ocrAddress) {
      try {
        await ClientService.addAddress(client.id, {
          street: ocrAddress.calle,
          exteriorNumber: ocrAddress.numeroExterior || 'S/N',
          interiorNumber: ocrAddress.numeroInterior || undefined,
          neighborhood: ocrAddress.colonia,
          references: buildOcrReferences(ocrAddress),
          postalCode: ocrAddress.codigoPostal || '00000',
          city: ocrAddress.ciudad || ocrAddress.municipio || 'Pendiente',
          municipality: ocrAddress.municipio || undefined,
          state: ocrAddress.estado || 'México',
          country: 'MEXICO',
          latitude,
          longitude,
          accuracy: Number.isFinite(locationAccuracy) ? locationAccuracy : undefined,
          isPrimary: true,
        }, user);
        ocrAddressCreated = true;
      } catch (addressError: any) {
        console.warn('BITALIS OCR address enrichment:', String(addressError?.message || addressError));
      }
    }

    return NextResponse.json({
      success: true,
      client,
      media,
      pendingSupervisor: true,
      ocr: {
        status: ocrStatus,
        message: ocrMessage || undefined,
        addressCreated: ocrAddressCreated,
        data: ocrData,
      },
    }, { status: 201 });
  } catch (err: any) {
    const message = String(err?.message || 'No pudimos guardar el registro.');
    const status = message.includes('UNAUTHORIZED') ? 401 : message.includes('FORBIDDEN') ? 403 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
