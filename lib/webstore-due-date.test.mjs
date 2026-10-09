// Run: node lib/webstore-due-date.test.mjs   (Node 22.6+ loads the .ts module directly)
import test from "node:test";
import assert from "node:assert/strict";
import { onDemandDueDate, albertaHolidays, isClosedDay, parseClosedDays, calgaryToday } from "./webstore-due-date.ts";

// Noon Calgary (MDT, UTC-6) on a given day
const calgaryNoon = ymd => new Date(`${ymd}T18:00:00Z`);

test("working day: +2 days (the example: Fri Oct 9 -> Oct 11)", () => {
    const r = onDemandDueDate(calgaryNoon("2026-10-09"));
    assert.equal(r.dueDay, "2026-10-11");
    assert.equal(r.daysAdded, 2);
    assert.equal(r.formatted, "10/11/2026");
    assert.equal(onDemandDueDate(calgaryNoon("2026-10-14")).dueDay, "2026-10-16"); // Wednesday
});

test("weekend: +3 days", () => {
    assert.equal(onDemandDueDate(calgaryNoon("2026-10-10")).dueDay, "2026-10-13"); // Saturday
    assert.equal(onDemandDueDate(calgaryNoon("2026-10-11")).dueDay, "2026-10-14"); // Sunday
});

test("holiday: +3 days (Thanksgiving 2026 is Mon Oct 12)", () => {
    const r = onDemandDueDate(calgaryNoon("2026-10-12"));
    assert.equal(r.daysAdded, 3);
    assert.equal(r.dueDay, "2026-10-15");
});

test("Alberta holidays", () => {
    const h = albertaHolidays(2026);
    for (const d of ["2026-01-01", "2026-02-16", "2026-04-03", "2026-05-18", "2026-07-01", "2026-09-07", "2026-10-12", "2026-11-11", "2026-12-25"]) {
        assert.ok(h.has(d), d);
    }
    assert.equal(h.size, 9);
    const h27 = albertaHolidays(2027);
    for (const d of ["2027-02-15", "2027-03-26", "2027-05-24", "2027-09-06", "2027-10-11"]) assert.ok(h27.has(d), d);
});

test("extra closed days from CLOSED_DAYS", () => {
    const extra = parseClosedDays(" 2026-12-24, 2026-12-26 ,bad");
    assert.deepEqual(extra, ["2026-12-24", "2026-12-26"]);
    assert.equal(onDemandDueDate(calgaryNoon("2026-12-24"), extra).daysAdded, 3);
    assert.equal(onDemandDueDate(calgaryNoon("2026-12-23"), extra).daysAdded, 2);
});

test("uses the Calgary date, not UTC", () => {
    // 11:30 PM Friday in Calgary is already Saturday in UTC: still a Friday order
    const lateFriday = new Date("2026-10-10T05:30:00Z");
    assert.equal(calgaryToday(lateFriday).toISOString().slice(0, 10), "2026-10-09");
    assert.equal(onDemandDueDate(lateFriday).dueDay, "2026-10-11");
    assert.equal(isClosedDay(new Date(Date.UTC(2026, 9, 9))), false);
});
