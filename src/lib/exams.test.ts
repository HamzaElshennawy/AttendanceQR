import test from "node:test";
import assert from "node:assert/strict";

import {
    buildAttemptPresentation,
    isClientReportableEvent,
    redactAnswerGrading,
    type AttemptAnswer,
    type ExamQuestionSnapshot,
} from "@/lib/exams";

function answer(overrides: Partial<AttemptAnswer> = {}): AttemptAnswer {
    return {
        attempt_id: "attempt-1",
        question_id: "question-1",
        answer_text: "Paris",
        selected_choice_ids: ["choice-2"],
        is_correct: true,
        awarded_points: 5,
        needs_manual_review: true,
        ...overrides,
    };
}

test("redaction removes the marking but keeps the student's own work", () => {
    const [redacted] = redactAnswerGrading([answer()]);

    assert.equal(redacted.is_correct, null);
    assert.equal(redacted.awarded_points, null);
    assert.equal(redacted.needs_manual_review, false);

    // Their answer is theirs — the page redisplays it.
    assert.equal(redacted.answer_text, "Paris");
    assert.deepEqual(redacted.selected_choice_ids, ["choice-2"]);
    assert.equal(redacted.question_id, "question-1");
});

test("redaction hides a wrong answer as thoroughly as a right one", () => {
    // Leaking `is_correct: false` is exactly as useful to a student on their
    // second attempt as leaking `true`.
    const [redacted] = redactAnswerGrading([
        answer({ is_correct: false, awarded_points: 0 }),
    ]);

    assert.equal(redacted.is_correct, null);
    assert.equal(redacted.awarded_points, null);
});

test("redaction does not mutate the input", () => {
    const original = answer();
    redactAnswerGrading([original]);

    assert.equal(original.is_correct, true);
    assert.equal(original.awarded_points, 5);
});

test("questions sent to a student carry no answer key", () => {
    const questions: ExamQuestionSnapshot[] = [
        {
            id: "question-1",
            assessment_id: "assessment-1",
            prompt: "Capital of France?",
            description: null,
            question_type: "multiple_choice",
            points: 5,
            position: 0,
            is_required: true,
            is_published: true,
            answer_text: "Paris",
            choices: [
                {
                    id: "choice-1",
                    question_id: "question-1",
                    label: "Lyon",
                    position: 0,
                    is_correct: false,
                },
                {
                    id: "choice-2",
                    question_id: "question-1",
                    label: "Paris",
                    position: 1,
                    is_correct: true,
                },
            ],
        },
    ];

    const presented = buildAttemptPresentation({
        questions,
        questionOrder: ["question-1"],
        choiceOrder: { "question-1": ["choice-2", "choice-1"] },
    });

    // Serialized, because the risk is what reaches the browser — a field the
    // type does not declare but the object still carries would ship anyway.
    const wire = JSON.stringify(presented);

    assert.equal(wire.includes("is_correct"), false);
    assert.equal(wire.includes("answer_text"), false);

    // The question itself still arrives intact, in the attempt's own order.
    assert.equal(presented[0].prompt, "Capital of France?");
    assert.deepEqual(
        presented[0].choices.map((choice) => choice.label),
        ["Paris", "Lyon"],
    );
});

test("a student's browser cannot forge server-authored proctoring events", () => {
    // These are written by the server when it observes the thing itself. A
    // client that could assert them could fake a submission or erase the
    // meaning of a duplicate-session flag.
    for (const forged of [
        "started",
        "submitted",
        "timed_out",
        "duplicate_session_detected",
    ]) {
        assert.equal(
            isClientReportableEvent(forged),
            false,
            `${forged} must not be client-reportable`,
        );
    }
});

test("the events a browser genuinely reports are still accepted", () => {
    for (const reported of [
        "autosaved",
        "tab_hidden",
        "window_blur",
        "refresh",
        "reconnected",
    ]) {
        assert.equal(isClientReportableEvent(reported), true);
    }
});

test("arbitrary event names are rejected", () => {
    assert.equal(isClientReportableEvent(""), false);
    assert.equal(isClientReportableEvent("constructor"), false);
    assert.equal(isClientReportableEvent("__proto__"), false);
    assert.equal(isClientReportableEvent("tab_hidden "), false);
});
