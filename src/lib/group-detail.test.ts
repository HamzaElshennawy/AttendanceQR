import test from "node:test";
import assert from "node:assert/strict";

import {
    getWeekdayLabel,
    normalizeImportedAttendanceStatus,
} from "@/lib/group-detail";

test("recognises the many ways instructors write 'present'", () => {
    for (const value of [
        "present",
        "P",
        "attended",
        "yes",
        "Y",
        "1",
        "true",
        "  Present  ",
    ]) {
        assert.equal(
            normalizeImportedAttendanceStatus(value),
            "present",
            `${JSON.stringify(value)} should be present`,
        );
    }
});

test("recognises late and excused", () => {
    assert.equal(normalizeImportedAttendanceStatus("late"), "late");
    assert.equal(normalizeImportedAttendanceStatus("L"), "late");
    assert.equal(normalizeImportedAttendanceStatus("excused"), "excused");
    assert.equal(normalizeImportedAttendanceStatus("excuse"), "excused");
    assert.equal(normalizeImportedAttendanceStatus("E"), "excused");
});

test("absence and unknown values both produce no record", () => {
    // Absence is the absence of a record, so neither creates one — but it
    // matters that "0" and "false" are not mistaken for anything positive.
    for (const value of ["absent", "a", "0", "false", "no", "n"]) {
        assert.equal(
            normalizeImportedAttendanceStatus(value),
            null,
            `${JSON.stringify(value)} should be absent`,
        );
    }

    assert.equal(normalizeImportedAttendanceStatus("maybe"), null);
    assert.equal(normalizeImportedAttendanceStatus(""), null);
    assert.equal(normalizeImportedAttendanceStatus("   "), null);
    assert.equal(normalizeImportedAttendanceStatus(undefined), null);
});

test("weekday labels cover the week and fall back safely", () => {
    assert.equal(getWeekdayLabel(0), "Sunday");
    assert.equal(getWeekdayLabel(3), "Wednesday");
    assert.equal(getWeekdayLabel(6), "Saturday");
    assert.equal(getWeekdayLabel(9), "Weekly");
    assert.equal(getWeekdayLabel(-1), "Weekly");
});
