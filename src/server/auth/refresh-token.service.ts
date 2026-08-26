import crypto from 'crypto';
import { PrismaService } from '@/src/database/prisma.service';
import { SecurityService } from './security.service';

export interface ActiveSession {
  id:string;userId:string;deviceId?:string;deviceName?:string;ipAddress?:string;userAgent?:string;
  refreshTokenHash:string;expiresAt:Date;revokedAt?:Date|null;lastUsedAt:Date;createdAt:Date;
}
type SessionRow={id:string;user_id:string;device_id:string|null;device_name:string|null;ip_address:string|null;user_agent:string|null;refresh_token_hash:string;expires_at:Date;revoked_at:Date|null;last_used_at:Date;created_at:Date};

/** Sesiones persistentes compartidas por todos los procesos de Hostinger. */
export class RefreshTokenService {
  private static prisma=PrismaService.getInstance();
  private static tableReady:Promise<void>|null=null;
  private static isMySql(){return String(process.env.DATABASE_URL||'').startsWith('mysql:');}
  private static p(index:number){return this.isMySql()?'?':`$${index}`;}

  private static ensureTable(){
    if(this.tableReady)return this.tableReady;
    this.tableReady=(async()=>{
      if(this.isMySql())await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS auth_sessions (
        id VARCHAR(80) PRIMARY KEY,user_id VARCHAR(191) NOT NULL,device_id VARCHAR(191) NULL,
        device_name VARCHAR(191) NULL,ip_address VARCHAR(191) NULL,user_agent TEXT NULL,
        refresh_token_hash CHAR(64) NOT NULL UNIQUE,expires_at DATETIME(3) NOT NULL,
        revoked_at DATETIME(3) NULL,last_used_at DATETIME(3) NOT NULL,created_at DATETIME(3) NOT NULL,
        INDEX auth_sessions_user_id_idx (user_id),INDEX auth_sessions_expires_at_idx (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      else{
        await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS auth_sessions (
          id VARCHAR(80) PRIMARY KEY,user_id VARCHAR(191) NOT NULL,device_id VARCHAR(191),
          device_name VARCHAR(191),ip_address VARCHAR(191),user_agent TEXT,
          refresh_token_hash CHAR(64) NOT NULL UNIQUE,expires_at TIMESTAMP(3) NOT NULL,
          revoked_at TIMESTAMP(3),last_used_at TIMESTAMP(3) NOT NULL,created_at TIMESTAMP(3) NOT NULL)`);
        await this.prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions(user_id)');
        await this.prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions(expires_at)');
      }
    })().catch(error=>{this.tableReady=null;throw error;});
    return this.tableReady;
  }

  private static toSession(row:SessionRow):ActiveSession{return{id:row.id,userId:row.user_id,
    deviceId:row.device_id||undefined,deviceName:row.device_name||undefined,ipAddress:row.ip_address||undefined,
    userAgent:row.user_agent||undefined,refreshTokenHash:row.refresh_token_hash,expiresAt:new Date(row.expires_at),
    revokedAt:row.revoked_at?new Date(row.revoked_at):null,lastUsedAt:new Date(row.last_used_at),createdAt:new Date(row.created_at)};}

  private static async insertSession(params:{userId:string;refreshToken:string;deviceId?:string;deviceName?:string;ipAddress?:string;userAgent?:string;expiresInDays?:number}){
    await this.ensureTable();
    const session:ActiveSession={id:`sess_${crypto.randomUUID()}`,userId:params.userId,
      deviceId:params.deviceId||'default_device',deviceName:params.deviceName||'Web App',
      ipAddress:params.ipAddress||'127.0.0.1',userAgent:params.userAgent||'BITALIS_CLIENT',
      refreshTokenHash:SecurityService.hashRefreshToken(params.refreshToken),
      expiresAt:new Date(Date.now()+(params.expiresInDays||7)*86400000),revokedAt:null,lastUsedAt:new Date(),createdAt:new Date()};
    const values=Array.from({length:11},(_,i)=>this.p(i+1)).join(',');
    await this.prisma.$executeRawUnsafe(`INSERT INTO auth_sessions (id,user_id,device_id,device_name,ip_address,user_agent,refresh_token_hash,expires_at,revoked_at,last_used_at,created_at) VALUES (${values})`,
      session.id,session.userId,session.deviceId,session.deviceName,session.ipAddress,session.userAgent,session.refreshTokenHash,session.expiresAt,session.revokedAt,session.lastUsedAt,session.createdAt);
    return session;
  }

  static createSession(params:{userId:string;refreshToken:string;deviceId?:string;deviceName?:string;ipAddress?:string;userAgent?:string;expiresInDays?:number}){return this.insertSession(params);}

  static async validateAndRotate(params:{refreshToken:string;ipAddress?:string;userAgent?:string}){
    await this.ensureTable();const hash=SecurityService.hashRefreshToken(params.refreshToken);
    const rows=await this.prisma.$queryRawUnsafe<SessionRow[]>(`SELECT * FROM auth_sessions WHERE refresh_token_hash = ${this.p(1)} LIMIT 1`,hash);
    const row=rows[0];if(!row)return{valid:false as const};const found=this.toSession(row);
    if(found.revokedAt){await this.revokeAllUserSessions(found.userId);return{valid:false as const,reuseDetected:true,userId:found.userId};}
    if(found.expiresAt<=new Date()){await this.prisma.$executeRawUnsafe(`UPDATE auth_sessions SET revoked_at=${this.p(1)} WHERE id=${this.p(2)} AND revoked_at IS NULL`,new Date(),found.id);return{valid:false as const};}
    const now=new Date();const revoked=await this.prisma.$executeRawUnsafe(`UPDATE auth_sessions SET revoked_at=${this.p(1)},last_used_at=${this.p(2)} WHERE id=${this.p(3)} AND revoked_at IS NULL`,now,now,found.id);
    if(revoked!==1){await this.revokeAllUserSessions(found.userId);return{valid:false as const,reuseDetected:true,userId:found.userId};}
    const newRefreshToken=SecurityService.generateRefreshToken();
    const session=await this.insertSession({userId:found.userId,refreshToken:newRefreshToken,deviceId:found.deviceId,deviceName:found.deviceName,ipAddress:params.ipAddress||found.ipAddress,userAgent:params.userAgent||found.userAgent});
    return{valid:true as const,session,newRefreshToken};
  }

  static async revokeSession(sessionId:string){await this.ensureTable();return(await this.prisma.$executeRawUnsafe(`UPDATE auth_sessions SET revoked_at=${this.p(1)} WHERE id=${this.p(2)} AND revoked_at IS NULL`,new Date(),sessionId))>0;}
  static async revokeAllUserSessions(userId:string){await this.ensureTable();return this.prisma.$executeRawUnsafe(`UPDATE auth_sessions SET revoked_at=${this.p(1)} WHERE user_id=${this.p(2)} AND revoked_at IS NULL`,new Date(),userId);}
  static async getUserActiveSessions(userId:string){await this.ensureTable();const rows=await this.prisma.$queryRawUnsafe<SessionRow[]>(`SELECT * FROM auth_sessions WHERE user_id=${this.p(1)} AND revoked_at IS NULL AND expires_at>${this.p(2)} ORDER BY created_at DESC`,userId,new Date());return rows.map(row=>this.toSession(row));}
  static async isSessionActive(sessionId:string,userId:string){await this.ensureTable();const rows=await this.prisma.$queryRawUnsafe<Array<{active_count:bigint|number}>>(`SELECT COUNT(*) AS active_count FROM auth_sessions WHERE id=${this.p(1)} AND user_id=${this.p(2)} AND revoked_at IS NULL AND expires_at>${this.p(3)}`,sessionId,userId,new Date());return Number(rows[0]?.active_count||0)>0;}
  static async clear(){await this.ensureTable();await this.prisma.$executeRawUnsafe('DELETE FROM auth_sessions');}
}
