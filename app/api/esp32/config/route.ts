import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
export const dynamic = 'force-dynamic';

type OverrideMode = 'auto' | 'on' | 'off';

const DEFAULT_CONFIG = {
    water_threshold: 20,
    motion_light_time: 5000,
    pump_override: 'auto' as OverrideMode,
    light_override: 'auto' as OverrideMode,
};

// Stored in Vercel KV under key 'esp32:config'

export async function GET() {
    const stored = (await kv.get<typeof DEFAULT_CONFIG>('esp32:config')) || DEFAULT_CONFIG;
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

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeOverride = (value: unknown, fallback: OverrideMode): OverrideMode => {
    if (value === 'on' || value === 'off' || value === 'auto') {
        return value;
    }
    return fallback;
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const current = (await kv.get<typeof DEFAULT_CONFIG>('esp32:config')) || DEFAULT_CONFIG;

        const nextConfig = {
            water_threshold: body.water_threshold !== undefined
                ? clamp(Number(body.water_threshold) || DEFAULT_CONFIG.water_threshold, 0, 100)
                : current.water_threshold,
            motion_light_time: body.motion_light_time !== undefined
                ? clamp(Number(body.motion_light_time) || DEFAULT_CONFIG.motion_light_time, 100, 600000)
                : current.motion_light_time,
            pump_override: normalizeOverride(body.pump_override, current.pump_override),
            light_override: normalizeOverride(body.light_override, current.light_override),
        } satisfies typeof DEFAULT_CONFIG;

        await kv.set('esp32:config', nextConfig);
        return NextResponse.json(nextConfig);
    } catch {
        return NextResponse.json({ success: false, message: 'Invalid config payload' }, { status: 400 });
    }
}
