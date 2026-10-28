// Personalized webstore items (first used by Tigers Volleyball Club).
//
// A product that offers personalization has a third variant option,
// "Customization", with values like "None", "Text Only", "Number Only" and
// "Text + Number" (the surcharge is in the variant price). What the customer
// typed comes in as line item properties "Custom Text" and "Custom Number".
// Products without that option are untouched: every function here returns
// "no customization" for them, so their orders are handled exactly as before.

export type Customization = {
    level: string | null;   // the variant's Customization value, e.g. "Text + Number"
    text: string | null;    // "Custom Text" property
    number: string | null;  // "Custom Number" property
};

const NO_CUSTOMIZATION: Customization = { level: null, text: null, number: null };

const LEVEL_RE = /^(none|no customi[sz]ation|(text|name|number)( only)?|(text|name) ?(\+|&|and) ?number)$/i;

/** True for a variant option value that is a customization level, never a colour or size. */
export function isCustomizationValue(value: unknown): boolean {
    return LEVEL_RE.test(String(value ?? "").trim());
}

function propertyValue(item: any, names: string[]): string | null {
    const props = Array.isArray(item?.properties) ? item.properties : [];
    for (const p of props) {
        if (names.includes(String(p?.name ?? "").trim().toLowerCase())) {
            const v = String(p?.value ?? "").trim();
            if (v) return v;
        }
    }
    return null;
}

/** The customization of a Shopify order line item (webhook JSON). */
export function lineCustomization(item: any): Customization {
    const parts: string[] = Array.isArray(item?.variant_options) && item.variant_options.length
        ? item.variant_options.map((v: any) => String(v))
        : String(item?.variant_title ?? "").split("/");
    const levelPart = parts.map(p => p.trim()).find(p => isCustomizationValue(p)) ?? null;
    const text = propertyValue(item, ["custom text", "custom name"]);
    const number = propertyValue(item, ["custom number"]);
    const level = levelPart && !/^(none|no customi[sz]ation)$/i.test(levelPart) ? levelPart : null;
    if (!level && !text && !number) return NO_CUSTOMIZATION;
    return { level, text, number };
}

/** True when the item must be printed with something personal on it. */
export function hasCustomization(c: Partial<Customization> | null | undefined): boolean {
    return !!(c && (c.level || c.text || c.number));
}

/** One line for Printavo / emails, e.g. "Customization: Text + Number | Text: ALEX | Number: 12". */
export function customizationLabel(c: Partial<Customization> | null | undefined): string {
    if (!hasCustomization(c)) return "";
    const bits: string[] = [];
    if (c!.level) bits.push(`Customization: ${c!.level}`);
    if (c!.text) bits.push(`Text: ${c!.text}`);
    if (c!.number) bits.push(`Number: ${c!.number}`);
    return bits.join(" | ");
}

/** Extra grouping key: items only share a Printavo line when they are printed the same. "" for plain items. */
export function customizationKey(c: Partial<Customization> | null | undefined): string {
    if (!hasCustomization(c)) return "";
    return [c!.level ?? "", c!.text ?? "", c!.number ?? ""].join("|");
}

/** Columns for order_items, only for personalized lines (plain lines keep the old row shape). */
export function customizationColumns(c: Customization): Record<string, string | null> {
    if (!hasCustomization(c)) return {};
    return { customization: c.level, custom_text: c.text, custom_number: c.number };
}

/** The same Customization read back from an order_items row. */
export function rowCustomization(row: any): Customization {
    return {
        level: row?.customization ?? null,
        text: row?.custom_text ?? null,
        number: row?.custom_number ?? null
    };
}
