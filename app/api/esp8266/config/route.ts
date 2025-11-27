import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
export const dynamic = 'force-dynamic';

// KV key: 'esp8266:config'
const DEFAULT_8266_CONFIG = {
  alarm_override: 'auto' as 'auto' | 'on' | 'off',
};

export async function GET() {
  const stored = (await kv.get<typeof DEFAULT_8266_CONFIG>('esp8266:config')) || DEFAULT_8266_CONFIG;
  return NextResponse.json(stored);
}

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
    const { alarm_override } = body ?? {};

    if (
      alarm_override !== undefined &&
      alarm_override !== 'auto' &&
      alarm_override !== 'on' &&
      alarm_override !== 'off'
    ) {
      return NextResponse.json(
        { success: false, message: 'alarm_override must be one of auto|on|off' },
        { status: 400 }
      );
    }

    const current = (await kv.get<typeof DEFAULT_8266_CONFIG>('esp8266:config')) || DEFAULT_8266_CONFIG;
    const next = {
      ...current,
      ...(alarm_override ? { alarm_override } : {}),
    } as const;
    await kv.set('esp8266:config', next);
    return NextResponse.json(next);
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }
}
