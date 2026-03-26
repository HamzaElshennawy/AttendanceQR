"use client";

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type DialogVariant = "info" | "error" | "warning";

interface AlertOptions {
    title: string;
    description?: string;
    actionLabel?: string;
    variant?: DialogVariant;
}

interface ConfirmOptions {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: DialogVariant;
}

interface DialogState {
    mode: "alert" | "confirm";
    title: string;
    description?: string;
    actionLabel: string;
    cancelLabel?: string;
    variant: DialogVariant;
}

interface AppDialogContextValue {
    showAlert: (options: AlertOptions) => Promise<void>;
    showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const AppDialogContext = createContext<AppDialogContextValue | null>(null);

function getActionButtonVariant(variant: DialogVariant) {
    return variant === "error" ? "destructive" : "default";
}

export function AppDialogProvider({ children }: { children: ReactNode }) {
    const [dialog, setDialog] = useState<DialogState | null>(null);
    const resolverRef = useRef<((value?: boolean) => unknown) | null>(null);

    const closeDialog = useCallback((result?: boolean) => {
        resolverRef.current?.(result);
        resolverRef.current = null;
        setDialog(null);
    }, []);

    const showAlert = useCallback((options: AlertOptions) => {
        return new Promise<void>((resolve) => {
            resolverRef.current = () => resolve();
            setDialog({
                mode: "alert",
                title: options.title,
                description: options.description,
                actionLabel: options.actionLabel || "OK",
                variant: options.variant || "info",
            });
        });
    }, []);

    const showConfirm = useCallback((options: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            resolverRef.current = (value) => resolve(Boolean(value));
            setDialog({
                mode: "confirm",
                title: options.title,
                description: options.description,
                actionLabel: options.confirmLabel || "Confirm",
                cancelLabel: options.cancelLabel || "Cancel",
                variant: options.variant || "warning",
            });
        });
    }, []);

    const value = useMemo(
        () => ({ showAlert, showConfirm }),
        [showAlert, showConfirm],
    );

    return (
        <AppDialogContext.Provider value={value}>
            {children}
            <Dialog
                open={Boolean(dialog)}
                onOpenChange={(open) => {
                    if (!open && dialog) {
                        closeDialog(dialog.mode === "confirm" ? false : undefined);
                    }
                }}
            >
                <DialogContent
                    className="max-w-md"
                    showCloseButton={false}
                >
                    {dialog && (
                        <>
                            <DialogHeader>
                                <DialogTitle>{dialog.title}</DialogTitle>
                                {dialog.description && (
                                    <DialogDescription>
                                        {dialog.description}
                                    </DialogDescription>
                                )}
                            </DialogHeader>
                            <DialogFooter>
                                {dialog.mode === "confirm" && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => closeDialog(false)}
                                    >
                                        {dialog.cancelLabel}
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    variant={getActionButtonVariant(dialog.variant)}
                                    onClick={() =>
                                        closeDialog(
                                            dialog.mode === "confirm"
                                                ? true
                                                : undefined,
                                        )
                                    }
                                >
                                    {dialog.actionLabel}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </AppDialogContext.Provider>
    );
}

export function useAppDialog() {
    const context = useContext(AppDialogContext);

    if (!context) {
        throw new Error("useAppDialog must be used within AppDialogProvider.");
    }

    return context;
}
