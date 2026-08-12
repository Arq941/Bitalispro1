import { NextRequest, NextResponse } from 'next/server';
import { SecurityService } from '@/src/server/auth/security.service';

type LatLng = { lat: number; lng: number };

function validPoint(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function osrmInstruction(step: any) {
  const type = String(step?.maneuver?.type || 'continue');
  const modifier = String(step?.maneuver?.modifier || '').toLowerCase();
  const road = String(step?.name || '').trim();
  const roadText = road ? ` en ${road}` : '';

  const dir = (() => {
    if (modifier.includes('slight right')) return 'ligeramente a la derecha';
    if (modifier.includes('sharp right')) return 'pronunciadamente a la derecha';
    if (modifier.includes('right')) return 'a la derecha';
    if (modifier.includes('slight left')) return 'ligeramente a la izquierda';
    if (modifier.includes('sharp left')) return 'pronunciadamente a la izquierda';
    if (modifier.includes('left')) return 'a la izquierda';
    if (modifier.includes('uturn')) return 'en U';
    return '';
  })();

  if (type === 'depart') return road ? `Inicia por ${road}` : 'Inicia la ruta';
  if (type === 'arrive') return 'Has llegado a tu destino';
  if (type === 'roundabout' || type === 'rotary') return `En la glorieta, toma la salida indicada${roadText}`;
  if (type === 'merge') return `Incorpórate${dir ? ` ${dir}` : ''}${roadText}`;
  if (type === 'fork') return `Mantente${dir ? ` ${dir}` : ''}${roadText}`;
  if (type === 'on ramp' || type === 'off ramp') return `${type === 'on ramp' ? 'Toma la incorporación' : 'Toma la salida'}${dir ? ` ${dir}` : ''}${roadText}`;
  if (type === 'turn') return `Gira${dir ? ` ${dir}` : ''}${roadText}`;
  if (type === 'new name') return road ? `Continúa por ${road}` : 'Continúa';
  if (type === 'end of road') return `Al final de la calle, gira${dir ? ` ${dir}` : ''}${roadText}`;
  return road ? `Continúa por ${road}` : 'Continúa';
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED: Bearer token requerido.' }, { status: 401 });
    }
    const verified = SecurityService.verifyAccessToken(authHeader.slice(7).trim());
    if (!verified?.sub) return NextResponse.json({ error: 'UNAUTHORIZED: Token inválido.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const origin: LatLng = { lat: Number(searchParams.get('originLat')), lng: Number(searchParams.get('originLng')) };
    const destination: LatLng = { lat: Number(searchParams.get('destinationLat')), lng: Number(searchParams.get('destinationLng')) };
    if (!validPoint(origin.lat, origin.lng) || !validPoint(destination.lat, destination.lng)) {
      return NextResponse.json({ error: 'Coordenadas inválidas.' }, { status: 400 });
    }

    const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_ROUTES_API_KEY;
    if (googleKey) {
      const googleRes = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleKey,
          'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.geoJsonLinestring,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.navigationInstruction,routes.legs.steps.startLocation,routes.legs.steps.endLocation',
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
          destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          languageCode: 'es-MX',
          units: 'METRIC',
          polylineEncoding: 'GEO_JSON_LINESTRING',
        }),
        cache: 'no-store',
      });
      const google = await googleRes.json().catch(() => ({}));
      if (googleRes.ok && google?.routes?.[0]) {
        const route = google.routes[0];
        const coords = route?.polyline?.geoJsonLinestring?.coordinates || [];
        const steps = (route?.legs || []).flatMap((leg: any) => (leg.steps || []).map((step: any) => ({
          instruction: step?.navigationInstruction?.instructions || 'Continúa',
          maneuver: step?.navigationInstruction?.maneuver || 'STRAIGHT',
          distanceMeters: Number(step?.distanceMeters || 0),
          durationSeconds: Number(String(step?.staticDuration || '0s').replace('s', '')) || 0,
          start: step?.startLocation?.latLng ? { lat: step.startLocation.latLng.latitude, lng: step.startLocation.latLng.longitude } : null,
          end: step?.endLocation?.latLng ? { lat: step.endLocation.latLng.latitude, lng: step.endLocation.latLng.longitude } : null,
        })));
        return NextResponse.json({ success: true, provider: 'GOOGLE_ROUTES', data: { distanceMeters: Number(route.distanceMeters || 0), durationSeconds: Number(String(route.duration || '0s').replace('s', '')) || 0, geometry: coords.map((c: number[]) => ({ lat: c[1], lng: c[0] })), steps } });
      }
    }

    const base = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
    const url = `${base}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true&alternatives=false`;
    const osrmRes = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'BITALIS/1.0' } });
    const osrm = await osrmRes.json().catch(() => ({}));
    if (!osrmRes.ok || osrm?.code !== 'Ok' || !osrm?.routes?.[0]) {
      return NextResponse.json({ error: osrm?.message || 'No fue posible calcular la ruta por calles.' }, { status: 502 });
    }
    const route = osrm.routes[0];
    const coords = route?.geometry?.coordinates || [];
    const steps = (route?.legs || []).flatMap((leg: any) => (leg.steps || []).map((step: any) => ({
      instruction: osrmInstruction(step),
      maneuver: step?.maneuver?.type || 'continue',
      modifier: step?.maneuver?.modifier || null,
      distanceMeters: Number(step?.distance || 0),
      durationSeconds: Number(step?.duration || 0),
      start: Array.isArray(step?.maneuver?.location) ? { lat: step.maneuver.location[1], lng: step.maneuver.location[0] } : null,
    })));
    return NextResponse.json({ success: true, provider: 'OSRM', data: { distanceMeters: Number(route.distance || 0), durationSeconds: Number(route.duration || 0), geometry: coords.map((c: number[]) => ({ lat: c[1], lng: c[0] })), steps } });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Error al calcular indicaciones.' }, { status: 500 });
  }
}
