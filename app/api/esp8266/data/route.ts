import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
export const dynamic = 'force-dynamic';

// Simple in-memory store (ephemeral on serverless)
type Esp8266Payload = {
  temperature: number;
  humidity: number;
  motion: number; // 0|1
  smoke: number;  // 0|1
  alarm_state: number; // 0|1
  last_updated: number;
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
    const next: Esp8266Payload = {
      temperature: Number(body.temperature) || 0,
      humidity: Number(body.humidity) || 0,
      motion: Number(body.motion) === 1 ? 1 : 0,
      smoke: Number(body.smoke) === 1 ? 1 : 0,
      alarm_state: Number(body.alarm_state) === 1 ? 1 : 0,
      last_updated: Date.now(),
    };
    await kv.set('esp8266:latest', next);
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
    const next: Esp8266Payload = {
      temperature: Number(searchParams.get('temperature')) || 0,
      humidity: Number(searchParams.get('humidity')) || 0,
      motion: Number(searchParams.get('motion')) === 1 ? 1 : 0,
      smoke: Number(searchParams.get('smoke')) === 1 ? 1 : 0,
      alarm_state: Number(searchParams.get('alarm_state')) === 1 ? 1 : 0,
      last_updated: Date.now(),
    };
    await kv.set('esp8266:latest', next);
    return NextResponse.json({ success: true });
  }

  // Demo fallback if no data or stale
  const STALE_MS = 15_000;
  const stored = await kv.get<Esp8266Payload>('esp8266:latest');
  const now = Date.now();
  if (!stored || now - stored.last_updated > STALE_MS) {
    const mock: Esp8266Payload = {
      temperature: 26 + Math.round(Math.random() * 6),
      humidity: 50 + Math.round(Math.random() * 20),
      motion: Math.random() < 0.2 ? 1 : 0,
      smoke: 0,
      alarm_state: 0,
      last_updated: now,
    };
    return NextResponse.json(mock, { headers: { 'x-demo-data': '1' } });
  }
  return NextResponse.json(stored);
}
