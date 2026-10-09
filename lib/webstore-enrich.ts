// Adds artwork, item # and category to webstore line items before they go to
// Printavo. Used by the on-demand webhook (app/api/webhooks/shopify/
// order-created) and the bulk batch (lib/printavo-store-close).
//
// Never blocks an order: any failure here is logged and the line item is
// sent without the extras, exactly as before this existed.
//
// Sources (Shopify product):
//   artwork  -> product media, picked by lib/webstore-artwork.ts pickArtwork()
//   item #   -> custom.product_style_number metafield ("Product Style Number")
//   category -> the product's Shopify category ("T-Shirts"), matched by name
//               to a Printavo category

import fetch from "node-fetch";
import {
    PrintavoCategory,
    ProductOption,
    ShopifyCategory,
    matchPrintavoCategory,
    mimeTypeFor,
    pickArtwork,
    colorOptionIndex
} from "@/lib/webstore-artwork";

export type ProductInfo = {
    images: string[];
    options: ProductOption[];
    variantColors: Record<string, string>;
    category: ShopifyCategory;
    styleNumber: string | null;
};

export type EnrichCache = {
    products: Map<string, Promise<ProductInfo | null>>;
    printavoCategories: Promise<PrintavoCategory[]> | null;
};

export function newEnrichCache(): EnrichCache {
    return { products: new Map(), printavoCategories: null };
}

const PRODUCT_QUERY = `
query WebstoreProduct($id: ID!) {
  product(id: $id) {
    category { name fullName }
    styleNumber: metafield(namespace: "custom", key: "product_style_number") { value }
    options { name values }
    images(first: 100) { nodes { url } }
    variants(first: 250) { nodes { legacyResourceId selectedOptions { name value } } }
  }
}`;

export async function fetchProductInfo(productId: string | number): Promise<ProductInfo | null> {
    const res = await fetch(`https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2025-07/graphql.json`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN!
        },
        body: JSON.stringify({ query: PRODUCT_QUERY, variables: { id: `gid://shopify/Product/${productId}` } })
    });
    const data: any = await res.json();
    const p = data?.data?.product;
    if (!p) {
        console.warn("Webstore enrich: product not found", productId, JSON.stringify(data?.errors || "").slice(0, 300));
        return null;
    }
    const options: ProductOption[] = p.options || [];
    const ci = colorOptionIndex(options);
    const colorName = ci >= 0 ? options[ci].name : null;
    const variantColors: Record<string, string> = {};
    for (const v of p.variants?.nodes || []) {
        const c = colorName && (v.selectedOptions || []).find((o: any) => o.name === colorName);
        if (c) variantColors[String(v.legacyResourceId)] = c.value;
    }
    return {
        images: (p.images?.nodes || []).map((n: any) => n.url),
        options,
        variantColors,
        category: p.category || null,
        styleNumber: p.styleNumber?.value?.trim() || null
    };
}

/** All categories on the Printavo account (v2 API, same call the Same Day mapping uses). */
export async function fetchPrintavoCategories(token: string): Promise<PrintavoCategory[]> {
    const res = await fetch("https://www.printavo.com/api/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json", email: "aurixlab@gmail.com", token },
        body: JSON.stringify({ query: "query { account { categories(first: 100) { nodes { id name } } } }" })
    });
    if (!res.ok) throw new Error(`Printavo categories HTTP ${res.status}`);
    const data: any = await res.json();
    if (data.errors?.length) throw new Error(`Printavo categories: ${data.errors[0].message}`);
    return data.data?.account?.categories?.nodes || [];
}

export type LineExtras = {
    style_number?: string;
    category_id?: PrintavoCategory["id"];
    images: { file_url: string; mime_type: string }[];
};

/**
 * Extras for one Printavo line item. Pass the Shopify variant id when known
 * (webhook); otherwise the colour text (batch, where colours are stored
 * upper-case).
 */
export async function webstoreLineExtras(
    args: { productId: string | number; variantId?: string | number | null; colorText?: string | null },
    token: string,
    cache: EnrichCache
): Promise<LineExtras> {
    const extras: LineExtras = { images: [] };
    try {
        const key = String(args.productId);
        if (!cache.products.has(key)) cache.products.set(key, fetchProductInfo(args.productId));
        const info = await cache.products.get(key)!;
        if (!info) return extras;

        const colour = (args.variantId != null && info.variantColors[String(args.variantId)]) || args.colorText || null;
        extras.images = pickArtwork(info.images, info.options, colour).map(url => ({ file_url: url, mime_type: mimeTypeFor(url) }));
        if (info.styleNumber) extras.style_number = info.styleNumber;

        if (info.category) {
            if (!cache.printavoCategories) {
                cache.printavoCategories = fetchPrintavoCategories(token).catch(err => {
                    console.error("Webstore enrich: Printavo categories failed:", err.message);
                    return [];
                });
            }
            const id = matchPrintavoCategory(info.category, await cache.printavoCategories);
            if (id != null) extras.category_id = id;
            else console.warn(`Webstore enrich: no Printavo category named like "${info.category.name}" (${info.category.fullName})`);
        }
        console.log(`Webstore enrich: product ${key} colour ${colour || "-"} -> ${extras.images.length} artwork, item# ${extras.style_number || "-"}, category ${extras.category_id ?? "-"}`);
    } catch (err: any) {
        console.error("Webstore enrich failed (sending without extras):", err?.message || err);
    }
    return extras;
}

/** Merge extras into a Printavo line item without overwriting values it already has. */
export function applyExtras(line: any, extras: LineExtras) {
    if (extras.style_number && !line.style_number) line.style_number = extras.style_number;
    if (extras.category_id != null && line.category_id == null) line.category_id = extras.category_id;
    if (extras.images.length) line.images_attributes = [...(line.images_attributes || []), ...extras.images];
}
