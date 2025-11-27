"use client";

import React, { useMemo } from 'react';

interface WaterLevelChartProps {
    level: number; // 0-100
}

export function WaterLevelChart({ level }: WaterLevelChartProps) {
    const normalizedLevel = useMemo(() => {
        if (!Number.isFinite(level)) return 0;
        return Math.max(0, Math.min(100, level));
    }, [level]);

    const isLow = normalizedLevel < 20;
    const fillClass = isLow ? 'from-red-500/80 to-red-500/40' : 'from-blue-500/80 to-blue-500/40';

    return (
        <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6">
                <div className="text-center">
                    <p className="text-sm uppercase tracking-[0.2em] text-neutral-400">Water Level</p>
                    <p className={`text-4xl font-semibold ${isLow ? 'text-red-300' : 'text-blue-200'}`}>
                        {normalizedLevel.toFixed(0)}%
                    </p>
                    <p className="text-sm text-neutral-400">
                        {isLow ? 'Low • Pump Active' : 'Within Safe Range'}
                    </p>
                </div>
                <div className="relative h-40 w-40 overflow-hidden rounded-full border border-white/10 bg-black/30 shadow-inner">
                    <div
                        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t ${fillClass} transition-all duration-500`}
                        style={{ height: `${normalizedLevel}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-sm text-neutral-200">
                            <p className="text-lg font-semibold">{normalizedLevel.toFixed(0)}%</p>
                            <p>{isLow ? 'Refill soon' : 'Stable'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
