// Webstore routing: decides where a Shopify order goes.
//
// A webstore is a collection using the "webstore" theme template. There are
// two kinds, set per collection with the custom.webstore_type metafield:
//
//   Bulk       Orders are saved to Supabase and sent to Printavo as ONE batch
//              order when the store's custom.store_status is set to "closed"
//              (e.g. Alberta Weightlifting Association, pre-orders for an event).
//              An empty webstore_type also means bulk, so stores created
//              before this field existed keep working unchanged.
//
//   On demand  Each order goes straight to Printavo as soon as it is placed,
//              exactly like a regular store order (e.g. Rocky Mountain Lindy
//              Festival). Nothing is saved to Supabase and store_status is not
//              used.
//
// Kept free of network calls so it can be tested on its own:
//   node lib/webstore-routing.test.mjs

export type WebstoreType = "bulk" | "on_demand";

export type OrderRoute = "webstore_batch" | "printavo_now";

/** Reads the custom.webstore_type metafield. Anything mentioning "demand" is on demand; everything else, including empty, is bulk. */
export function parseWebstoreType(value: unknown): WebstoreType {
    const text = String(value ?? "").toLowerCase().replace(/[\s_-]+/g, "");
    return text.includes("demand") ? "on_demand" : "bulk";
}

export function isWebstoreTemplate(templateSuffix: unknown): boolean {
    return String(templateSuffix ?? "").trim().toLowerCase() === "webstore";
}

/** Bulk webstores are batched; on-demand webstores and regular orders go to Printavo now. */
export function routeOrder(templateSuffix: unknown, webstoreType: unknown): OrderRoute {
    if (isWebstoreTemplate(templateSuffix) && parseWebstoreType(webstoreType) === "bulk") {
        return "webstore_batch";
    }
    return "printavo_now";
}

export type CollectionInfo = { id: number | string; templateSuffix: string | null };

/**
 * A product can sit in several collections. Prefer the webstore one so the
 * route does not depend on which collection Shopify happens to list first;
 * otherwise keep the first, as before.
 */
export function pickCollection(collections: CollectionInfo[]): CollectionInfo | null {
    if (!collections.length) return null;
    return collections.find(c => isWebstoreTemplate(c.templateSuffix)) ?? collections[0];
}

/** Printavo v1 line item size field for a size label, or null if Printavo has no field for it. */
export function printavoSizeField(size: unknown): string | null {
    const s = String(size ?? "").trim().toUpperCase();
    const map: Record<string, string> = {
        XS: "size_xs", S: "size_s", M: "size_m", L: "size_l", XL: "size_xl",
        "2XL": "size_2xl", XXL: "size_2xl", "3XL": "size_3xl", "4XL": "size_4xl",
        "5XL": "size_5xl", "6XL": "size_6xl"
    };
    return map[s] ?? null;
}

/** Every size field, all at 0, for a new Printavo line item. */
export function emptySizeFields(): Record<string, number> {
    return {
        size_xs: 0, size_s: 0, size_m: 0, size_l: 0, size_xl: 0,
        size_2xl: 0, size_3xl: 0, size_4xl: 0, size_5xl: 0, size_6xl: 0
    };
}
