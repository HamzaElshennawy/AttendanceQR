import React from "react";

export function QuorumIcon({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 400 400"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <circle
                cx="160"
                cy="200"
                r="100"
                stroke="currentColor"
                strokeWidth="45"
            />
            <path
                d="M180 240 L240 300 L340 180"
                stroke="currentColor"
                strokeWidth="45"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function QuorumLogo({
    className,
    textClassName,
}: {
    className?: string;
    textClassName?: string;
}) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <QuorumIcon className="h-full w-auto" />
            <span className={`font-bold tracking-tight ${textClassName}`}>
                Quorum
            </span>
        </div>
    );
}
