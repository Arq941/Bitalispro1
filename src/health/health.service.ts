export class HealthService {
  public static getHealth() {
    return {
      status: 'ok',
      environment: process.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString(),
      database: 'connected',
      storage: 'available',
    };
  }

  public static getLive() {
    return {
      status: 'live',
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  public static getReady() {
    return {
      status: 'ready',
      database: 'connected',
      supabase: 'available',
      timestamp: new Date().toISOString(),
    };
  }
}
