// Run: node lib/store-close-details.test.mjs   (Node 22.6+ loads the .ts modules directly)
import test from "node:test";
import assert from "node:assert/strict";
import { printavoSizeField, emptySizeFields } from "./webstore-routing.ts";
import { customizationKey, customizationLabel, rowCustomization } from "./webstore-customization.ts";
import { groupBatchLines, buildCustomers, formatCustomerNotes } from "./store-close-details.ts";

const deps = { printavoSizeField, emptySizeFields, rowCustomization, customizationKey, customizationLabel };
const row = (o) => ({ product_id: 1, product_name: "Tee", color: "BLACK", size: "M", quantity: 1, price: "30.00", ...o });

test("same product, colour and price share one line, sizes add up", () => {
    const lines = groupBatchLines([row({ size: "S" }), row({ size: "M" }), row({ size: "M", quantity: 2 })], deps);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].sizes.size_s, 1);
    assert.equal(lines[0].sizes.size_m, 3);
    assert.equal(lines[0].unit_cost, 30);
});

test("a different price is its own line (2XL at $35 is not billed at $30)", () => {
    const lines = groupBatchLines([row({ size: "M" }), row({ size: "2XL", price: "35.00" }), row({ size: "2XL", price: "35.00" })], deps);
    assert.equal(lines.length, 2);
    const big = lines.find(l => l.unit_cost === 35);
    assert.equal(big.sizes.size_2xl, 2);
    assert.equal(lines.find(l => l.unit_cost === 30).sizes.size_m, 1);
});

test("order of the rows does not change the result", () => {
    const rows = [row({ size: "2XL", price: "35.00" }), row({ size: "M" }), row({ size: "L" })];
    const a = groupBatchLines(rows, deps).map(l => [l.unit_cost, JSON.stringify(l.sizes)]).sort();
    const b = groupBatchLines([...rows].reverse(), deps).map(l => [l.unit_cost, JSON.stringify(l.sizes)]).sort();
    assert.deepEqual(a, b);
});

test("different products and colours stay apart; every unit is counted", () => {
    const rows = [row(), row({ product_id: 2 }), row({ color: "RED" }), row({ size: "XS", quantity: 4 })];
    const lines = groupBatchLines(rows, deps);
    assert.equal(lines.length, 3);
    const units = lines.reduce((n, l) => n + Object.values(l.sizes).reduce((a, b) => a + b, 0), 0);
    assert.equal(units, 7);
});

test("a size Printavo has no field for is reported, never dropped silently", () => {
    const lines = groupBatchLines([row({ size: "YOUTH M" })], deps);
    assert.deepEqual(lines[0].unmapped, ["YOUTH M x1"]);
});

test("personalized items get their own line with what to print", () => {
    const lines = groupBatchLines([row(), row({ customization: "Text + Number", custom_text: "ALEX", custom_number: "12" })], deps);
    assert.equal(lines.length, 2);
    assert.match(lines.find(l => l.description.includes("ALEX")).description, /Text: ALEX \| Number: 12/);
});

const orders = [
    { id: "a", shopify_order_id: 11, order_number: 1002, customer_name: "Db Name", email: "db@x.ca", phone: null, city: "Calgary", zip: "T2", country: "Canada" },
    { id: "b", shopify_order_id: 12, order_number: 1001, customer_name: "Other Person", email: "o@x.ca", phone: "+1403", city: "Edmonton", zip: "T5", country: "Canada" },
    { id: "c", shopify_order_id: 13, order_number: 1003, customer_name: "Cancelled One", email: "c@x.ca", phone: null }
];
const items = [
    { order_id: "a", product_name: "Tee", color: "BLACK", size: "M", quantity: 1 },
    { order_id: "a", product_name: "Tee", color: "BLACK", size: "L", quantity: 2 },
    { order_id: "b", product_name: "Tee", color: "BLACK", size: "S", quantity: 1 },
    { order_id: "c", product_name: "Tee", color: "BLACK", size: "S", quantity: 1 }
];

test("customers: Shopify details win, database fills the gaps, sorted by order number", () => {
    const shop = { 11: { email: "shop@x.ca", phone: "+1587", shippingAddress: { name: "Ship Name", address1: "1 Main St", city: "Calgary", province: "Alberta", zip: "T2", country: "Canada" }, note: "Please wrap" },
                   13: { cancelledAt: "2026-11-01T00:00:00Z", displayFinancialStatus: "VOIDED" } };
    const all = buildCustomers(orders, items, shop, deps);
    assert.deepEqual(all.map(c => c.orderNumber), [1001, 1002, 1003]);
    const a = all.find(c => c.orderNumber === 1002);
    assert.equal(a.name, "Ship Name");
    assert.equal(a.email, "shop@x.ca");
    assert.equal(a.phone, "+1587");
    assert.match(a.delivery, /1 Main St/);
    assert.equal(a.note, "Please wrap");
    assert.equal(a.items.length, 2);
    const b = all.find(c => c.orderNumber === 1001);   // no Shopify data: the database's details are used
    assert.equal(b.email, "o@x.ca");
    assert.equal(b.delivery, "Edmonton, T5, Canada");
    assert.equal(all.find(c => c.orderNumber === 1003).cancelled, true);
});

test("notes list every customer once and say what was left out", () => {
    const all = buildCustomers(orders, items, { 13: { cancelledAt: "x" } }, deps);
    const keep = all.filter(c => !c.cancelled), out = all.filter(c => c.cancelled);
    const notes = formatCustomerNotes("Test Store", keep, out);
    assert.match(notes, /2 orders, 4 items/);
    assert.match(notes, /#1001 \| Other Person/);
    assert.match(notes, /#1002 \| Db Name/);
    assert.match(notes, /NOT INCLUDED \(cancelled in Shopify\): #1003 Cancelled One/);
    assert.equal((notes.match(/^#\d+ \|/gm) || []).length, 2);
});
