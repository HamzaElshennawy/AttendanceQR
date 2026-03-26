export interface ImportedSpreadsheet {
    headers: string[];
    rows: string[][];
}

function normalizeHeaders(headers: string[]) {
    return headers.map((header, index) => header || `Column ${index + 1}`);
}

function stringifyCellValue(value: unknown): string {
    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "string" || typeof value === "number") {
        return String(value).trim();
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (typeof value === "object") {
        if ("text" in value && typeof value.text === "string") {
            return value.text.trim();
        }

        if ("result" in value) {
            return stringifyCellValue(
                (value as { result?: unknown }).result,
            );
        }

        if ("richText" in value && Array.isArray(value.richText)) {
            return value.richText
                .map((item) =>
                    typeof item === "object" &&
                    item !== null &&
                    "text" in item &&
                    typeof item.text === "string"
                        ? item.text
                        : "",
                )
                .join("")
                .trim();
        }
    }

    return String(value).trim();
}

export async function readSpreadsheetFile(
    file: File,
): Promise<ImportedSpreadsheet> {
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith(".csv")) {
        const Papa = (await import("papaparse")).default;

        return await new Promise<ImportedSpreadsheet>((resolve, reject) => {
            Papa.parse<string[]>(file, {
                skipEmptyLines: true,
                complete: (results) => {
                    const rows = (results.data || [])
                        .map((row) => row.map((cell) => (cell || "").trim()))
                        .filter((row) => row.some((cell) => cell));

                    resolve({
                        headers: normalizeHeaders(rows[0] || []),
                        rows: rows.slice(1),
                    });
                },
                error: (error) => reject(error),
            });
        });
    }

    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
        return { headers: [], rows: [] };
    }

    const rows: string[][] = [];
    const maxColumnCount = worksheet.rowCount
        ? Math.max(
              ...Array.from({ length: worksheet.rowCount }, (_, index) =>
                  worksheet.getRow(index + 1).cellCount,
              ),
              0,
          )
        : 0;

    for (let rowIndex = 1; rowIndex <= worksheet.rowCount; rowIndex += 1) {
        const row = worksheet.getRow(rowIndex);
        const values: string[] = [];

        for (
            let columnIndex = 1;
            columnIndex <= maxColumnCount;
            columnIndex += 1
        ) {
            values.push(
                stringifyCellValue(row.getCell(columnIndex)?.value),
            );
        }

        rows.push(values);
    }

    const filteredRows = rows.filter((row) => row.some((cell) => cell));

    return {
        headers: normalizeHeaders(filteredRows[0] || []),
        rows: filteredRows.slice(1),
    };
}
