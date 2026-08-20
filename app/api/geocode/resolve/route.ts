import { NextRequest, NextResponse } from "next/server";
import { extractUserContext } from "@/src/sales/sales-auth.helper";
import { PermissionService } from "@/src/server/auth/permission.service";

const alphabet = "23456789CFGHJMPQRVWX";
const pairResolutions = [20, 1, 0.05, 0.0025, 0.000125];
const googleHosts = new Set([
  "maps.app.goo.gl",
  "goo.gl",
  "www.google.com",
  "google.com",
  "maps.google.com",
]);

function valid(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}
function direct(raw: string) {
  const match = raw
    .trim()
    .match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const latitude = Number(match[1]),
    longitude = Number(match[2]);
  return valid(latitude, longitude)
    ? { latitude, longitude, source: "COORDINATES" }
    : null;
}
function fromGoogleText(raw: string) {
  const decoded = decodeURIComponent(raw.replace(/\+/g, " "));
  for (const pattern of [
    /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    /[?&](?:q|query|destination|ll)=(-?\d{1,2}(?:\.\d+)?)[,%20 ]+(-?\d{1,3}(?:\.\d+)?)/i,
    /!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/i,
    /\/place\/(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/i,
    /(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)/,
  ]) {
    const m = decoded.match(pattern);
    if (m) {
      const latitude = Number(m[1]),
        longitude = Number(m[2]);
      if (valid(latitude, longitude))
        return { latitude, longitude, source: "GOOGLE_MAPS_URL" };
    }
  }
  return null;
}
function decodePlusCode(input: string) {
  const code =
      input
        .toUpperCase()
        .match(/[23456789CFGHJMPQRVWX0]{8}\+[23456789CFGHJMPQRVWX]{2,}/)?.[0] ||
      input.toUpperCase().replace(/\s+/g, "").split(",")[0],
    plus = code.indexOf("+");
  if (plus < 8) return null;
  const clean = code.replace("+", "").replace(/0/g, "");
  if (clean.length < 8) return null;
  let lat = -90,
    lng = -180,
    pairs = Math.min(5, Math.floor(clean.length / 2));
  for (let i = 0; i < pairs; i++) {
    const a = alphabet.indexOf(clean[i * 2]),
      b = alphabet.indexOf(clean[i * 2 + 1]);
    if (a < 0 || b < 0) return null;
    lat += a * pairResolutions[i];
    lng += b * pairResolutions[i];
  }
  let latSize = pairResolutions[pairs - 1],
    lngSize = pairResolutions[pairs - 1];
  if (clean.length > 10) {
    latSize = pairResolutions[4];
    lngSize = pairResolutions[4];
    for (let i = 10; i < clean.length; i++) {
      const value = alphabet.indexOf(clean[i]);
      if (value < 0) return null;
      latSize /= 5;
      lngSize /= 4;
      lat += Math.floor(value / 4) * latSize;
      lng += (value % 4) * lngSize;
    }
  }
  const latitude = lat + latSize / 2,
    longitude = lng + lngSize / 2;
  return valid(latitude, longitude)
    ? { latitude, longitude, source: "PLUS_CODE", plusCode: code }
    : null;
}
async function reverse(latitude: number, longitude: number) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");
  url.searchParams.set("accept-language", "es-MX,es");
  const response = await fetch(url, {
    headers: {
      "User-Agent": "BITALIS/1.0 client-location-editor",
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return {};
  const data: any = await response.json(),
    a = data?.address || {},
    street = a.road || a.pedestrian || a.residential || a.path || "",
    neighborhood =
      a.suburb ||
      a.neighbourhood ||
      a.quarter ||
      a.city_district ||
      a.village ||
      "",
    municipality = a.municipality || a.city || a.town || a.county || "";
  return {
    street,
    exteriorNumber: a.house_number || "",
    neighborhood,
    postalCode: a.postcode || "",
    city: a.city || a.town || a.village || municipality,
    municipality,
    state: a.state || "",
    displayName: data?.display_name || "",
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = await extractUserContext(req);
    await PermissionService.requirePermission(user.userId, "clients.edit");
    const body = await req.json();
    const raw = String(body?.input || "").trim();
    if (!raw)
      return NextResponse.json(
        { success: false, error: "Pega un enlace, Plus Code o coordenadas." },
        { status: 400 },
      );
    let resolved = direct(raw) || fromGoogleText(raw) || decodePlusCode(raw);
    if (!resolved && /^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      if (!googleHosts.has(url.hostname))
        return NextResponse.json(
          { success: false, error: "Solo se aceptan enlaces de Google Maps." },
          { status: 400 },
        );
      let current=url,response:Response|null=null;
      for(let hop=0;hop<5&&!resolved;hop++){
        response=await fetch(current,{redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(8000)});
        const location=response.headers.get('location');
        if(!location){resolved=fromGoogleText(response.url)||fromGoogleText(await response.text());break}
        current=new URL(location,current);
        if(!googleHosts.has(current.hostname))return NextResponse.json({success:false,error:'El enlace redirige fuera de Google Maps.'},{status:400});
        resolved=fromGoogleText(current.toString());
      }
    }
    if (!resolved)
      return NextResponse.json(
        {
          success: false,
          error:
            "No pudimos obtener coordenadas. Usa un enlace completo de Google Maps, latitud/longitud o un Plus Code completo.",
        },
        { status: 400 },
      );
    const address = await reverse(resolved.latitude, resolved.longitude).catch(
      () => ({}),
    );
    return NextResponse.json({
      success: true,
      data: { ...resolved, ...address },
    });
  } catch (error: any) {
    const message = String(
      error?.message || "No pudimos resolver la ubicación.",
    );
    return NextResponse.json(
      { success: false, error: message },
      {
        status: message.includes("UNAUTHORIZED")
          ? 401
          : message.startsWith("FORBIDDEN:")
            ? 403
            : 400,
      },
    );
  }
}
