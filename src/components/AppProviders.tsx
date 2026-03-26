"use client";

import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AppDialogProvider } from "@/components/AppDialogProvider";

export function AppProviders({ children }: { children: ReactNode }) {
    return (
        <AppDialogProvider>
            {children}
            <Toaster />
        </AppDialogProvider>
    );
}
