// Run: node lib/webstore-routing.test.mjs   (Node 22.6+ loads the .ts module directly)
import test from "node:test";
import assert from "node:assert/strict";
import {
    parseWebstoreType,
    routeOrder,
    pickCollection,
    printavoSizeField,
    emptySizeFields
} from "./webstore-routing.ts";

test("webstore type: empty and unknown values are bulk, so existing stores keep working", () => {
    for (const v of [null, undefined, "", "Bulk", "bulk production", "anything"]) {
        assert.equal(parseWebstoreType(v), "bulk", String(v));
    }
});

test("webstore type: on demand spellings", () => {
    for (const v of ["On demand", "on_demand", "On-Demand", "ON DEMAND", "Print on demand"]) {
        assert.equal(parseWebstoreType(v), "on_demand", v);
    }
});

test("routing", () => {
    assert.equal(routeOrder("webstore", null), "webstore_batch");          // AWA today
    assert.equal(routeOrder("webstore", "Bulk"), "webstore_batch");
    assert.equal(routeOrder("Webstore", "On demand"), "printavo_now");     // RMLF
    assert.equal(routeOrder(null, null), "printavo_now");                  // regular store order
    assert.equal(routeOrder("", "On demand"), "printavo_now");
    assert.equal(routeOrder("industry", null), "printavo_now");
});

test("collection choice prefers the webstore collection", () => {
    assert.equal(pickCollection([]), null);
    assert.deepEqual(pickCollection([{ id: 1, templateSuffix: null }, { id: 2, templateSuffix: "webstore" }]), { id: 2, templateSuffix: "webstore" });
    assert.deepEqual(pickCollection([{ id: 1, templateSuffix: null }, { id: 3, templateSuffix: "" }]), { id: 1, templateSuffix: null });
});

test("batch sizes include XS and 3XL+", () => {
    assert.equal(printavoSizeField("XS"), "size_xs");
    assert.equal(printavoSizeField("3XL"), "size_3xl");
    assert.equal(printavoSizeField("xxl"), "size_2xl");
    assert.equal(printavoSizeField("UNKNOWN"), null);
    const fields = emptySizeFields();
    for (const f of ["size_xs", "size_3xl", "size_4xl", "size_5xl", "size_6xl"]) assert.equal(fields[f], 0);
});
