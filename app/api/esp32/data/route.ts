import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
export const dynamic = 'force-dynamic';

type Esp32Payload = {
  water_level: number;
  motion: string;
  pump_state: number;
  light_state: number;
  last_updated: number;
};

// In-memory store for demonstration purposes
// In a real app, use a database (Redis, Postgres, etc.)
const DEFAULT_ESP32: Esp32Payload = {
  water_level: 0,
  motion: "0",
  pump_state: 0,
  light_state: 0,
  last_updated: Date.now(),
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const incoming = {
      water_level: Number(body.water_level) || 0,
      motion: typeof body.motion === "string" ? body.motion : String(body.motion ?? "0"),
      pump_state: body.pump_state === 1 || body.pump_state === "1" ? 1 : 0,
      light_state: body.light_state === 1 || body.light_state === "1" ? 1 : 0,
    };

    const next = {
      ...(await kv.get<Esp32Payload>('esp32:latest')) || DEFAULT_ESP32,
      ...incoming,
      last_updated: Date.now(),
    } satisfies Esp32Payload;

    await kv.set('esp32:latest', next);

    return NextResponse.json({ success: true, message: "Data received" });
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hasIngestParams =
    searchParams.has('water_level') ||
    searchParams.has('motion') ||
    searchParams.has('pump_state') ||
    searchParams.has('light_state') ||
    searchParams.get('ingest') === '1';

  if (hasIngestParams) {
    const incoming = {
      water_level: Number(searchParams.get('water_level')) || 0,
      motion: String(searchParams.get('motion') ?? '0'),
      pump_state: (searchParams.get('pump_state') === '1') ? 1 : 0,
      light_state: (searchParams.get('light_state') === '1') ? 1 : 0,
    } as const;

    const next = {
      ...(await kv.get<Esp32Payload>('esp32:latest')) || DEFAULT_ESP32,
      ...incoming,
      last_updated: Date.now(),
    } satisfies Esp32Payload;
    await kv.set('esp32:latest', next);
    return NextResponse.json({ success: true });
  }

  // Demo fallback if no data or stale
  const STALE_MS = 15_000;
  const stored = await kv.get<Esp32Payload>('esp32:latest');
  const now = Date.now();
  if (!stored || now - stored.last_updated > STALE_MS) {
    const wl = 35 + Math.round(Math.random() * 50); // 35-85%
    const motion = Math.random() < 0.1 ? '1' : '0';
    const pump = wl < 30 ? 1 : 0;
    const light = motion === '1' ? 1 : 0;
    const mock: Esp32Payload = {
      water_level: wl,
      motion,
      pump_state: pump,
      light_state: light,
      last_updated: now,
    };
    return NextResponse.json(mock, { headers: { 'x-demo-data': '1' } });
  }
  return NextResponse.json(stored);
}
