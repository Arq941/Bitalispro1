import { prisma } from '@/src/database/prisma.service';

export interface ResolveConflictInput {
  conflictId: string;
  supervisorId: string;
  resolution: 'FORCE_SYNC' | 'REJECT' | 'REVIEW';
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class ConflictResolverService {
  /**
   * List all sync conflicts with optional filtering
   */
  public static async listConflicts(filters?: {
    status?: 'PENDING' | 'RESOLVED' | 'ALL';
    conflictType?: string;
    severity?: string;
  }) {
    const where: any = {};

    if (filters?.status === 'PENDING') {
      where.resolvedAt = null;
    } else if (filters?.status === 'RESOLVED') {
      where.resolvedAt = { not: null };
    }

    if (filters?.conflictType) {
      where.conflictType = filters.conflictType;
    }

    if (filters?.severity) {
      where.severity = filters.severity;
    }

    return await prisma.syncConflict.findMany({
      where,
      include: {
        syncOperation: true,
      },
      orderBy: {
        detectedAt: 'desc',
      },
    });
  }

  /**
   * Get conflict by ID
   */
  public static async getConflictById(id: string) {
    return await prisma.syncConflict.findUnique({
      where: { id },
      include: {
        syncOperation: true,
      },
    });
  }

  /**
   * Resolve a sync conflict with immutable AuditLog
   */
  public static async resolveConflict(input: ResolveConflictInput) {
    const conflict = await prisma.syncConflict.findUnique({
      where: { id: input.conflictId },
      include: { syncOperation: true },
    });

    if (!conflict) {
      throw new Error(`Conflicto de sincronización ${input.conflictId} no encontrado`);
    }

    const now = new Date();

    return await prisma.$transaction(async (tx) => {
      // 1. Update SyncConflict
      const updatedConflict = await tx.syncConflict.update({
        where: { id: input.conflictId },
        data: {
          resolvedAt: now,
          resolvedBy: input.supervisorId,
          resolution: input.resolution,
          resolutionNotes: input.notes || 'Conflicto resuelto por supervisión',
        },
      });

      // 2. Update linked SyncOperation if exists
      if (conflict.syncOperationId) {
        let newStatus = 'CONFLICT';
        if (input.resolution === 'FORCE_SYNC') {
          newStatus = 'SYNCED';
        } else if (input.resolution === 'REJECT') {
          newStatus = 'REJECTED';
        }

        await tx.syncOperation.update({
          where: { id: conflict.syncOperationId },
          data: {
            status: newStatus,
            errorMessage: input.notes || `Conflicto resuelto como ${input.resolution}`,
          },
        });
      }

      // 3. Create immutable AuditLog
      await tx.auditLog.create({
        data: {
          userId: input.supervisorId,
          action: 'OFFLINE_CONFLICT_RESOLVED',
          entity: 'SyncConflict',
          entityId: input.conflictId,
          ipAddress: input.ipAddress || null,
          userAgent: input.userAgent || null,
          oldValues: JSON.stringify({
            conflictType: conflict.conflictType,
            severity: conflict.severity,
            resolvedAt: conflict.resolvedAt,
          }),
          newValues: JSON.stringify({
            resolution: input.resolution,
            resolvedBy: input.supervisorId,
            resolvedAt: now,
            notes: input.notes,
          }),
        },
      });

      return updatedConflict;
    });
  }
}
