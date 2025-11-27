import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
}

export function GlassCard({ children, className, ...props }: GlassCardProps) {
    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#2a124b]/80 via-[#1b1b3a]/85 to-[#0f1e38]/90 p-6 backdrop-blur-2xl transition-all hover:shadow-2xl hover:shadow-purple-500/30",
                className
            )}
            {...props}
        >
            <div className="absolute -left-16 -top-20 h-48 w-48 rounded-full bg-purple-500/30 blur-3xl" />
            <div className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-blue-500/25 blur-[90px]" />
            <div className="relative z-10">{children}</div>
        </div>
    );
}
