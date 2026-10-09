// Due date for ON-DEMAND webstore orders in Printavo.
//
//   Order placed on a working day           -> due 2 days later
//   Order placed on a weekend or a holiday  -> due 3 days later
//
// Example: Fri Oct 9 2026 -> Sun Oct 11; Sat Oct 10 -> Tue Oct 13;
// Mon Oct 12 (Thanksgiving) -> Thu Oct 15.
//
// Days are Calgary days (America/Edmonton). Holidays are Alberta's general
// holidays; shop-specific closures can be added with the CLOSED_DAYS env var
// (comma-separated YYYY-MM-DD, e.g. "2026-12-24,2026-12-26").
//
// Only on-demand webstore orders use this. Regular, Same Day and bulk webstore
// orders keep their own due-date rules.
//
// Tests: node lib/webstore-due-date.test.mjs

const ymd = (d: Date) => d.toISOString().slice(0, 10); // d is a UTC midnight date

function utcDate(y: number, m: number, d: number): Date {
    return new Date(Date.UTC(y, m - 1, d));
}

/** The n-th given weekday (0=Sun..6=Sat) of a month. */
function nthWeekday(y: number, m: number, weekday: number, n: number): Date {
    const first = utcDate(y, m, 1);
    const offset = (weekday - first.getUTCDay() + 7) % 7;
    return utcDate(y, m, 1 + offset + 7 * (n - 1));
}

/** Easter Sunday (Anonymous Gregorian algorithm). */
function easter(y: number): Date {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return utcDate(y, month, day);
}

/** Alberta general holidays for a year, as YYYY-MM-DD. */
export function albertaHolidays(y: number): Set<string> {
    const goodFriday = easter(y);
    goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);
    const victoria = utcDate(y, 5, 24); // Monday on or before May 24
    victoria.setUTCDate(24 - ((victoria.getUTCDay() + 6) % 7));
    return new Set([
        ymd(utcDate(y, 1, 1)),          // New Year's Day
        ymd(nthWeekday(y, 2, 1, 3)),    // Family Day: 3rd Monday of February
        ymd(goodFriday),                // Good Friday
        ymd(victoria),                  // Victoria Day
        ymd(utcDate(y, 7, 1)),          // Canada Day
        ymd(nthWeekday(y, 9, 1, 1)),    // Labour Day: 1st Monday of September
        ymd(nthWeekday(y, 10, 1, 2)),   // Thanksgiving: 2nd Monday of October
        ymd(utcDate(y, 11, 11)),        // Remembrance Day
        ymd(utcDate(y, 12, 25))         // Christmas Day
    ]);
}

/** Today's date in Calgary as a UTC-midnight Date. */
export function calgaryToday(now: Date): Date {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Edmonton", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(now);
    const get = (t: string) => Number(parts.find(p => p.type === t)!.value);
    return utcDate(get("year"), get("month"), get("day"));
}

export function parseClosedDays(env: unknown): string[] {
    return String(env ?? "").split(",").map(s => s.trim()).filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s));
}

export function isClosedDay(day: Date, extraClosed: string[] = []): boolean {
    const dow = day.getUTCDay();
    const key = ymd(day);
    return dow === 0 || dow === 6 || albertaHolidays(day.getUTCFullYear()).has(key) || extraClosed.includes(key);
}

/** Due date for an on-demand webstore order placed at `now`. */
export function onDemandDueDate(now: Date, extraClosed: string[] = []) {
    const today = calgaryToday(now);
    const daysAdded = isClosedDay(today, extraClosed) ? 3 : 2;
    const due = new Date(today);
    due.setUTCDate(due.getUTCDate() + daysAdded);
    return {
        orderDay: ymd(today),
        dueDay: ymd(due),
        daysAdded,
        // Same M/D/YYYY format the webhook already sends to Printavo
        formatted: `${due.getUTCMonth() + 1}/${due.getUTCDate()}/${due.getUTCFullYear()}`
    };
}
