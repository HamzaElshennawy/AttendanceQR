"use client";

import { usePathname } from "next/navigation";
import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";

export function AuthCardTransition({
    children,
}: {
    children: ReactNode;
}) {
    const pathname = usePathname();
    const contentRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number | null>(null);
    const [contentKey, setContentKey] = useState(pathname);
    const [contentVisible, setContentVisible] = useState(true);

    useLayoutEffect(() => {
        if (!contentRef.current) return;
        setHeight(contentRef.current.offsetHeight);
    }, []);

    useEffect(() => {
        if (!contentRef.current) return;

        let showFrame = 0;
        const hideFrame = window.requestAnimationFrame(() => {
            setContentVisible(false);

            showFrame = window.requestAnimationFrame(() => {
                setContentKey(pathname);

                window.requestAnimationFrame(() => {
                    if (!contentRef.current) return;
                    setHeight(contentRef.current.offsetHeight);
                    setContentVisible(true);
                });
            });
        });

        return () => {
            window.cancelAnimationFrame(hideFrame);
            window.cancelAnimationFrame(showFrame);
        };
    }, [pathname]);

    useEffect(() => {
        if (!contentRef.current) return;

        const element = contentRef.current;
        const observer = new ResizeObserver(() => {
            setHeight(element.offsetHeight);
        });

        observer.observe(element);
        return () => observer.disconnect();
    }, [contentKey]);

    return (
        <div
            className="overflow-hidden rounded-[28px] transition-[height,box-shadow,transform] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={height ? { height } : undefined}
        >
            <div
                key={contentKey}
                ref={contentRef}
                className={`origin-top transition-[opacity,transform,filter] duration-300 ease-out ${
                    contentVisible
                        ? "translate-y-0 scale-100 opacity-100 blur-0"
                        : "translate-y-2 scale-[0.985] opacity-0 blur-[1px]"
                }`}
            >
                {children}
            </div>
        </div>
    );
}
