import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {PersistentMediaBlobService} from '@/src/media/persistent-media-blob.service';

export interface MediaUploadParams {
  clientId:string;mediaType:string;url?:string;fileContent?:string|Buffer;mimeType?:string;fileSize?:number;latitude?:number;longitude?:number;uploadedBy?:string;
}
function extensionFor(mimeType?:string){const mime=String(mimeType||'').toLowerCase();if(mime.includes('png'))return'.png';if(mime.includes('webp'))return'.webp';if(mime.includes('heic'))return'.heic';if(mime.includes('heif'))return'.heif';return'.jpg';}

export class MediaStorageService{
 public static storageRoot(){
  if(process.env.BITALIS_UPLOAD_DIR)return path.resolve(process.env.BITALIS_UPLOAD_DIR);
  const base=process.env.HOME||path.resolve(process.cwd(),'..');
  return path.join(base,'.bitalis','media');
 }
 private static legacyRoots(){return[path.join(process.cwd(),'storage','client-media'),path.join(process.cwd(),'.next','standalone','storage','client-media')].map(x=>path.resolve(x));}
 private static safePath(rootPath:string,storageKey:string){const clean=storageKey.replace(/\\/g,'/').replace(/^\/+/,''),root=path.resolve(rootPath),absolute=path.resolve(root,clean);if(!absolute.startsWith(root+path.sep)&&absolute!==root)throw new Error('Ruta de archivo inválida.');return absolute;}
 public static resolveStoragePath(storageKey:string){return this.safePath(this.storageRoot(),storageKey);}
 public static resolveExistingStoragePath(storageKey:string){
  const persistent=this.resolveStoragePath(storageKey);if(fs.existsSync(persistent))return persistent;
  for(const root of this.legacyRoots()){const candidate=this.safePath(root,storageKey);if(fs.existsSync(candidate)){fs.mkdirSync(path.dirname(persistent),{recursive:true});fs.copyFileSync(candidate,persistent);return persistent;}}
  return null;
 }
 public static async read(storageKey:string,mimeType='image/jpeg'){
  const database=await PersistentMediaBlobService.read(storageKey);
  if(database){const target=this.resolveStoragePath(storageKey);if(!fs.existsSync(target)){try{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,database.content);}catch{}}return{content:database.content,mimeType:database.mimeType};}
  const existing=this.resolveExistingStoragePath(storageKey);if(!existing)return null;
  const content=fs.readFileSync(existing);void PersistentMediaBlobService.store(storageKey,mimeType,content,crypto.createHash('sha256').update(content).digest('hex'));return{content,mimeType};
 }
 public static async persistDatabaseCopy(storageKey:string,mimeType:string,fileContent?:string|Buffer,checksum?:string|null){
  let buffer:Buffer|null=null;if(Buffer.isBuffer(fileContent))buffer=fileContent;else if(typeof fileContent==='string'&&fileContent){const base64=fileContent.includes(',')?fileContent.split(',').pop()||'':fileContent;buffer=Buffer.from(base64,'base64');}
  if(!buffer?.length)return false;return PersistentMediaBlobService.store(storageKey,mimeType,buffer,checksum);
 }
 public static async remove(storageKey?:string|null){if(!storageKey)return;try{const absolute=this.resolveStoragePath(storageKey);if(fs.existsSync(absolute))fs.unlinkSync(absolute);}catch{}await PersistentMediaBlobService.remove(storageKey);}
 public static processMediaUpload(params:MediaUploadParams){
  const timestamp=Date.now(),randomSuffix=crypto.randomBytes(6).toString('hex'),extension=extensionFor(params.mimeType),storageKey=`clients/${params.clientId}/${params.mediaType.toLowerCase()}_${timestamp}_${randomSuffix}${extension}`;
  let buffer:Buffer|null=null;if(Buffer.isBuffer(params.fileContent))buffer=params.fileContent;else if(typeof params.fileContent==='string'&&params.fileContent){const base64=params.fileContent.includes(',')?params.fileContent.split(',').pop()||'':params.fileContent;buffer=Buffer.from(base64,'base64');}
  const checksum=crypto.createHash('sha256').update(buffer||`${storageKey}_${timestamp}`).digest('hex');
  if(buffer?.length){const absolute=this.resolveStoragePath(storageKey);fs.mkdirSync(path.dirname(absolute),{recursive:true});fs.writeFileSync(absolute,buffer);}
  return{storageKey,url:params.url||`/api/client-media/${storageKey}`,checksum,mimeType:params.mimeType||'image/jpeg',fileSize:params.fileSize||buffer?.length||0};
 }
}
