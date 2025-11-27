"use client";

import React, { useId, useMemo } from 'react';

interface HalfDonutGaugeProps {
    value: number;
    max?: number;
    label: string;
    unit?: string;
    gradientColors?: [string, string];
    minLabel?: string;
    maxLabel?: string;
    statusText?: string;
}

interface BinaryHalfDonutGaugeProps {
    active: boolean;
    label: string;
    safeLabel?: string;
    dangerLabel?: string;
    description?: string;
}

const VIEWBOX_WIDTH = 240;
const VIEWBOX_HEIGHT = 230;
const CENTER_X = VIEWBOX_WIDTH / 2;
const CENTER_Y = 120;
const RADIUS = 100;
const START_ANGLE = 180;
const END_ANGLE = 0;
const ARC_LENGTH = Math.PI * RADIUS;

const polarToCartesian = (cx: number, cy: number, radius: number, angleDeg: number) => {
    const angleRad = (Math.PI / 180) * angleDeg;
    return {
        x: cx + radius * Math.cos(angleRad),
        y: cy - radius * Math.sin(angleRad)
    };
};

const describeArc = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(CENTER_X, CENTER_Y, RADIUS, startAngle);
    const end = polarToCartesian(CENTER_X, CENTER_Y, RADIUS, endAngle);
    const delta = Math.abs(endAngle - startAngle);
    const largeArcFlag = delta > 180 ? 1 : 0;
    const sweepFlag = startAngle > endAngle ? 0 : 1;
    return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
};

export function HalfDonutGauge({
    value,
    max = 100,
    label,
    unit = '',
    gradientColors = ['#38bdf8', '#a855f7'],
    minLabel = '0',
    maxLabel = max.toString(),
    statusText,
}: HalfDonutGaugeProps) {
    const gaugeId = useId().replace(/:/g, '');
    const safeMax = max <= 0 ? 100 : max;
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(safeMax, value)) : 0;
    const ratio = safeValue / safeMax;

    const arcPath = useMemo(() => describeArc(START_ANGLE, END_ANGLE), []);
    const activeLength = useMemo(() => Math.max(0, Math.min(1, ratio)) * ARC_LENGTH, [ratio]);

    const indicator = useMemo(() => {
        const pointerAngle = 180 - ratio * 180;
        return polarToCartesian(CENTER_X, CENTER_Y, RADIUS, pointerAngle);
    }, [ratio]);

    return (
        <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
            <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="w-full">
                <defs>
                    <linearGradient id={`g-${gaugeId}`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={gradientColors[0]} />
                        <stop offset="100%" stopColor={gradientColors[1]} />
                    </linearGradient>
                </defs>
                <path d={arcPath} stroke="rgba(255,255,255,0.15)" strokeWidth={14} fill="none" strokeLinecap="round" />
                {activeLength > 0 && (
                    <path
                        d={arcPath}
                        stroke={`url(#g-${gaugeId})`}
                        strokeWidth={14}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${activeLength} ${ARC_LENGTH}`}
                        strokeDashoffset={0}
                    />
                )}
                <circle cx={indicator.x} cy={indicator.y} r={5} fill="#fff" stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
            </svg>
            <div className="mt-2 flex justify-between text-xs text-neutral-400">
                <span>{minLabel}</span>
                <span>{maxLabel}</span>
            </div>
            <div className="mt-3 text-center">
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">{label}</p>
                <p className="text-2xl font-semibold text-white">
                    {safeValue.toFixed(1)}{unit}
                </p>
                {statusText && <p className="text-sm text-neutral-400">{statusText}</p>}
            </div>
        </div>
    );
}

export function BinaryHalfDonutGauge({
    active,
    label,
    safeLabel = 'Safe',
    dangerLabel = 'Smoke',
    description,
}: BinaryHalfDonutGaugeProps) {
    const pointerAngle = active ? 10 : 170;
    const pointer = polarToCartesian(CENTER_X, CENTER_Y, RADIUS, pointerAngle);
    const safeArc = describeArc(START_ANGLE, 90);
    const dangerArc = describeArc(90, END_ANGLE);

    return (
        <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
            <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="w-full">
                <path d={safeArc} stroke={active ? 'rgba(34,197,94,0.3)' : '#22c55e'} strokeWidth={14} fill="none" strokeLinecap="round" />
                <path d={dangerArc} stroke={active ? '#ef4444' : 'rgba(239,68,68,0.3)'} strokeWidth={14} fill="none" strokeLinecap="round" />
                <circle cx={pointer.x} cy={pointer.y} r={6} fill="#fff" stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
            </svg>
            <div className="mt-2 flex justify-between text-xs font-semibold">
                <span className="text-green-400">{safeLabel}</span>
                <span className="text-red-400">{dangerLabel}</span>
            </div>
            <div className="mt-3 text-center">
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">{label}</p>
                <p className={`text-xl font-bold ${active ? 'text-red-400' : 'text-green-400'}`}>
                    {active ? dangerLabel.toUpperCase() : safeLabel.toUpperCase()}
                </p>
                {description && <p className="text-sm text-neutral-400">{description}</p>}
            </div>
        </div>
    );
}
