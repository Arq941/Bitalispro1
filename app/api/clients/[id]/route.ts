import { NextRequest, NextResponse } from 'next/server';
import { ClientService } from '@/src/crm/client.service';
import { getClientUserContext } from '@/src/crm/auth-helper';
import { PrismaService } from '@/src/database/prisma.service';

function statusFromError(err: any, fallback: number): number {
  const message = String(err?.message || '');
  if (message.includes('UNAUTHORIZED')) return 401;
  if (message.includes('FORBIDDEN')) return 403;
  return fallback;
}

export async function GET(req: NextRequest,{ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = getClientUserContext(req);
    const client = await ClientService.getClientById(id, userContext);
    return NextResponse.json({ success: true, client });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message },{ status: statusFromError(err, 404) });
  }
}

export async function PATCH(req: NextRequest,{ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = getClientUserContext(req);
    if (!['ADMIN','SUPERVISORA'].includes(userContext.role)) {
      return NextResponse.json({ success:false, error:'La vendedora únicamente registra el alta inicial. Supervisión completa o modifica el expediente.' },{status:403});
    }
    const body = await req.json();
    const client = await ClientService.updateClient(id, body, userContext);
    return NextResponse.json({ success: true, client });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message },{ status: statusFromError(err, 400) });
  }
}

export async function DELETE(req: NextRequest,{ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = getClientUserContext(req);
    if (!['ADMIN','SUPERVISORA'].includes(userContext.role)) return NextResponse.json({success:false,error:'Solo supervisión puede eliminar clientes.'},{status:403});
    const prisma=PrismaService.getInstance();
    const client=await prisma.client.findUnique({where:{id},select:{id:true,clientNumber:true,_count:{select:{sales:true,credits:true}}}});
    if(!client)return NextResponse.json({success:false,error:'Cliente no encontrado.'},{status:404});
    if(client._count.sales>0||client._count.credits>0){
      return NextResponse.json({success:false,error:'Este cliente ya tiene historial financiero y no puede eliminarse. Puedes marcarlo como inactivo para conservar la auditoría.'},{status:409});
    }
    await prisma.client.delete({where:{id}});
    return NextResponse.json({success:true,deletedId:id,clientNumber:client.clientNumber});
  } catch (err: any) {
    return NextResponse.json({success:false,error:err?.message||'No pudimos eliminar el cliente.'},{status:statusFromError(err,400)});
  }
}
