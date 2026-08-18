import {NextRequest,NextResponse} from 'next/server';

export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
 const lat=Number(req.nextUrl.searchParams.get('lat')),lon=Number(req.nextUrl.searchParams.get('lon'));
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat > 90||lon < -180||lon > 180)return NextResponse.json({success:false,error:'Coordenadas inválidas.'},{status:400});
 try{
  const url=new URL('https://nominatim.openstreetmap.org/reverse');url.searchParams.set('format','jsonv2');url.searchParams.set('lat',String(lat));url.searchParams.set('lon',String(lon));url.searchParams.set('addressdetails','1');url.searchParams.set('zoom','18');url.searchParams.set('accept-language','es-MX,es');
  const response=await fetch(url,{headers:{'User-Agent':'BITALIS/1.0 field-client-intake','Accept':'application/json'},cache:'no-store'});
  if(!response.ok)throw new Error('No se pudo consultar la dirección.');
  const data:any=await response.json(),a=data?.address||{};
  const street=a.road||a.pedestrian||a.residential||a.path||a.neighbourhood||'';
  const number=a.house_number||'';
  const neighborhood=a.suburb||a.neighbourhood||a.quarter||a.city_district||a.village||'';
  const municipality=a.municipality||a.city||a.town||a.county||'';
  const state=a.state||'';
  const postalCode=a.postcode||'';
  const address=[street,number,neighborhood,municipality,state,postalCode].filter(Boolean).join(', ')||String(data?.display_name||'');
  return NextResponse.json({success:true,data:{address,street,exteriorNumber:number,neighborhood,municipality,city:a.city||a.town||a.village||municipality,state,postalCode,displayName:data?.display_name||address}});
 }catch(error:any){return NextResponse.json({success:false,error:error?.message||'No pudimos obtener la dirección de estas coordenadas.'},{status:502});}
}
