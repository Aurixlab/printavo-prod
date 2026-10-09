// Run: node lib/webstore-artwork.test.mjs   (Node 22.6+ loads the .ts module directly)
import test from "node:test";
import assert from "node:assert/strict";
import { pickArtwork, matchPrintavoCategory, mimeTypeFor, colorOptionIndex } from "./webstore-artwork.ts";

const imgs = Array.from({ length: 20 }, (_, i) => `img${i + 1}.png`);
const colours = [{ name: "Color", values: ["Natural", "White", "Light Blue", "Light Pink"] }, { name: "Size", values: ["S", "M"] }];

test("colour blocks: 1st and 2nd image of that colour, image 1 never sent", () => {
    assert.deepEqual(pickArtwork(imgs, colours, "Natural"), ["img2.png", "img3.png"]);
    assert.deepEqual(pickArtwork(imgs, colours, "White"), ["img6.png", "img7.png"]);
    assert.deepEqual(pickArtwork(imgs, colours, "Light Blue"), ["img10.png", "img11.png"]);
    assert.deepEqual(pickArtwork(imgs, colours, "LIGHT PINK"), ["img14.png", "img15.png"]); // batch stores colours upper-case
});

test("no colours, or one colour: images 2 and 3", () => {
    assert.deepEqual(pickArtwork(imgs, [{ name: "Title", values: ["Default Title"] }], null), ["img2.png", "img3.png"]);
    assert.deepEqual(pickArtwork(imgs, [{ name: "Color", values: ["Pitch Black"] }, { name: "Size", values: ["S"] }], "Pitch Black"), ["img2.png", "img3.png"]);
    assert.deepEqual(pickArtwork(imgs, [{ name: "Size", values: ["S", "M"] }], "anything"), ["img2.png", "img3.png"]);
});

test("missing images fall back safely", () => {
    assert.deepEqual(pickArtwork(imgs.slice(0, 6), colours, "Light Blue"), ["img2.png", "img3.png"]); // block not uploaded
    assert.deepEqual(pickArtwork(imgs.slice(0, 2), colours, "Natural"), ["img2.png"]);
    assert.deepEqual(pickArtwork(["only.png"], colours, "Natural"), []);
    assert.deepEqual(pickArtwork(imgs, colours, "Neon Green"), ["img2.png", "img3.png"]); // unknown colour
});

test("colour option name variants", () => {
    assert.equal(colorOptionIndex([{ name: "Size", values: [] }, { name: "Colour", values: [] }]), 1);
    assert.equal(colorOptionIndex([{ name: "Size", values: [] }]), -1);
});

test("Printavo category matching", () => {
    const pv = [{ id: 1, name: "T-Shirts" }, { id: 2, name: "Tote Bag" }, { id: 3, name: "Hoodies" }, { id: 9, name: "Digital Ink Transfer" }];
    assert.equal(matchPrintavoCategory({ name: "T-Shirts", fullName: "Apparel & Accessories > Clothing > Clothing Tops > T-Shirts" }, pv), 1);
    assert.equal(matchPrintavoCategory({ name: "Tote Bags", fullName: "Luggage & Bags > Tote Bags" }, pv), 2); // plural vs singular
    assert.equal(matchPrintavoCategory({ name: "Polos", fullName: "Apparel & Accessories > Clothing > Clothing Tops > Polos" }, pv), null);
    assert.equal(matchPrintavoCategory({ name: "Polos", fullName: "A > Clothing Tops > Polos" }, [{ id: 5, name: "Clothing Tops" }]), 5); // falls back up the path
    assert.equal(matchPrintavoCategory(null, pv), null);
    assert.equal(matchPrintavoCategory({ name: "T-Shirts", fullName: "" }, []), null);
});

test("mime types", () => {
    assert.equal(mimeTypeFor("https://cdn.shopify.com/a/b/Natural_1.png?v=1"), "image/png");
    assert.equal(mimeTypeFor("x.JPG"), "image/jpeg");
    assert.equal(mimeTypeFor("x.webp"), "image/webp");
    assert.equal(mimeTypeFor("noext"), "image/png");
});
