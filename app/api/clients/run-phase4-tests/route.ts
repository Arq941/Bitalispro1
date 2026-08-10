import { NextResponse } from 'next/server';
import { ClientService, ClientUserContext } from '@/src/crm/client.service';
import { AuditLogService } from '@/src/audit/audit-log.service';

async function runPhase4Tests() {
  const testsResults: { id: number; name: string; passed: boolean; details?: string }[] = [];

  // Reset memory stores for clean test run
  ClientService.clearMemoryStore();

  const adminContext: ClientUserContext = { userId: 'usr_admin_p4', role: 'ADMIN' };
  const vendedoraAContext: ClientUserContext = { userId: 'usr_vend_a', role: 'VENDEDORA', zoneId: 'ZONE_NORTH' };
  const vendedoraBContext: ClientUserContext = { userId: 'usr_vend_b', role: 'VENDEDORA', zoneId: 'ZONE_SOUTH' };
  const supervisoraContext: ClientUserContext = { userId: 'usr_super_p4', role: 'SUPERVISORA' };

  let testClientId = '';
  let testMediaId1 = '';
  let testMediaId2 = '';
  let testNoteId = '';

  try {
    // 1. Crear prospecto
    try {
      const client = await ClientService.createClient(
        {
          firstName: 'Juan',
          lastName: 'Pérez',
          secondLastName: 'López',
          phone: '5551234567',
          email: 'juan.perez@example.com',
          customerType: 'NEW',
          assignedSellerId: vendedoraAContext.userId,
          zoneId: 'ZONE_NORTH',
        },
        vendedoraAContext
      );
      testClientId = client.id;
      const passed = client.status === 'PROSPECT' && client.firstName === 'Juan';
      testsResults.push({ id: 1, name: 'Crear prospecto', passed, details: `Status: ${client.status}` });
    } catch (e: any) {
      testsResults.push({ id: 1, name: 'Crear prospecto', passed: false, details: e.message });
    }

    // 2. Generar folio único
    try {
      const client = await ClientService.getClientById(testClientId, adminContext);
      const currentYear = new Date().getFullYear();
      const passed = !!client?.clientNumber && client.clientNumber.startsWith(`CLI-${currentYear}-`);
      testsResults.push({ id: 2, name: 'Generar folio único', passed, details: `Folio: ${client?.clientNumber}` });
    } catch (e: any) {
      testsResults.push({ id: 2, name: 'Generar folio único', passed: false, details: e.message });
    }

    // 3. Concurrencia de folios
    try {
      const [folio1, folio2] = await Promise.all([
        ClientService.generateClientNumber(),
        ClientService.generateClientNumber(),
      ]);
      const passed = !!folio1 && !!folio2;
      testsResults.push({ id: 3, name: 'Concurrencia de folios', passed, details: `Folio1: ${folio1}, Folio2: ${folio2}` });
    } catch (e: any) {
      testsResults.push({ id: 3, name: 'Concurrencia de folios', passed: false, details: e.message });
    }

    // 4. Capturar GPS
    try {
      const clientWithGps = await ClientService.createClient(
        {
          firstName: 'María',
          lastName: 'Gómez',
          phone: '5559876543',
          latitude: 19.4326,
          longitude: -99.1332,
          locationAccuracy: 5.0,
        },
        adminContext
      );
      const passed = clientWithGps.latitude === 19.4326 && clientWithGps.longitude === -99.1332;
      testsResults.push({ id: 4, name: 'Capturar GPS', passed, details: `Lat: ${clientWithGps.latitude}, Lng: ${clientWithGps.longitude}` });
    } catch (e: any) {
      testsResults.push({ id: 4, name: 'Capturar GPS', passed: false, details: e.message });
    }

    // 5. Validar coordenadas GPS fuera de rango
    try {
      let threwError = false;
      try {
        await ClientService.createClient(
          {
            firstName: 'Carlos',
            lastName: 'Ruiz',
            phone: '5550001122',
            latitude: 120.0, // Invalid latitude > 90
            longitude: -99.1332,
          },
          adminContext
        );
      } catch (err: any) {
        threwError = err.message.includes('GPS');
      }
      testsResults.push({ id: 5, name: 'Validar coordenadas', passed: threwError, details: threwError ? 'Error GPS capturado' : 'No arrojó error' });
    } catch (e: any) {
      testsResults.push({ id: 5, name: 'Validar coordenadas', passed: false, details: e.message });
    }

    // 6. Crear domicilio
    try {
      const address1 = await ClientService.addAddress(
        testClientId,
        {
          street: 'Av. Insurgentes Sur',
          exteriorNumber: '100',
          neighborhood: 'Roma Norte',
          postalCode: '06700',
          city: 'CDMX',
          state: 'CDMX',
          isPrimary: true,
          latitude: 19.418,
          longitude: -99.164,
        },
        adminContext
      );
      const passed = !!address1.id && address1.isPrimary === true;
      testsResults.push({ id: 6, name: 'Crear domicilio', passed, details: `Address ID: ${address1.id}` });
    } catch (e: any) {
      testsResults.push({ id: 6, name: 'Crear domicilio', passed: false, details: e.message });
    }

    // 7. Mantener historial de domicilios
    try {
      const address2 = await ClientService.addAddress(
        testClientId,
        {
          street: 'Calle Reforma',
          exteriorNumber: '250',
          neighborhood: 'Juárez',
          postalCode: '06600',
          city: 'CDMX',
          state: 'CDMX',
          isPrimary: true,
        },
        adminContext
      );
      const c360 = await ClientService.getClient360(testClientId, adminContext);
      const allAddresses = c360.addresses;
      const previousClosed = allAddresses.some((a: any) => a.id !== address2.id && a.validUntil !== null);
      const passed = allAddresses.length >= 2 && previousClosed;
      testsResults.push({ id: 7, name: 'Mantener historial de domicilios', passed, details: `Total domicilios: ${allAddresses.length}, Anterior cerrado: ${previousClosed}` });
    } catch (e: any) {
      testsResults.push({ id: 7, name: 'Mantener historial de domicilios', passed: false, details: e.message });
    }

    // 8. Crear referencia
    try {
      const ref = await ClientService.addReference(
        testClientId,
        {
          name: 'Ana Pérez',
          relationship: 'HERMANA',
          phone: '5553334444',
          referenceType: 'PERSONAL',
        },
        adminContext
      );
      const passed = ref.name === 'Ana Pérez' && ref.referenceType === 'PERSONAL';
      testsResults.push({ id: 8, name: 'Crear referencia', passed, details: `Ref ID: ${ref.id}` });
    } catch (e: any) {
      testsResults.push({ id: 8, name: 'Crear referencia', passed: false, details: e.message });
    }

    // 9. Crear perfil comercial
    try {
      const profile = await ClientService.upsertProfile(
        testClientId,
        {
          occupation: 'Comerciante',
          businessActivity: 'Venta de ropa',
          paymentPreference: 'Semanal',
          incomeRange: '10000-15000',
        },
        adminContext
      );
      const passed = profile.occupation === 'Comerciante' && profile.paymentPreference === 'Semanal';
      testsResults.push({ id: 9, name: 'Crear perfil comercial', passed, details: `Profile ID: ${profile.id}` });
    } catch (e: any) {
      testsResults.push({ id: 9, name: 'Crear perfil comercial', passed: false, details: e.message });
    }

    // 10. Subir fotografía
    try {
      const media1 = await ClientService.uploadMedia(
        testClientId,
        { mediaType: 'CLIENT_PHOTO', url: 'https://example.com/client.jpg', latitude: 19.4, longitude: -99.1 },
        adminContext
      );
      testMediaId1 = media1.id;
      const passed = media1.mediaType === 'CLIENT_PHOTO' && media1.status === 'PENDING_REVIEW';
      testsResults.push({ id: 10, name: 'Subir fotografía', passed, details: `Media ID: ${media1.id}` });
    } catch (e: any) {
      testsResults.push({ id: 10, name: 'Subir fotografía', passed: false, details: e.message });
    }

    // 11. Subir fotografía de fachada
    try {
      const media2 = await ClientService.uploadMedia(
        testClientId,
        { mediaType: 'FACADE_PHOTO', url: 'https://example.com/facade.jpg' },
        adminContext
      );
      testMediaId2 = media2.id;
      const passed = media2.mediaType === 'FACADE_PHOTO';
      testsResults.push({ id: 11, name: 'Subir fotografía de fachada', passed, details: `Media ID: ${media2.id}` });
    } catch (e: any) {
      testsResults.push({ id: 11, name: 'Subir fotografía de fachada', passed: false, details: e.message });
    }

    // 12. Subir contrato
    try {
      const contract = await ClientService.uploadMedia(
        testClientId,
        { mediaType: 'CONTRACT_PHOTO', url: 'https://example.com/contract.jpg' },
        adminContext
      );
      const passed = contract.mediaType === 'CONTRACT_PHOTO';
      testsResults.push({ id: 12, name: 'Subir contrato', passed, details: `Contract ID: ${contract.id}` });
    } catch (e: any) {
      testsResults.push({ id: 12, name: 'Subir contrato', passed: false, details: e.message });
    }

    // 13. Aprobar evidencia
    try {
      const approvedMedia = await ClientService.reviewMedia(testMediaId1, 'APPROVED', 'Evidencia clara y válida', supervisoraContext);
      const passed = approvedMedia.status === 'APPROVED' && approvedMedia.reviewedBy === supervisoraContext.userId;
      testsResults.push({ id: 13, name: 'Aprobar evidencia', passed, details: `Status: ${approvedMedia.status}` });
    } catch (e: any) {
      testsResults.push({ id: 13, name: 'Aprobar evidencia', passed: false, details: e.message });
    }

    // 14. Rechazar evidencia
    try {
      const rejectedMedia = await ClientService.reviewMedia(testMediaId2, 'REJECTED', 'Imagen borrosa', supervisoraContext);
      const passed = rejectedMedia.status === 'REJECTED' && rejectedMedia.rejectionReason === 'Imagen borrosa';
      testsResults.push({ id: 14, name: 'Rechazar evidencia', passed, details: `Status: ${rejectedMedia.status}` });
    } catch (e: any) {
      testsResults.push({ id: 14, name: 'Rechazar evidencia', passed: false, details: e.message });
    }

    // 15. Bloquear modificación no autorizada de evidencia aprobada por Vendedora
    try {
      let blocked = false;
      const { AbacService } = await import('@/src/server/auth/abac.service');
      const evalResult = AbacService.evaluate(
        { userId: vendedoraAContext.userId, role: 'VENDEDORA', permissions: ['*'] },
        { entity: 'ClientMedia', entityId: testMediaId1, evidenceStatus: 'APPROVED' },
        'evidences.update'
      );
      blocked = !evalResult.allowed;
      testsResults.push({ id: 15, name: 'Bloquear modificación de evidencia aprobada', passed: blocked, details: evalResult.reason });
    } catch (e: any) {
      testsResults.push({ id: 15, name: 'Bloquear modificación de evidencia aprobada', passed: false, details: e.message });
    }

    // 16. Reemplazar evidencia mediante versionado
    try {
      const replacedMedia = await ClientService.replaceMedia(
        testMediaId1,
        { url: 'https://example.com/client_v2.jpg' },
        adminContext
      );
      const c360 = await ClientService.getClient360(testClientId, adminContext);
      const originalInDb = c360.media.find((m: any) => m.id === testMediaId1);
      const passed = originalInDb?.status === 'REPLACED' && replacedMedia.replacedMediaId === testMediaId1;
      testsResults.push({ id: 16, name: 'Reemplazar evidencia mediante versionado', passed, details: `Original status: ${originalInDb?.status}, New ID: ${replacedMedia.id}` });
    } catch (e: any) {
      testsResults.push({ id: 16, name: 'Reemplazar evidencia mediante versionado', passed: false, details: e.message });
    }

    // 17. Crear nota CRM
    try {
      const note = await ClientService.addNote(
        testClientId,
        { noteType: 'VISIT', content: 'El cliente prefiere cobros los viernes por la mañana.' },
        adminContext
      );
      testNoteId = note.id;
      const passed = note.content.includes('viernes') && note.noteType === 'VISIT';
      testsResults.push({ id: 17, name: 'Crear nota CRM', passed, details: `Note ID: ${note.id}` });
    } catch (e: any) {
      testsResults.push({ id: 17, name: 'Crear nota CRM', passed: false, details: e.message });
    }

    // 18. Soft-delete de nota
    try {
      const deletedNote = await ClientService.softDeleteNote(testNoteId, adminContext);
      const c360 = await ClientService.getClient360(testClientId, adminContext);
      const activeNotes = c360.notes;
      const passed = deletedNote.isDeleted === true && !activeNotes.some((n: any) => n.id === testNoteId);
      testsResults.push({ id: 18, name: 'Soft-delete de nota', passed, details: `isDeleted: ${deletedNote.isDeleted}` });
    } catch (e: any) {
      testsResults.push({ id: 18, name: 'Soft-delete de nota', passed: false, details: e.message });
    }

    // 19. Registrar visita
    try {
      const visit = await ClientService.recordVisit(
        testClientId,
        {
          visitType: 'COLLECTION_VISIT',
          result: 'SUCCESS',
          latitude: 19.418,
          longitude: -99.164,
          accuracy: 4.2,
          notes: 'Pago recibido correctamente.',
        },
        adminContext
      );
      const passed = visit.visitType === 'COLLECTION_VISIT' && visit.result === 'SUCCESS';
      testsResults.push({ id: 19, name: 'Registrar visita', passed, details: `Visit ID: ${visit.id}` });
    } catch (e: any) {
      testsResults.push({ id: 19, name: 'Registrar visita', passed: false, details: e.message });
    }

    // 20. Registrar visita sin contacto
    try {
      const visitNoContact = await ClientService.recordVisit(
        testClientId,
        {
          visitType: 'COLLECTION_VISIT',
          result: 'NOT_HOME',
          latitude: 19.418,
          longitude: -99.164,
          notes: 'Cliente no se encontraba en el domicilio.',
        },
        adminContext
      );
      const passed = visitNoContact.result === 'NOT_HOME';
      testsResults.push({ id: 20, name: 'Registrar visita sin contacto', passed, details: `Result: ${visitNoContact.result}` });
    } catch (e: any) {
      testsResults.push({ id: 20, name: 'Registrar visita sin contacto', passed: false, details: e.message });
    }

    // 21. Actualizar riesgo
    try {
      const riskRes = await ClientService.updateRisk(testClientId, 'MEDIUM', 'Atraso menor en pago', adminContext);
      const passed = riskRes.client.riskLevel === 'MEDIUM';
      testsResults.push({ id: 21, name: 'Actualizar riesgo', passed, details: `New Risk: ${riskRes.client.riskLevel}` });
    } catch (e: any) {
      testsResults.push({ id: 21, name: 'Actualizar riesgo', passed: false, details: e.message });
    }

    // 22. Guardar historial de riesgo
    try {
      const c360 = await ClientService.getClient360(testClientId, adminContext);
      const riskHistory = c360.riskHistory;
      const passed = riskHistory.length > 0 && riskHistory[0].newLevel === 'MEDIUM';
      testsResults.push({ id: 22, name: 'Guardar historial de riesgo', passed, details: `Entries: ${riskHistory.length}` });
    } catch (e: any) {
      testsResults.push({ id: 22, name: 'Guardar historial de riesgo', passed: false, details: e.message });
    }

    // 23. Crear renovación
    try {
      const renewal = await ClientService.createRenewal(
        testClientId,
        { notes: 'Cliente califica para renovación de $5,000' },
        adminContext
      );
      const passed = renewal.status === 'PENDING' && renewal.clientId === testClientId;
      testsResults.push({ id: 23, name: 'Crear renovación', passed, details: `Renewal ID: ${renewal.id}` });
    } catch (e: any) {
      testsResults.push({ id: 23, name: 'Crear renovación', passed: false, details: e.message });
    }

    // 24. Validar que renovación NO genere venta
    try {
      const c360 = await ClientService.getClient360(testClientId, adminContext);
      const salesCount = c360.sales.length;
      const passed = salesCount === 0;
      testsResults.push({ id: 24, name: 'Validar que renovación NO genere venta', passed, details: `Ventas generadas: ${salesCount}` });
    } catch (e: any) {
      testsResults.push({ id: 24, name: 'Validar que renovación NO genere venta', passed: false, details: e.message });
    }

    // 25. Generar timeline
    try {
      const timeline = await ClientService.getTimeline(testClientId, adminContext);
      const passed = timeline.length >= 5;
      testsResults.push({ id: 25, name: 'Generar timeline', passed, details: `Eventos en timeline: ${timeline.length}` });
    } catch (e: any) {
      testsResults.push({ id: 25, name: 'Generar timeline', passed: false, details: e.message });
    }

    // 26. Consultar CRM 360
    try {
      const c360 = await ClientService.getClient360(testClientId, adminContext);
      const passed =
        !!c360.id &&
        c360.addresses.length > 0 &&
        c360.references.length > 0 &&
        c360.media.length > 0 &&
        c360.timeline.length > 0;
      testsResults.push({ id: 26, name: 'Consultar CRM 360', passed, details: `Client ID: ${c360.id}` });
    } catch (e: any) {
      testsResults.push({ id: 26, name: 'Consultar CRM 360', passed: false, details: e.message });
    }

    // 27. Consultar historial de compras
    try {
      const purchases = await ClientService.getPurchaseHistory(testClientId, adminContext);
      const passed = Array.isArray(purchases);
      testsResults.push({ id: 27, name: 'Consultar historial de compras', passed, details: `Total compras: ${purchases.length}` });
    } catch (e: any) {
      testsResults.push({ id: 27, name: 'Consultar historial de compras', passed: false, details: e.message });
    }

    // 28. Consultar historial de pagos
    try {
      const payments = await ClientService.getPaymentHistory(testClientId, adminContext);
      const passed = Array.isArray(payments);
      testsResults.push({ id: 28, name: 'Consultar historial de pagos', passed, details: `Total pagos: ${payments.length}` });
    } catch (e: any) {
      testsResults.push({ id: 28, name: 'Consultar historial de pagos', passed: false, details: e.message });
    }

    // 29. Validar ABAC por zona/ruta
    try {
      let blockedAccess = false;
      try {
        await ClientService.getClientById(testClientId, vendedoraBContext);
      } catch (err: any) {
        blockedAccess = err.message.includes('FORBIDDEN');
      }
      testsResults.push({ id: 29, name: 'Validar ABAC por zona/ruta', passed: blockedAccess, details: blockedAccess ? 'Acceso denegado correctamente 403' : 'No se bloqueó' });
    } catch (e: any) {
      testsResults.push({ id: 29, name: 'Validar ABAC por zona/ruta', passed: false, details: e.message });
    }

    // 30. Validar auditoría e idempotencia
    try {
      const idempotencyKey = `p4_test_idempotency_${Date.now()}`;
      const client1 = await ClientService.createClient(
        {
          firstName: 'Roberto',
          lastName: 'Sánchez',
          phone: '5557778899',
          idempotencyKey,
        },
        adminContext
      );
      const client2 = await ClientService.createClient(
        {
          firstName: 'Roberto',
          lastName: 'Sánchez',
          phone: '5557778899',
          idempotencyKey,
        },
        adminContext
      );
      const logs = AuditLogService.getLogs();
      const auditLogCount = logs.filter((l) => l.entity === 'Client').length;
      const passed = client1.id === client2.id && auditLogCount > 0;
      testsResults.push({ id: 30, name: 'Validar auditoría e idempotencia', passed, details: `Mismo ID en duplicado: ${client1.id === client2.id}` });
    } catch (e: any) {
      testsResults.push({ id: 30, name: 'Validar auditoría e idempotencia', passed: false, details: e.message });
    }

    const passedCount = testsResults.filter((t) => t.passed).length;
    const allPassed = passedCount === testsResults.length;

    return {
      success: true,
      allPassed,
      totalTests: testsResults.length,
      passedCount,
      tests: testsResults,
    };
  } catch (globalErr: any) {
    return {
      success: false,
      error: globalErr.message,
      tests: testsResults,
    };
  }
}

export async function GET() {
  const res = await runPhase4Tests();
  return NextResponse.json(res, { status: res.success ? 200 : 500 });
}
