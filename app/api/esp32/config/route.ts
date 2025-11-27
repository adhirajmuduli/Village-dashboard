import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

type OverrideMode = 'auto' | 'on' | 'off';

const DEFAULT_CONFIG = {
    water_threshold: 20,
    motion_light_time: 5000,
    pump_override: 'auto' as OverrideMode,
    light_override: 'auto' as OverrideMode,
};

let config = { ...DEFAULT_CONFIG };

export async function GET() {
    return NextResponse.json(config);
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

        const nextConfig = {
            water_threshold: body.water_threshold !== undefined
                ? clamp(Number(body.water_threshold) || DEFAULT_CONFIG.water_threshold, 0, 100)
                : config.water_threshold,
            motion_light_time: body.motion_light_time !== undefined
                ? clamp(Number(body.motion_light_time) || DEFAULT_CONFIG.motion_light_time, 100, 600000)
                : config.motion_light_time,
            pump_override: normalizeOverride(body.pump_override, config.pump_override),
            light_override: normalizeOverride(body.light_override, config.light_override),
        } satisfies typeof config;

        config = nextConfig;
        return NextResponse.json(config);
    } catch {
        return NextResponse.json({ success: false, message: 'Invalid config payload' }, { status: 400 });
    }
}
