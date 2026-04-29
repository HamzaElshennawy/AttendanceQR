export function isCurrentSessionTokenValid(args: {
    currentToken: string | null;
    providedToken: string;
    tokenExpiresAt: string | null;
    now?: Date;
}) {
    const now = args.now ?? new Date();

    if (!args.currentToken || args.currentToken !== args.providedToken) {
        return false;
    }

    if (!args.tokenExpiresAt) {
        return false;
    }

    return new Date(args.tokenExpiresAt).getTime() > now.getTime();
}
