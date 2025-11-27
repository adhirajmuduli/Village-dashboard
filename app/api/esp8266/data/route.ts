import { NextResponse } from 'next/server';

// Simple in-memory store (ephemeral on serverless)
let latestEsp8266 = {
  temperature: 0,
  humidity: 0,
  motion: 0,
  smoke: 0,
  alarm_state: 0,
  last_updated: Date.now(),
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    latestEsp8266 = {
      temperature: Number(body.temperature) || 0,
      humidity: Number(body.humidity) || 0,
      motion: body.motion ? 1 : 0,
      smoke: body.smoke ? 1 : 0,
      alarm_state: body.alarm_state ? 1 : 0,
      last_updated: Date.now(),
    };
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json(latestEsp8266);
}
