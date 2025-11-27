import { NextResponse } from 'next/server';

const ESP8266_BASE_URL = process.env.ESP8266_BASE_URL ?? '';

const assertBaseUrl = () => {
    if (!ESP8266_BASE_URL) {
        throw new Error('ESP8266_BASE_URL env var is not configured.');
    }
    return ESP8266_BASE_URL.replace(/\/$/, '');
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint') || 'status';

    try {
        const base = assertBaseUrl();
        const target = `${base}/api/${endpoint}`;
        const res = await fetch(target, { cache: 'no-store' });
        if (!res.ok) {
            throw new Error(`ESP8266 responded with ${res.status}`);
        }
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('ESP8266 proxy GET failed:', error);
        return NextResponse.json({ error: 'Failed to reach ESP8266 board' }, { status: 502 });
    }
}

export async function POST(request: Request) {
    try {
        const { action } = await request.json();
        if (action !== 'alarm_on' && action !== 'alarm_off') {
            return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
        }

        const base = assertBaseUrl();
        const target = `${base}/api/alarm/${action === 'alarm_on' ? 'on' : 'off'}`;
        const res = await fetch(target);
        if (!res.ok) {
            throw new Error(`ESP8266 responded with ${res.status}`);
        }

        return NextResponse.json({ success: true, action });
    } catch (error) {
        console.error('ESP8266 proxy POST failed:', error);
        return NextResponse.json({ success: false, message: 'Failed to toggle alarm' }, { status: 500 });
    }
}
