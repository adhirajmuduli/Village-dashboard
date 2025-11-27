import { NextResponse } from 'next/server';
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
let latestData: Esp32Payload = {
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

    // Update store
    latestData = {
      ...latestData,
      ...incoming,
      last_updated: Date.now(),
    };

    console.log("Received ESP32 Data:", latestData);

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

    latestData = {
      ...latestData,
      ...incoming,
      last_updated: Date.now(),
    };
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(latestData);
}
