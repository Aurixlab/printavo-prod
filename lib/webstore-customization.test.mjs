// Run: node lib/webstore-customization.test.mjs   (Node 22.6+ loads the .ts module directly)
import test from "node:test";
import assert from "node:assert/strict";
import {
    isCustomizationValue,
    lineCustomization,
    hasCustomization,
    customizationLabel,
    customizationKey,
    customizationColumns,
    rowCustomization
} from "./webstore-customization.ts";

test("customization values are recognised, colours and sizes are not", () => {
    for (const v of ["None", "Text Only", "Number Only", "Text + Number", "TEXT + NUMBER", "Name + Number", "Text & Number", "Name Only", "text and number"]) {
        assert.equal(isCustomizationValue(v), true, v);
    }
    for (const v of ["Bone", "Onyx", "Scarlet Red", "Antique White", "Black", "S", "2XL", "", null, "Navy Text Print"]) {
        assert.equal(isCustomizationValue(v), false, String(v));
    }
});

test("plain items (every existing webstore) have no customization", () => {
    const plain = [
        { variant_title: "Bone / S", properties: [] },
        { variant_title: "Black / XL" },
        { variant_title: "M", properties: [{ name: "Pickup", value: "Ready for pickup at the AWA event" }] },
        { variant_title: "Bone / S / None", properties: [] }
    ];
    for (const item of plain) {
        const c = lineCustomization(item);
        assert.equal(hasCustomization(c), false, item.variant_title);
        assert.equal(customizationLabel(c), "");
        assert.equal(customizationKey(c), "");
        assert.deepEqual(customizationColumns(c), {});
    }
});

test("personalized item", () => {
    const c = lineCustomization({
        variant_title: "Scarlet Red / 2XL / Text + Number",
        properties: [{ name: "Custom Text", value: " ALEX " }, { name: "Custom Number", value: "07" }]
    });
    assert.deepEqual(c, { level: "Text + Number", text: "ALEX", number: "07" });
    assert.equal(customizationLabel(c), "Customization: Text + Number | Text: ALEX | Number: 07");
    assert.deepEqual(customizationColumns(c), { customization: "Text + Number", custom_text: "ALEX", custom_number: "07" });
    assert.deepEqual(rowCustomization(customizationColumns(c)), c);
});

test("variant_options are used when present", () => {
    const c = lineCustomization({ variant_options: ["Onyx", "M", "Number Only"], properties: [{ name: "Custom Number", value: "9" }] });
    assert.deepEqual(c, { level: "Number Only", text: null, number: "9" });
});

test("different text or number never share a Printavo line", () => {
    const a = lineCustomization({ variant_title: "Bone / S / Text Only", properties: [{ name: "Custom Text", value: "ALEX" }] });
    const b = lineCustomization({ variant_title: "Bone / S / Text Only", properties: [{ name: "Custom Text", value: "SAM" }] });
    assert.notEqual(customizationKey(a), customizationKey(b));
});

test("old rows read back as plain", () => {
    assert.equal(hasCustomization(rowCustomization({ color: "BONE", size: "S" })), false);
});
