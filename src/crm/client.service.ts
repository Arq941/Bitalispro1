import { PrismaService } from "@/src/database/prisma.service";
import { AuditLogService } from "@/src/audit/audit-log.service";
import { IdempotencyService } from "@/src/idempotency/idempotency.service";
import { MediaStorageService } from "./media-storage.service";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ClientStatus =
  | "PROSPECT"
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "BLOCKED";

export interface ClientUserContext {
  userId: string;
  role: "ADMIN" | "SUPERVISORA" | "VENDEDORA" | "COBRADOR";
  zoneId?: string;
  assignedRouteId?: string;
  /** Capacidad interna y efímera usada solo por el alta rápida en una petición. */
  intakeOnly?: boolean;
  permissions?: string[];
}

export interface CreateClientDTO {
  firstName: string;
  lastName: string;
  secondLastName?: string;
  phone: string;
  secondaryPhone?: string;
  email?: string;
  dateOfBirth?: string;
  occupation?: string;
  customerType?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  assignedSellerId?: string;
  assignedCollectorId?: string;
  zoneId?: string;
  idempotencyKey?: string;
  clientCapturedAt?: string;
}

class InStore {
  static clients: Map<string, any> = new Map();
  static addresses: Map<string, any> = new Map();
  static references: Map<string, any> = new Map();
  static profiles: Map<string, any> = new Map();
  static media: Map<string, any> = new Map();
  static timeline: any[] = [];
  static riskHistory: any[] = [];
  static notes: Map<string, any> = new Map();
  static visits: Map<string, any> = new Map();
  static renewals: Map<string, any> = new Map();

  static clear() {
    this.clients.clear();
    this.addresses.clear();
    this.references.clear();
    this.profiles.clear();
    this.media.clear();
    this.timeline = [];
    this.riskHistory = [];
    this.notes.clear();
    this.visits.clear();
    this.renewals.clear();
  }
}

export class ClientService {
  private static failClosedInProduction(error: unknown) {
    if (process.env.NODE_ENV === "production") throw error;
  }

  public static clearMemoryStore() {
    InStore.clear();
  }

  private static validateGps(latitude?: number, longitude?: number) {
    if (latitude !== undefined && latitude !== null) {
      if (latitude < -90 || latitude > 90) {
        throw new Error(
          "Coordenada GPS inválida: la latitud debe estar entre -90 y 90.",
        );
      }
    }
    if (longitude !== undefined && longitude !== null) {
      if (longitude < -180 || longitude > 180) {
        throw new Error(
          "Coordenada GPS inválida: la longitud debe estar entre -180 y 180.",
        );
      }
    }
  }

  /**
   * Generación segura y concurrente de Folio de Cliente CLI-YYYY-XXXX
   */
  public static async generateClientNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `CLI-${currentYear}-`;

    try {
      const prisma = PrismaService.getInstance();
      const lastClient = await prisma.client.findFirst({
        where: { clientNumber: { startsWith: prefix } },
        orderBy: { clientNumber: "desc" },
        select: { clientNumber: true },
      });

      let nextSequence = 1;
      if (lastClient && lastClient.clientNumber) {
        const parts = lastClient.clientNumber.split("-");
        if (parts.length === 3) {
          const num = parseInt(parts[2], 10);
          if (!isNaN(num)) nextSequence = num + 1;
        }
      }
      return `${prefix}${nextSequence.toString().padStart(4, "0")}`;
    } catch (error) {
      this.failClosedInProduction(error);
      // In-memory fallback
      const existingFolios = Array.from(InStore.clients.values())
        .map((c) => c.clientNumber)
        .filter((fn) => fn && fn.startsWith(prefix));

      let nextSequence = 1;
      if (existingFolios.length > 0) {
        existingFolios.sort().reverse();
        const parts = existingFolios[0].split("-");
        if (parts.length === 3) {
          const num = parseInt(parts[2], 10);
          if (!isNaN(num)) nextSequence = num + 1;
        }
      }
      return `${prefix}${nextSequence.toString().padStart(4, "0")}`;
    }
  }

  /**
   * Verificar acceso ABAC al cliente por Zona/Vendedora/Cobrador
   */
  public static async checkClientAccess(
    clientId: string,
    context: ClientUserContext,
  ): Promise<boolean> {
    if (context.role === "ADMIN" || context.role === "SUPERVISORA") {
      return true;
    }

    let client: any = null;
    try {
      const prisma = PrismaService.getInstance();
      client = await prisma.client.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          assignedSellerId: true,
          assignedCollectorId: true,
          zoneId: true,
          createdBy: true,
          customerType: true,
          status: true,
        },
      });
    } catch (error) {
      this.failClosedInProduction(error);
      client = InStore.clients.get(clientId);
    }

    if (!client) return false;

    if (
      context.intakeOnly === true &&
      client.createdBy === context.userId &&
      client.customerType === "PENDING_SUPERVISOR" &&
      client.status === "PROSPECT"
    )
      return true;

    // Captura ciega: después de enviar el alta la vendedora no puede volver a
    // leer, buscar, editar ni enriquecer ningún expediente, incluso si lo creó.
    if (context.role === 'VENDEDORA') {
      return false;
    }

    if (context.role === "COBRADOR") {
      if (client.assignedCollectorId === context.userId) return true;
      if (context.assignedRouteId && client.zoneId === context.assignedRouteId)
        return true;
      return false;
    }

    return true;
  }

  /**
   * Crear Prospecto / Cliente
   */
  public static async createClient(
    data: CreateClientDTO,
    userContext: ClientUserContext,
  ) {
    if (data.idempotencyKey) {
      const result = await IdempotencyService.executeIdempotent(
        data.idempotencyKey,
        "/api/clients",
        async () => this._performCreateClient(data, userContext),
      );
      return result.data;
    }
    return this._performCreateClient(data, userContext);
  }

  private static async _performCreateClient(
    data: CreateClientDTO,
    userContext: ClientUserContext,
  ) {
    this.validateGps(data.latitude, data.longitude);

    const clientNumber = await this.generateClientNumber();
    const id = `cli_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const clientData: any = {
      id,
      clientNumber,
      firstName: data.firstName,
      lastName: data.lastName,
      secondLastName: data.secondLastName || null,
      phone: data.phone,
      secondaryPhone: data.secondaryPhone || null,
      email: data.email || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      occupation: data.occupation || null,
      customerType: data.customerType || "NEW",
      status: "PROSPECT",
      riskLevel: "LOW",
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      locationAccuracy: data.locationAccuracy ?? null,
      locationCapturedAt: data.latitude !== undefined ? new Date() : null,
      createdBy: userContext.userId,
      assignedSellerId: data.assignedSellerId || userContext.userId,
      assignedCollectorId: data.assignedCollectorId || null,
      zoneId: data.zoneId || userContext.zoneId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let created: any = null;
    try {
      const prisma = PrismaService.getInstance();
      created = await prisma.client.create({ data: clientData });
      await prisma.clientTimeline.create({
        data: {
          clientId: created.id,
          eventType: "CLIENT_CREATED",
          entityType: "Client",
          entityId: created.id,
          description: `Cliente creado con folio ${created.clientNumber}`,
          userId: userContext.userId,
          latitude: data.latitude,
          longitude: data.longitude,
        },
      });
    } catch (error) {
      this.failClosedInProduction(error);
      // In-memory fallback
      created = clientData;
      InStore.clients.set(created.id, created);
      InStore.timeline.push({
        id: `tl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        clientId: created.id,
        eventType: "CLIENT_CREATED",
        entityType: "Client",
        entityId: created.id,
        description: `Cliente creado con folio ${created.clientNumber}`,
        userId: userContext.userId,
        latitude: data.latitude,
        longitude: data.longitude,
        createdAt: new Date(),
      });
    }

    AuditLogService.log({
      userId: userContext.userId,
      action: "CLIENT_CREATED",
      entity: "Client",
      entityId: created.id,
      newValues: JSON.stringify({
        clientNumber: created.clientNumber,
        status: created.status,
      }),
      idempotencyKey: data.idempotencyKey,
    });

    return created;
  }

  /**
   * Listar clientes con paginación y ABAC
   */
  public static async getClients(
    query: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      riskLevel?: string;
      customerType?: string;
      zoneId?: string;
      assignedSellerId?: string;
      assignedCollectorId?: string;
    },
    userContext: ClientUserContext,
  ) {
    if (userContext.role === "VENDEDORA") {
      throw new Error(
        "FORBIDDEN: El rol de vendedora solo puede enviar altas rápidas a supervisión.",
      );
    }
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    try {
      const prisma = PrismaService.getInstance();
      const where: any = {};

      if (query.search) {
        where.OR = [
          { clientNumber: { contains: query.search, mode: "insensitive" } },
          { firstName: { contains: query.search, mode: "insensitive" } },
          { lastName: { contains: query.search, mode: "insensitive" } },
          { phone: { contains: query.search } },
          { email: { contains: query.search, mode: "insensitive" } },
        ];
      }

      if (query.status) where.status = query.status as ClientStatus;
      if (query.riskLevel) where.riskLevel = query.riskLevel as RiskLevel;
      if (query.customerType) where.customerType = query.customerType;
      if (query.zoneId) where.zoneId = query.zoneId;
      if (query.assignedSellerId)
        where.assignedSellerId = query.assignedSellerId;
      if (query.assignedCollectorId)
        where.assignedCollectorId = query.assignedCollectorId;

      if (userContext.role === "COBRADOR") {
        where.OR = [
          { assignedCollectorId: userContext.userId },
          ...(userContext.assignedRouteId
            ? [{ zoneId: userContext.assignedRouteId }]
            : []),
        ];
      }

      const [total, data] = await Promise.all([
        prisma.client.count({ where }),
        prisma.client.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
      ]);

      return {
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.failClosedInProduction(error);
      // In-memory fallback
      let list = Array.from(InStore.clients.values());

      if (userContext.role === "COBRADOR") {
        list = list.filter(
          (c) =>
            c.assignedCollectorId === userContext.userId ||
            (userContext.assignedRouteId &&
              c.zoneId === userContext.assignedRouteId),
        );
      }

      if (query.search) {
        const s = query.search.toLowerCase();
        list = list.filter((c) =>
          (
            c.firstName +
            " " +
            c.lastName +
            " " +
            c.clientNumber +
            " " +
            c.phone
          )
            .toLowerCase()
            .includes(s),
        );
      }

      const total = list.length;
      const data = list.slice(skip, skip + limit);

      return {
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  }

  /**
   * Obtener cliente por ID
   */
  public static async getClientById(
    id: string,
    userContext: ClientUserContext,
  ) {
    const hasAccess = await this.checkClientAccess(id, userContext);
    if (!hasAccess) {
      throw new Error(
        "FORBIDDEN: No tienes acceso a los datos de este cliente en tu zona o asignación.",
      );
    }

    try {
      const prisma = PrismaService.getInstance();
      const client = await prisma.client.findUnique({
        where: { id },
        include: {
          addresses: { orderBy: { createdAt: "desc" } },
          references: true,
          profile: true,
          media: { orderBy: { createdAt: "desc" } },
        },
      });

      if (client) return client;
    } catch (error) {
      this.failClosedInProduction(error);
      // Fallback
    }

    const client = InStore.clients.get(id);
    if (!client) throw new Error("Cliente no encontrado.");

    const addresses = Array.from(InStore.addresses.values()).filter(
      (a) => a.clientId === id,
    );
    const references = Array.from(InStore.references.values()).filter(
      (r) => r.clientId === id,
    );
    const profile = InStore.profiles.get(id) || null;
    const media = Array.from(InStore.media.values()).filter(
      (m) => m.clientId === id,
    );

    return { ...client, addresses, references, profile, media };
  }

  /**
   * Obtener Vista CRM CLIENTE 360 Consolidada
   */
  public static async getClient360(id: string, userContext: ClientUserContext) {
    const hasAccess = await this.checkClientAccess(id, userContext);
    if (!hasAccess) {
      throw new Error(
        "FORBIDDEN: No tienes acceso a la vista 360 de este cliente.",
      );
    }

    try {
      const prisma = PrismaService.getInstance();
      const client = await prisma.client.findUnique({
        where: { id },
        include: {
          addresses: { orderBy: { createdAt: "desc" } },
          references: true,
          profile: true,
          media: { orderBy: { createdAt: "desc" } },
          notes: {
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" },
          },
          visits: { orderBy: { capturedAt: "desc" } },
          timeline: { orderBy: { createdAt: "desc" }, take: 50 },
          riskHistory: { orderBy: { createdAt: "desc" } },
          renewals: { orderBy: { createdAt: "desc" } },
          sales: {
            include: { items: { include: { product: true } } },
            orderBy: { createdAt: "desc" },
          },
          credits: {
            include: {
              payments: { orderBy: { clientCapturedAt: "desc" } },
              schedules: { orderBy: { installmentNumber: "asc" } },
              sale: { include: { items: { include: { product: true } } } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });
      if (client) return client;
    } catch (error) {
      this.failClosedInProduction(error);
      // Fallback
    }

    const client = InStore.clients.get(id);
    if (!client) throw new Error("Cliente no encontrado.");

    const addresses = Array.from(InStore.addresses.values()).filter(
      (a) => a.clientId === id,
    );
    const references = Array.from(InStore.references.values()).filter(
      (r) => r.clientId === id,
    );
    const profile = InStore.profiles.get(id) || null;
    const media = Array.from(InStore.media.values()).filter(
      (m) => m.clientId === id,
    );
    const notes = Array.from(InStore.notes.values()).filter(
      (n) => n.clientId === id && !n.isDeleted,
    );
    const visits = Array.from(InStore.visits.values()).filter(
      (v) => v.clientId === id,
    );
    const timeline = InStore.timeline
      .filter((t) => t.clientId === id)
      .reverse();
    const riskHistory = InStore.riskHistory
      .filter((r) => r.clientId === id)
      .reverse();
    const renewals = Array.from(InStore.renewals.values()).filter(
      (rn) => rn.clientId === id,
    );

    return {
      ...client,
      addresses,
      references,
      profile,
      media,
      notes,
      visits,
      timeline,
      riskHistory,
      renewals,
      sales: [],
      credits: [],
    };
  }

  /**
   * Modificar Cliente
   */
  public static async updateClient(
    id: string,
    data: any,
    userContext: ClientUserContext,
  ) {
    const hasAccess = await this.checkClientAccess(id, userContext);
    if (!hasAccess) {
      throw new Error(
        "FORBIDDEN: No tienes acceso para modificar este cliente.",
      );
    }

    if (data.latitude !== undefined || data.longitude !== undefined) {
      this.validateGps(data.latitude, data.longitude);
    }

    let oldClient: any = null;
    let updated: any = null;

    try {
      const prisma = PrismaService.getInstance();
      oldClient = await prisma.client.findUnique({ where: { id } });
      if (!oldClient) throw new Error("Cliente no encontrado.");

      updated = await prisma.client.update({
        where: { id },
        data: {
          firstName: data.firstName ?? oldClient.firstName,
          lastName: data.lastName ?? oldClient.lastName,
          secondLastName: data.secondLastName ?? oldClient.secondLastName,
          phone: data.phone ?? oldClient.phone,
          secondaryPhone: data.secondaryPhone ?? oldClient.secondaryPhone,
          email: data.email ?? oldClient.email,
          occupation: data.occupation ?? oldClient.occupation,
          status: data.status
            ? (data.status as ClientStatus)
            : oldClient.status,
          customerType: data.customerType ?? oldClient.customerType,
          latitude: data.latitude ?? oldClient.latitude,
          longitude: data.longitude ?? oldClient.longitude,
          locationAccuracy: data.locationAccuracy ?? oldClient.locationAccuracy,
          assignedSellerId: data.assignedSellerId ?? oldClient.assignedSellerId,
          assignedCollectorId:
            data.assignedCollectorId ?? oldClient.assignedCollectorId,
          zoneId: data.zoneId ?? oldClient.zoneId,
        },
      });
    } catch (error) {
      this.failClosedInProduction(error);
      oldClient = InStore.clients.get(id);
      if (!oldClient) throw new Error("Cliente no encontrado.");

      updated = {
        ...oldClient,
        ...data,
        updatedAt: new Date(),
      };
      InStore.clients.set(id, updated);
    }

    AuditLogService.log({
      userId: userContext.userId,
      action: "CLIENT_UPDATED",
      entity: "Client",
      entityId: id,
      oldValues: JSON.stringify(oldClient),
      newValues: JSON.stringify(updated),
    });

    return updated;
  }

  /**
   * Agregar Domicilio con Historial Inmutable
   */
  public static async addAddress(
    clientId: string,
    data: any,
    userContext: ClientUserContext,
  ) {
    const hasAccess = await this.checkClientAccess(clientId, userContext);
    if (!hasAccess) {
      throw new Error("FORBIDDEN: No tienes permiso sobre este cliente.");
    }

    this.validateGps(data.latitude, data.longitude);

    const addressId = `addr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const addressObj = {
      id: addressId,
      clientId,
      addressType: data.addressType || "HOME",
      street: data.street,
      exteriorNumber: data.exteriorNumber,
      interiorNumber: data.interiorNumber || null,
      neighborhood: data.neighborhood,
      postalCode: data.postalCode,
      city: data.city,
      municipality: data.municipality || null,
      state: data.state,
      country: data.country || "MEXICO",
      references: data.references || null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      accuracy: data.accuracy ?? null,
      isPrimary: data.isPrimary ?? true,
      validFrom: new Date(),
      validUntil: null,
      createdBy: userContext.userId,
      createdAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      return await prisma.$transaction(async (tx) => {
        if (data.isPrimary) {
          await tx.clientAddress.updateMany({
            where: { clientId, isPrimary: true, validUntil: null },
            data: { isPrimary: false, validUntil: new Date() },
          });
        }

        const newAddress = await tx.clientAddress.create({
          data: addressObj as any,
        });

        await tx.clientTimeline.create({
          data: {
            clientId,
            eventType: "ADDRESS_CHANGED",
            entityType: "ClientAddress",
            entityId: newAddress.id,
            description: `Nuevo domicilio registrado: ${newAddress.street} #${newAddress.exteriorNumber}, ${newAddress.neighborhood}`,
            userId: userContext.userId,
            latitude: data.latitude,
            longitude: data.longitude,
          },
        });

        return newAddress;
      });
    } catch (error) {
      this.failClosedInProduction(error);
      // In-memory fallback
      if (data.isPrimary) {
        InStore.addresses.forEach((a) => {
          if (a.clientId === clientId && a.isPrimary && a.validUntil === null) {
            a.isPrimary = false;
            a.validUntil = new Date();
          }
        });
      }

      InStore.addresses.set(addressId, addressObj);
      InStore.timeline.push({
        id: `tl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        clientId,
        eventType: "ADDRESS_CHANGED",
        entityType: "ClientAddress",
        entityId: addressId,
        description: `Nuevo domicilio registrado: ${addressObj.street} #${addressObj.exteriorNumber}, ${addressObj.neighborhood}`,
        userId: userContext.userId,
        latitude: data.latitude,
        longitude: data.longitude,
        createdAt: new Date(),
      });

      AuditLogService.log({
        userId: userContext.userId,
        action: "ADDRESS_CREATED",
        entity: "ClientAddress",
        entityId: addressId,
        newValues: JSON.stringify(addressObj),
      });

      return addressObj;
    }
  }

  /**
   * Agregar Referencia del Cliente
   */
  public static async addReference(
    clientId: string,
    data: any,
    userContext: ClientUserContext,
  ) {
    const hasAccess = await this.checkClientAccess(clientId, userContext);
    if (!hasAccess) {
      throw new Error("FORBIDDEN: No tienes permiso sobre este cliente.");
    }

    const refId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const refObj = {
      id: refId,
      clientId,
      name: data.name,
      relationship: data.relationship,
      phone: data.phone,
      secondaryPhone: data.secondaryPhone || null,
      address: data.address || null,
      occupation: data.occupation || null,
      referenceType: data.referenceType || "PERSONAL",
      notes: data.notes || null,
      createdBy: userContext.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      const reference = await prisma.clientReference.create({ data: refObj });
      AuditLogService.log({
        userId: userContext.userId,
        action: "REFERENCE_CREATED",
        entity: "ClientReference",
        entityId: reference.id,
        newValues: JSON.stringify(reference),
      });
      return reference;
    } catch (error) {
      this.failClosedInProduction(error);
      InStore.references.set(refId, refObj);
      AuditLogService.log({
        userId: userContext.userId,
        action: "REFERENCE_CREATED",
        entity: "ClientReference",
        entityId: refId,
        newValues: JSON.stringify(refObj),
      });
      return refObj;
    }
  }

  /**
   * Crear o actualizar Perfil Comercial
   */
  public static async upsertProfile(
    clientId: string,
    data: any,
    userContext: ClientUserContext,
  ) {
    const hasAccess = await this.checkClientAccess(clientId, userContext);
    if (!hasAccess) {
      throw new Error("FORBIDDEN: No tienes permiso sobre este cliente.");
    }

    const profileId = `prof_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const profileObj = {
      id: profileId,
      clientId,
      occupation: data.occupation || null,
      businessActivity: data.businessActivity || null,
      paymentPreference: data.paymentPreference || null,
      preferredCollectionDay: data.preferredCollectionDay || null,
      preferredPaymentMethod: data.preferredPaymentMethod || null,
      incomeRange: data.incomeRange || null,
      customerSince: data.customerSince
        ? new Date(data.customerSince)
        : new Date(),
      salesNotes: data.salesNotes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      const profile = await prisma.clientProfile.upsert({
        where: { clientId },
        create: profileObj,
        update: {
          occupation: data.occupation,
          businessActivity: data.businessActivity,
          paymentPreference: data.paymentPreference,
          preferredCollectionDay: data.preferredCollectionDay,
          preferredPaymentMethod: data.preferredPaymentMethod,
          incomeRange: data.incomeRange,
          salesNotes: data.salesNotes,
        },
      });
      AuditLogService.log({
        userId: userContext.userId,
        action: "PROFILE_UPDATED",
        entity: "ClientProfile",
        entityId: profile.id,
        newValues: JSON.stringify(profile),
      });
      return profile;
    } catch (error) {
      this.failClosedInProduction(error);
      InStore.profiles.set(clientId, profileObj);
      AuditLogService.log({
        userId: userContext.userId,
        action: "PROFILE_UPDATED",
        entity: "ClientProfile",
        entityId: profileObj.id,
        newValues: JSON.stringify(profileObj),
      });
      return profileObj;
    }
  }

  /**
   * Subir Evidencia
   */
  public static async uploadMedia(
    clientId: string,
    data: any,
    userContext: ClientUserContext,
  ) {
    const hasAccess = await this.checkClientAccess(clientId, userContext);
    if (!hasAccess) {
      throw new Error("FORBIDDEN: No tienes permiso sobre este cliente.");
    }

    this.validateGps(data.latitude, data.longitude);

    const processed = MediaStorageService.processMediaUpload({
      clientId,
      mediaType: data.mediaType || "OTHER",
      url: data.url,
      fileContent: data.fileContent,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
    });

    await MediaStorageService.persistDatabaseCopy(
      processed.storageKey,
      processed.mimeType,
      data.fileContent,
      processed.checksum,
    );

    const mediaId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const mediaObj = {
      id: mediaId,
      clientId,
      mediaType: data.mediaType,
      url: processed.url,
      storageKey: processed.storageKey,
      mimeType: processed.mimeType,
      fileSize: processed.fileSize,
      checksum: processed.checksum,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      capturedAt: data.latitude !== undefined ? new Date() : null,
      uploadedAt: new Date(),
      uploadedBy: userContext.userId,
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
      status: "PENDING_REVIEW",
      replacedMediaId: null,
      createdAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      const media = await prisma.$transaction(async (tx) => {
        const created = await tx.clientMedia.create({ data: mediaObj });
        await tx.clientTimeline.create({
          data: {
            clientId,
            eventType: "PHOTO_ADDED",
            entityType: "ClientMedia",
            entityId: created.id,
            description: `Evidencia agregada (${created.mediaType})`,
            userId: userContext.userId,
            latitude: data.latitude,
            longitude: data.longitude,
          },
        });
        return created;
      });
      AuditLogService.log({
        userId: userContext.userId,
        action: "MEDIA_UPLOADED",
        entity: "ClientMedia",
        entityId: media.id,
        newValues: JSON.stringify(media),
      });
      return media;
    } catch (error) {
      this.failClosedInProduction(error);
      InStore.media.set(mediaId, mediaObj);
      InStore.timeline.push({
        id: `tl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        clientId,
        eventType: "PHOTO_ADDED",
        entityType: "ClientMedia",
        entityId: mediaId,
        description: `Evidencia agregada (${mediaObj.mediaType})`,
        userId: userContext.userId,
        latitude: data.latitude,
        longitude: data.longitude,
        createdAt: new Date(),
      });
      AuditLogService.log({
        userId: userContext.userId,
        action: "MEDIA_UPLOADED",
        entity: "ClientMedia",
        entityId: mediaId,
        newValues: JSON.stringify(mediaObj),
      });
      return mediaObj;
    }
  }

  /**
   * Revisar Evidencia (Aprobar / Rechazar) - Solo Supervisora o Admin
   */
  public static async reviewMedia(
    mediaId: string,
    status: "APPROVED" | "REJECTED",
    comment: string | undefined,
    userContext: ClientUserContext,
  ) {
    if (userContext.role !== "SUPERVISORA" && userContext.role !== "ADMIN") {
      throw new Error(
        "FORBIDDEN: Solo Supervisora o Administrador pueden aprobar o rechazar evidencias.",
      );
    }

    let existing: any = null;
    let updated: any = null;

    try {
      const prisma = PrismaService.getInstance();
      existing = await prisma.clientMedia.findUnique({
        where: { id: mediaId },
      });
      if (!existing) throw new Error("Evidencia no encontrada.");

      updated = await prisma.clientMedia.update({
        where: { id: mediaId },
        data: {
          status,
          reviewedBy: userContext.userId,
          reviewedAt: new Date(),
          rejectionReason: status === "REJECTED" ? comment : null,
        },
      });
    } catch (error) {
      this.failClosedInProduction(error);
      existing = InStore.media.get(mediaId);
      if (!existing) throw new Error("Evidencia no encontrada.");

      updated = {
        ...existing,
        status,
        reviewedBy: userContext.userId,
        reviewedAt: new Date(),
        rejectionReason: status === "REJECTED" ? comment : null,
      };
      InStore.media.set(mediaId, updated);
    }

    AuditLogService.log({
      userId: userContext.userId,
      action: status === "APPROVED" ? "MEDIA_APPROVED" : "MEDIA_REJECTED",
      entity: "ClientMedia",
      entityId: mediaId,
      oldValues: JSON.stringify(existing),
      newValues: JSON.stringify(updated),
    });

    return updated;
  }

  /**
   * Reemplazar evidencia aprobada (No destructivo)
   */
  public static async replaceMedia(
    mediaId: string,
    newData: any,
    userContext: ClientUserContext,
  ) {
    let original: any = null;
    try {
      const prisma = PrismaService.getInstance();
      original = await prisma.clientMedia.findUnique({
        where: { id: mediaId },
      });
    } catch (error) {
      this.failClosedInProduction(error);
      original = InStore.media.get(mediaId);
    }

    if (!original) throw new Error("Evidencia original no encontrada.");

    this.validateGps(newData.latitude, newData.longitude);

    const processed = MediaStorageService.processMediaUpload({
      clientId: original.clientId,
      mediaType: original.mediaType,
      url: newData.url,
      fileContent: newData.fileContent,
    });

    await MediaStorageService.persistDatabaseCopy(
      processed.storageKey,
      processed.mimeType,
      newData.fileContent,
      processed.checksum,
    );

    const newMediaId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newMediaObj = {
      id: newMediaId,
      clientId: original.clientId,
      mediaType: original.mediaType,
      url: processed.url,
      storageKey: processed.storageKey,
      mimeType: processed.mimeType,
      fileSize: processed.fileSize,
      checksum: processed.checksum,
      latitude: newData.latitude ?? null,
      longitude: newData.longitude ?? null,
      capturedAt: newData.latitude !== undefined ? new Date() : null,
      uploadedAt: new Date(),
      uploadedBy: userContext.userId,
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
      status: "PENDING_REVIEW",
      replacedMediaId: mediaId,
      createdAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      const newMedia = await prisma.$transaction(async (tx) => {
        await tx.clientMedia.update({
          where: { id: mediaId },
          data: { status: "REPLACED" },
        });
        const created = await tx.clientMedia.create({ data: newMediaObj });
        await tx.clientTimeline.create({
          data: {
            clientId: original.clientId,
            eventType: "PHOTO_ADDED",
            entityType: "ClientMedia",
            entityId: created.id,
            description: `Evidencia reemplazada por nueva versión (${created.mediaType})`,
            userId: userContext.userId,
          },
        });
        return created;
      });
      AuditLogService.log({
        userId: userContext.userId,
        action: "MEDIA_REPLACED",
        entity: "ClientMedia",
        entityId: newMedia.id,
        oldValues: JSON.stringify(original),
        newValues: JSON.stringify(newMedia),
      });
      return newMedia;
    } catch (error) {
      this.failClosedInProduction(error);
      original.status = "REPLACED";
      InStore.media.set(mediaId, original);
      InStore.media.set(newMediaId, newMediaObj);
      InStore.timeline.push({
        id: `tl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        clientId: original.clientId,
        eventType: "PHOTO_ADDED",
        entityType: "ClientMedia",
        entityId: newMediaId,
        description: `Evidencia reemplazada por nueva versión (${newMediaObj.mediaType})`,
        userId: userContext.userId,
        createdAt: new Date(),
      });
      AuditLogService.log({
        userId: userContext.userId,
        action: "MEDIA_REPLACED",
        entity: "ClientMedia",
        entityId: newMediaId,
        oldValues: JSON.stringify(original),
        newValues: JSON.stringify(newMediaObj),
      });
      return newMediaObj;
    }
  }

  /**
   * Actualizar Nivel de Riesgo del Cliente
   */
  public static async updateRisk(
    clientId: string,
    newLevel: RiskLevel,
    reason: string,
    userContext: ClientUserContext,
  ) {
    const hasAccess = await this.checkClientAccess(clientId, userContext);
    if (!hasAccess) {
      throw new Error("FORBIDDEN: No tienes permiso sobre este cliente.");
    }

    let client: any = null;
    try {
      const prisma = PrismaService.getInstance();
      client = await prisma.client.findUnique({ where: { id: clientId } });
    } catch (error) {
      this.failClosedInProduction(error);
      client = InStore.clients.get(clientId);
    }

    if (!client) throw new Error("Cliente no encontrado.");

    const previousLevel = client.riskLevel;
    const riskId = `risk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const riskEntry = {
      id: riskId,
      clientId,
      previousLevel,
      newLevel,
      reason,
      userId: userContext.userId,
      createdAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      const result = await prisma.$transaction(async (tx) => {
        const updatedClient = await tx.client.update({
          where: { id: clientId },
          data: { riskLevel: newLevel },
        });

        const createdRisk = await tx.clientRiskHistory.create({
          data: riskEntry,
        });

        await tx.clientTimeline.create({
          data: {
            clientId,
            eventType: "RISK_CHANGED",
            entityType: "ClientRiskHistory",
            entityId: createdRisk.id,
            description: `Nivel de riesgo modificado de ${previousLevel} a ${newLevel}. Motivo: ${reason}`,
            userId: userContext.userId,
          },
        });

        return { client: updatedClient, riskEntry: createdRisk };
      });

      AuditLogService.log({
        userId: userContext.userId,
        action: "RISK_CHANGED",
        entity: "Client",
        entityId: clientId,
        oldValues: JSON.stringify({ riskLevel: previousLevel }),
        newValues: JSON.stringify({ riskLevel: newLevel, reason }),
      });

      return result;
    } catch (error) {
      this.failClosedInProduction(error);
      client.riskLevel = newLevel;
      InStore.clients.set(clientId, client);
      InStore.riskHistory.push(riskEntry);
      InStore.timeline.push({
        id: `tl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        clientId,
        eventType: "RISK_CHANGED",
        entityType: "ClientRiskHistory",
        entityId: riskId,
        description: `Nivel de riesgo modificado de ${previousLevel} a ${newLevel}. Motivo: ${reason}`,
        userId: userContext.userId,
        createdAt: new Date(),
      });

      AuditLogService.log({
        userId: userContext.userId,
        action: "RISK_CHANGED",
        entity: "Client",
        entityId: clientId,
        oldValues: JSON.stringify({ riskLevel: previousLevel }),
        newValues: JSON.stringify({ riskLevel: newLevel, reason }),
      });

      return { client, riskEntry };
    }
  }

  /**
   * Crear Nota CRM
   */
  public static async addNote(
    clientId: string,
    data: any,
    userContext: ClientUserContext,
  ) {
    const hasAccess = await this.checkClientAccess(clientId, userContext);
    if (!hasAccess) {
      throw new Error("FORBIDDEN: No tienes permiso sobre este cliente.");
    }

    const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const noteObj = {
      id: noteId,
      clientId,
      noteType: data.noteType || "GENERAL",
      content: data.content,
      userId: userContext.userId,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      const note = await prisma.$transaction(async (tx) => {
        const createdNote = await tx.clientNote.create({ data: noteObj });
        await tx.clientTimeline.create({
          data: {
            clientId,
            eventType: "NOTE_ADDED",
            entityType: "ClientNote",
            entityId: createdNote.id,
            description: `Nota agregada: ${createdNote.content.substring(0, 50)}...`,
            userId: userContext.userId,
          },
        });
        return createdNote;
      });

      AuditLogService.log({
        userId: userContext.userId,
        action: "NOTE_CREATED",
        entity: "ClientNote",
        entityId: note.id,
        newValues: JSON.stringify(note),
      });

      return note;
    } catch (error) {
      this.failClosedInProduction(error);
      InStore.notes.set(noteId, noteObj);
      InStore.timeline.push({
        id: `tl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        clientId,
        eventType: "NOTE_ADDED",
        entityType: "ClientNote",
        entityId: noteId,
        description: `Nota agregada: ${noteObj.content.substring(0, 50)}...`,
        userId: userContext.userId,
        createdAt: new Date(),
      });

      AuditLogService.log({
        userId: userContext.userId,
        action: "NOTE_CREATED",
        entity: "ClientNote",
        entityId: noteId,
        newValues: JSON.stringify(noteObj),
      });

      return noteObj;
    }
  }

  /**
   * Soft Delete de Nota CRM
   */
  public static async softDeleteNote(
    noteId: string,
    userContext: ClientUserContext,
  ) {
    let note: any = null;
    let deleted: any = null;

    try {
      const prisma = PrismaService.getInstance();
      note = await prisma.clientNote.findUnique({ where: { id: noteId } });
      if (!note) throw new Error("Nota no encontrada.");

      deleted = await prisma.clientNote.update({
        where: { id: noteId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userContext.userId,
        },
      });
    } catch (error) {
      this.failClosedInProduction(error);
      note = InStore.notes.get(noteId);
      if (!note) throw new Error("Nota no encontrada.");

      deleted = {
        ...note,
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userContext.userId,
      };
      InStore.notes.set(noteId, deleted);
    }

    AuditLogService.log({
      userId: userContext.userId,
      action: "NOTE_DELETED",
      entity: "ClientNote",
      entityId: noteId,
      oldValues: JSON.stringify({ isDeleted: false }),
      newValues: JSON.stringify({
        isDeleted: true,
        deletedBy: userContext.userId,
      }),
    });

    return deleted;
  }

  /**
   * Registrar Visita
   */
  public static async recordVisit(
    clientId: string,
    data: any,
    userContext: ClientUserContext,
  ) {
    const hasAccess = await this.checkClientAccess(clientId, userContext);
    if (!hasAccess) {
      throw new Error("FORBIDDEN: No tienes permiso sobre este cliente.");
    }

    this.validateGps(data.latitude, data.longitude);

    const visitId = `visit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const visitObj = {
      id: visitId,
      clientId,
      userId: userContext.userId,
      visitType: data.visitType || "FOLLOW_UP",
      result: data.result || "SUCCESS",
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      accuracy: data.accuracy ?? null,
      capturedAt: data.capturedAt ? new Date(data.capturedAt) : new Date(),
      notes: data.notes || null,
      nextVisitDate: data.nextVisitDate ? new Date(data.nextVisitDate) : null,
      createdAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      const visit = await prisma.$transaction(async (tx) => {
        const createdVisit = await tx.clientVisit.create({ data: visitObj });
        await tx.clientTimeline.create({
          data: {
            clientId,
            eventType: "VISIT_DONE",
            entityType: "ClientVisit",
            entityId: createdVisit.id,
            description: `Visita registrada (${createdVisit.visitType}) - Resultado: ${createdVisit.result}`,
            userId: userContext.userId,
            latitude: data.latitude,
            longitude: data.longitude,
          },
        });
        return createdVisit;
      });

      AuditLogService.log({
        userId: userContext.userId,
        action: "VISIT_CREATED",
        entity: "ClientVisit",
        entityId: visit.id,
        newValues: JSON.stringify(visit),
      });

      return visit;
    } catch (error) {
      this.failClosedInProduction(error);
      InStore.visits.set(visitId, visitObj);
      InStore.timeline.push({
        id: `tl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        clientId,
        eventType: "VISIT_DONE",
        entityType: "ClientVisit",
        entityId: visitId,
        description: `Visita registrada (${visitObj.visitType}) - Resultado: ${visitObj.result}`,
        userId: userContext.userId,
        latitude: data.latitude,
        longitude: data.longitude,
        createdAt: new Date(),
      });

      AuditLogService.log({
        userId: userContext.userId,
        action: "VISIT_CREATED",
        entity: "ClientVisit",
        entityId: visitId,
        newValues: JSON.stringify(visitObj),
      });

      return visitObj;
    }
  }

  /**
   * Crear Oportunidad de Renovación (NUNCA genera venta directa)
   */
  public static async createRenewal(
    clientId: string,
    data: any,
    userContext: ClientUserContext,
  ) {
    const hasAccess = await this.checkClientAccess(clientId, userContext);
    if (!hasAccess) {
      throw new Error("FORBIDDEN: No tienes permiso sobre este cliente.");
    }

    const renewalId = `ren_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const renewalObj = {
      id: renewalId,
      clientId,
      sourceCreditId: data.sourceCreditId || null,
      status: "PENDING",
      estimatedDate: data.estimatedDate ? new Date(data.estimatedDate) : null,
      assignedTo: data.assignedTo || userContext.userId,
      notes: data.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      const renewal = await prisma.$transaction(async (tx) => {
        const createdRenewal = await tx.clientRenewal.create({
          data: renewalObj,
        });
        await tx.clientTimeline.create({
          data: {
            clientId,
            eventType: "RENEWAL_CREATED",
            entityType: "ClientRenewal",
            entityId: createdRenewal.id,
            description: `Oportunidad de renovación comercial registrada`,
            userId: userContext.userId,
          },
        });
        return createdRenewal;
      });

      AuditLogService.log({
        userId: userContext.userId,
        action: "RENEWAL_CREATED",
        entity: "ClientRenewal",
        entityId: renewal.id,
        newValues: JSON.stringify(renewal),
      });

      return renewal;
    } catch (error) {
      this.failClosedInProduction(error);
      InStore.renewals.set(renewalId, renewalObj);
      InStore.timeline.push({
        id: `tl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        clientId,
        eventType: "RENEWAL_CREATED",
        entityType: "ClientRenewal",
        entityId: renewalId,
        description: `Oportunidad de renovación comercial registrada`,
        userId: userContext.userId,
        createdAt: new Date(),
      });

      AuditLogService.log({
        userId: userContext.userId,
        action: "RENEWAL_CREATED",
        entity: "ClientRenewal",
        entityId: renewalId,
        newValues: JSON.stringify(renewalObj),
      });

      return renewalObj;
    }
  }

  /**
   * Consultar Historial de Compras
   */
  public static async getPurchaseHistory(
    clientId: string,
    userContext: ClientUserContext,
  ) {
    const hasAccess = await this.checkClientAccess(clientId, userContext);
    if (!hasAccess) {
      throw new Error(
        "FORBIDDEN: No tienes acceso al historial de compras de este cliente.",
      );
    }

    try {
      const prisma = PrismaService.getInstance();
      return await prisma.sale.findMany({
        where: { clientId },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, sku: true, name: true, brand: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      this.failClosedInProduction(error);
      return [];
    }
  }

  /**
   * Consultar Historial de Pagos
   */
  public static async getPaymentHistory(
    clientId: string,
    userContext: ClientUserContext,
  ) {
    const hasAccess = await this.checkClientAccess(clientId, userContext);
    if (!hasAccess) {
      throw new Error(
        "FORBIDDEN: No tienes acceso al historial de pagos de este cliente.",
      );
    }

    try {
      const prisma = PrismaService.getInstance();
      const credits = await prisma.credit.findMany({
        where: { clientId },
        include: { payments: { orderBy: { createdAt: "desc" } } },
        orderBy: { createdAt: "desc" },
      });

      return credits.flatMap((c) =>
        c.payments.map((p) => ({
          ...p,
          creditId: c.id,
          principalAmount: c.principalAmount,
          saldoActual: c.saldoActual,
        })),
      );
    } catch (error) {
      this.failClosedInProduction(error);
      return [];
    }
  }

  /**
   * Consultar Timeline
   */
  public static async getTimeline(
    clientId: string,
    userContext: ClientUserContext,
  ) {
    const hasAccess = await this.checkClientAccess(clientId, userContext);
    if (!hasAccess) {
      throw new Error(
        "FORBIDDEN: No tienes acceso al timeline de este cliente.",
      );
    }

    try {
      const prisma = PrismaService.getInstance();
      return await prisma.clientTimeline.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      this.failClosedInProduction(error);
      return InStore.timeline.filter((t) => t.clientId === clientId).reverse();
    }
  }
}
