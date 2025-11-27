import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

// Simple in-memory store (ephemeral on serverless)
let latestEsp8266 = {
  temperature: 0,
  humidity: 0,
  motion: 0,
  smoke: 0,
  alarm_state: 0,
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
    latestEsp8266 = {
      temperature: Number(body.temperature) || 0,
      humidity: Number(body.humidity) || 0,
      motion: Number(body.motion) === 1 ? 1 : 0,
      smoke: Number(body.smoke) === 1 ? 1 : 0,
      alarm_state: Number(body.alarm_state) === 1 ? 1 : 0,
      last_updated: Date.now(),
    };
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hasIngestParams =
    searchParams.has('temperature') ||
    searchParams.has('humidity') ||
    searchParams.has('motion') ||
    searchParams.has('smoke') ||
    searchParams.has('alarm_state') ||
    searchParams.get('ingest') === '1';

  if (hasIngestParams) {
    latestEsp8266 = {
      temperature: Number(searchParams.get('temperature')) || 0,
      humidity: Number(searchParams.get('humidity')) || 0,
      motion: Number(searchParams.get('motion')) === 1 ? 1 : 0,
      smoke: Number(searchParams.get('smoke')) === 1 ? 1 : 0,
      alarm_state: Number(searchParams.get('alarm_state')) === 1 ? 1 : 0,
      last_updated: Date.now(),
    };
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(latestEsp8266);
}
