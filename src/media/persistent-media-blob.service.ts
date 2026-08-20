import {PrismaService} from '@/src/database/prisma.service';

type BlobRow={content:Buffer|Uint8Array;mime_type:string;size_bytes:number;checksum:string|null};

export class PersistentMediaBlobService{
 private static tableReady:Promise<void>|null=null;
 private static isMysql(){return String(process.env.DATABASE_URL||'').toLowerCase().startsWith('mysql');}
 private static ensureTable(){
  if(this.tableReady)return this.tableReady;
  this.tableReady=(async()=>{const prisma=PrismaService.getInstance();if(this.isMysql()){await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS bitalis_media_blobs (storage_key VARCHAR(512) NOT NULL PRIMARY KEY, mime_type VARCHAR(120) NOT NULL, content LONGBLOB NOT NULL, size_bytes INT NOT NULL, checksum VARCHAR(64) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);}else{await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS bitalis_media_blobs (storage_key TEXT PRIMARY KEY, mime_type TEXT NOT NULL, content BYTEA NOT NULL, size_bytes INTEGER NOT NULL, checksum TEXT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);}})().catch(error=>{this.tableReady=null;throw error;});
  return this.tableReady;
 }
 static async store(storageKey:string,mimeType:string,content:Buffer,checksum?:string|null){
  if(!content.length)return false;
  try{await this.ensureTable();const prisma=PrismaService.getInstance();if(this.isMysql()){await prisma.$executeRawUnsafe(`INSERT INTO bitalis_media_blobs (storage_key,mime_type,content,size_bytes,checksum) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE mime_type=VALUES(mime_type),content=VALUES(content),size_bytes=VALUES(size_bytes),checksum=VALUES(checksum),updated_at=CURRENT_TIMESTAMP`,storageKey,mimeType,content,content.length,checksum||null);}else{await prisma.$executeRawUnsafe(`INSERT INTO bitalis_media_blobs (storage_key,mime_type,content,size_bytes,checksum) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (storage_key) DO UPDATE SET mime_type=EXCLUDED.mime_type,content=EXCLUDED.content,size_bytes=EXCLUDED.size_bytes,checksum=EXCLUDED.checksum,updated_at=CURRENT_TIMESTAMP`,storageKey,mimeType,content,content.length,checksum||null);}return true;}catch{return false;}
 }
 static async read(storageKey:string):Promise<{content:Buffer;mimeType:string;size:number;checksum:string|null}|null>{
  try{await this.ensureTable();const prisma=PrismaService.getInstance();const rows=this.isMysql()?await prisma.$queryRawUnsafe<BlobRow[]>(`SELECT content,mime_type,size_bytes,checksum FROM bitalis_media_blobs WHERE storage_key=? LIMIT 1`,storageKey):await prisma.$queryRawUnsafe<BlobRow[]>(`SELECT content,mime_type,size_bytes,checksum FROM bitalis_media_blobs WHERE storage_key=$1 LIMIT 1`,storageKey);const row=rows[0];if(!row)return null;return{content:Buffer.from(row.content),mimeType:row.mime_type,size:Number(row.size_bytes),checksum:row.checksum};}catch{return null;}
 }
 static async remove(storageKey:string){
  try{await this.ensureTable();const prisma=PrismaService.getInstance();if(this.isMysql())await prisma.$executeRawUnsafe(`DELETE FROM bitalis_media_blobs WHERE storage_key=?`,storageKey);else await prisma.$executeRawUnsafe(`DELETE FROM bitalis_media_blobs WHERE storage_key=$1`,storageKey);}catch{}
 }
}
