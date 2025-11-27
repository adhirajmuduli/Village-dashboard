import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

// In-memory config (ephemeral on serverless)
let esp8266Config = {
  alarm_override: 'auto' as 'auto' | 'on' | 'off',
};

export async function GET() {
  return NextResponse.json(esp8266Config);
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

    esp8266Config = {
      ...esp8266Config,
      ...(alarm_override ? { alarm_override } : {}),
    };

    return NextResponse.json(esp8266Config);
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }
}
