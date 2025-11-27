import { NextResponse } from 'next/server';

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

export async function GET() {
  return NextResponse.json(latestData);
}
