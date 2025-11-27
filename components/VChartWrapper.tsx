"use client";

import dynamic from 'next/dynamic';

export const VChart = dynamic(
    () => import('@visactor/react-vchart').then((mod) => mod.VChart),
    {
        ssr: false,
        loading: () => <div className="w-full h-full flex items-center justify-center text-neutral-500">Loading Chart...</div>
    }
);
