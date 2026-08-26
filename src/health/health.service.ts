import {PrismaService} from '@/src/database/prisma.service';

export class HealthService {
  private static async database(){
    try{await PrismaService.getInstance().$queryRawUnsafe('SELECT 1');return'connected' as const;}
    catch{return'unavailable' as const;}
  }

  public static async getHealth() {
    const database=await this.database();
    return {
      status: database==='connected'?'ok':'degraded',
      environment: process.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString(),
      database,
      storage: process.env.MEDIA_STORAGE_PATH?'configured':'local',
    };
  }

  public static getLive() {
    return {
      status: 'live',
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  public static async getReady() {
    const database=await this.database();
    return {
      status: database==='connected'?'ready':'not_ready',
      database,
      timestamp: new Date().toISOString(),
    };
  }
}
