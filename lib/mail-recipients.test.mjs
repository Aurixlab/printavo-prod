// Run: node lib/mail-recipients.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { NORMAL_MAIL_TO, ERROR_MAIL_TO } from "./mail-recipients.ts";

test("normal mail goes to AurixLab and Merch Express", () => {
    assert.deepEqual(NORMAL_MAIL_TO, ["aurixlab@gmail.com", "hello@merchexpresscanada.ca"]);
});

test("error mail goes to AurixLab only", () => {
    assert.deepEqual(ERROR_MAIL_TO, ["aurixlab@gmail.com"]);
});

test("every email in the app reads its recipients from mail-recipients (no address typed into a send call)", () => {
    const files = {
        "lib/store-close-summary/route.ts": "NORMAL_MAIL_TO",
        "lib/store-resume-summary/route.ts": "NORMAL_MAIL_TO",
        "app/api/weekly-summary/route.ts": "NORMAL_MAIL_TO",
        "lib/store-close-alert.ts": "ERROR_MAIL_TO"
    };
    for (const [file, list] of Object.entries(files)) {
        const src = fs.readFileSync(new URL("../" + file, import.meta.url), "utf8");
        assert.ok(src.includes("to: " + list), `${file} should send to ${list}`);
        assert.doesNotMatch(src.replace(/^\s*\/\/.*$/gm, ""), /to:\s*["'][^"']+@/, `${file} has a typed-in address`);
    }
});
