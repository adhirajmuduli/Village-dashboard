"use client";

import React, { useMemo } from 'react';

export interface TrendSample {
    label: string;
    value: number;
}

interface TrendChartProps {
    label: string;
    unit: string;
    color: string;
    accent: string;
    min: number;
    max: number;
    samples: TrendSample[];
    hideHeader?: boolean;
    className?: string;
}

const buildPath = (samples: TrendSample[], min: number, max: number) => {
    if (samples.length < 2) return '';

    const safeMax = Math.max(max, min + 1);
    return samples
        .map((sample, index) => {
            const x = (index / (samples.length - 1)) * 100;
            const value = Number.isFinite(sample.value) ? sample.value : min;
            const normalized = Math.min(Math.max(value, min), safeMax);
            const y = 10 + (1 - (normalized - min) / (safeMax - min)) * 70;
            return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(' ');
};

const TrendChart = ({ label, unit, color, accent, min, max, samples, hideHeader, className }: TrendChartProps) => {
    const path = useMemo(() => buildPath(samples, min, max), [samples, min, max]);

    const ticks = useMemo(() => {
        if (!samples.length) return [];
        const segments = Math.min(4, samples.length - 1 || 1);
        return Array.from({ length: segments + 1 }, (_, idx) => {
            const sampleIndex = Math.floor(((samples.length - 1) * idx) / segments);
            const sample = samples[sampleIndex];
            return {
                position: (idx / segments) * 100,
                label: sample?.label ?? '--'
            };
        });
    }, [samples]);

    const latest = samples[samples.length - 1]?.value;
    const containerClasses = `rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/0 to-transparent/30 p-4 ${className ?? ''}`;

    return (
        <div className={containerClasses}>
            {!hideHeader && (
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">{label}</p>
                        <p className="text-2xl font-semibold" style={{ color }}>
                            {Number.isFinite(latest) ? `${latest!.toFixed(1)}${unit}` : '--'}
                        </p>
                    </div>
                    <span className="text-xs text-neutral-400">{samples.length} samples</span>
                </div>
            )}
            <div className="mt-4 h-32 w-full">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                    <defs>
                        <linearGradient id={`trend-${label}`} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
                            <stop offset="100%" stopColor={accent} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <rect x={0} y={10} width={100} height={70} fill={`url(#trend-${label})`} opacity={0.1} />
                    <line x1={2} x2={98} y1={90} y2={90} stroke="rgba(255,255,255,0.2)" strokeWidth={0.6} />
                    {ticks.map(tick => (
                        <g key={`${label}-tick-${tick.position}`}>
                            <line x1={tick.position} x2={tick.position} y1={87} y2={93} stroke="rgba(255,255,255,0.2)" strokeWidth={0.5} />
                            <text x={tick.position} y={97} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={4}>
                                {tick.label}
                            </text>
                        </g>
                    ))}
                    {path && <path d={path} fill="none" stroke={accent} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />}
                </svg>
            </div>
        </div>
    );
};

interface TrendChartWrapperProps {
    samples: TrendSample[];
    hideTitle?: boolean;
    className?: string;
}

export function TemperatureTrendChart({ samples, hideTitle, className }: TrendChartWrapperProps) {
    return (
        <TrendChart
            label="Temperature"
            unit="°C"
            color="#fb923c"
            accent="#fb923c"
            min={0}
            max={100}
            samples={samples}
            hideHeader={hideTitle}
            className={className}
        />
    );
}

export function HumidityTrendChart({ samples, hideTitle, className }: TrendChartWrapperProps) {
    return (
        <TrendChart
            label="Humidity"
            unit="%"
            color="#22d3ee"
            accent="#22d3ee"
            min={0}
            max={100}
            samples={samples}
            hideHeader={hideTitle}
            className={className}
        />
    );
}
