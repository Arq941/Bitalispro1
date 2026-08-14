import {NextRequest,NextResponse} from 'next/server';
import {PermissionService} from '@/src/server/auth/permission.service';
import {getSalesUserContext} from '@/src/sales/sales-auth.helper';

export async function GET(req:NextRequest){
 try{
  const ctx=getSalesUserContext(req);
  const permissionCodes=await PermissionService.getEffectivePermissionCodes(ctx.userId);
  return NextResponse.json({success:true,permissionCodes});
 }catch(e:any){
  const message=String(e?.message||'No autorizado.');
  const status=message.includes('UNAUTHORIZED')?401:message.includes('FORBIDDEN')?403:400;
  return NextResponse.json({success:false,error:message},{status});
 }
}
