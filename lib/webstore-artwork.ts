// Webstore artwork, item # and category for Printavo line items.
//
// Pure rules only (no network), so they can be tested on their own:
//   node lib/webstore-artwork.test.mjs
//
// ARTWORK follows the same image rule as the webstore product page
// (sections/product-webstore-template.liquid in the Shopify theme):
//   - image 1 of the product's media is the store card thumbnail, never sent
//   - colour N (0-based, in the order of the Color option's values) owns
//     images 2+4N to 5+4N; its 1st and 2nd image are sent
//   - no Color option, or one colour: images 2 and 3
//
// CATEGORY is the product's Shopify category (e.g. "T-Shirts"), matched by
// name to one of the Printavo account's categories. Most specific name
// first, then up the Shopify category path ("Clothing Tops", "Clothing"...).

export type ProductOption = { name: string; values: string[] };
export type ShopifyCategory = { name: string; fullName: string } | null;
export type PrintavoCategory = { id: string | number; name: string };

function norm(value: unknown): string {
    return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function colorOptionIndex(options: ProductOption[]): number {
    return options.findIndex(o => /^colou?r$/i.test(String(o.name).trim()));
}

/** The two artwork image URLs for a product + colour (see header). */
export function pickArtwork(images: string[], options: ProductOption[], colorValue: unknown): string[] {
    const ci = colorOptionIndex(options);
    let block = 0;
    if (ci >= 0 && colorValue) {
        const pos = options[ci].values.findIndex(v => norm(v) === norm(colorValue));
        if (pos >= 0) block = pos;
    }
    const start = 1 + 4 * block;
    const picks = images.slice(start, start + 2);
    // A colour whose images were never uploaded falls back to images 2-3
    return picks.length ? picks : images.slice(1, 3);
}

/** Printavo category id for a Shopify category, or null when nothing matches. */
export function matchPrintavoCategory(category: ShopifyCategory, printavo: PrintavoCategory[]): PrintavoCategory["id"] | null {
    if (!category || !printavo.length) return null;
    const singular = (s: string) => s.replace(/s$/, "");
    const candidates = [category.name, ...String(category.fullName || "").split(">").map(s => s.trim()).reverse()]
        .filter(Boolean)
        .map(c => singular(norm(c)));
    for (const c of candidates) {
        const hit = printavo.find(p => singular(norm(p.name)) === c);
        if (hit) return hit.id;
    }
    return null;
}

export function mimeTypeFor(url: string): string {
    const ext = (String(url).split("?")[0].split(".").pop() || "").toLowerCase();
    const map: Record<string, string> = {
        png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
        gif: "image/gif", svg: "image/svg+xml", pdf: "application/pdf"
    };
    return map[ext] || "image/png";
}
