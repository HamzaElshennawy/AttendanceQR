import { NextResponse } from "next/server";
import { requireGroupAccess } from "@/lib/group-access";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ groupId: string }> },
) {
    const { groupId } = await params;
    const access = await requireGroupAccess(groupId);

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { categories, persistedIds } = await request.json();

    if (!Array.isArray(categories) || categories.length === 0) {
        return NextResponse.json(
            { error: "At least one category is required." },
            { status: 400 },
        );
    }

    const normalizedRows = categories.map((category, index) => ({
        id: String(category.id || ""),
        group_id: groupId,
        name: String(category.name || "").trim(),
        weight: Number(category.weight || 0),
        included_kinds: Array.isArray(category.included_kinds)
            ? category.included_kinds.map((kind: unknown) => String(kind))
            : [],
        include_attendance: Boolean(category.include_attendance),
        aggregation: String(category.aggregation || "weighted_sum"),
        aggregation_limit:
            category.aggregation === "best_n" ||
            category.aggregation === "drop_lowest"
                ? Math.max(1, Number(category.aggregation_limit || 1))
                : null,
        position: index,
        updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabaseAdmin
        .from("group_coursework_categories")
        .upsert(normalizedRows, { onConflict: "id" });

    if (upsertError) {
        return NextResponse.json(
            { error: upsertError.message },
            { status: 500 },
        );
    }

    const idsToDelete = Array.isArray(persistedIds)
        ? persistedIds
              .map((id) => String(id || ""))
              .filter(
                  (id) => id && !normalizedRows.some((row) => row.id === id),
              )
        : [];

    if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabaseAdmin
            .from("group_coursework_categories")
            .delete()
            .in("id", idsToDelete);

        if (deleteError) {
            return NextResponse.json(
                { error: deleteError.message },
                { status: 500 },
            );
        }
    }

    return NextResponse.json({ success: true });
}
