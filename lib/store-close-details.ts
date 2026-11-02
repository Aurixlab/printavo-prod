// Closing a bulk webstore sends ONE Printavo order. This file decides what is in it.
// Pure functions only (no network, no database) so they can be tested with real data.
//
//  - groupBatchLines: one Printavo line per product + colour + unit price (+ personalization).
//    Grouping by price means a 2XL at $35 is its own line, not billed at the first order's $30.
//  - formatCustomerNotes: the order notes, one row per customer, so nobody is missed.
//
// Printavo gets the same fields as before (style_description, unit_cost, color, size_*), so
// nothing new can be rejected for an unknown field.

export type Customer = {
    orderNumber: string | number;
    name: string;
    email: string;
    phone: string;
    delivery: string;          // "Pickup" or the ship-to address
    note: string;
    items: string[];           // e.g. "Alberta / PITCH BLACK / M x1"
    cancelled: boolean;
    status: string;            // Shopify financial status when known
};

export type BatchLine = {
    key: string;
    product_id: any;
    color: string;
    unit_cost: number;
    description: string;
    sizes: Record<string, number>;
    unmapped: string[];        // sizes Printavo has no field for (reported, never silently dropped)
};

export type GroupDeps = {
    printavoSizeField: (size: unknown) => string | null;
    emptySizeFields: () => Record<string, number>;
    rowCustomization: (row: any) => any;
    customizationKey: (c: any) => string;
    customizationLabel: (c: any) => string;
};

export function groupBatchLines(items: any[], deps: GroupDeps): BatchLine[] {
    const lines = new Map<string, BatchLine>();
    for (const item of items) {
        const customization = deps.rowCustomization(item);
        const customKey = deps.customizationKey(customization);
        const price = Number(item.price);
        const priceText = Number.isFinite(price) ? price.toFixed(2) : "0.00";
        const key = [item.product_id, item.color, priceText, customKey].join("|");
        let line = lines.get(key);
        if (!line) {
            line = {
                key,
                product_id: item.product_id,
                color: item.color,
                unit_cost: Number.isFinite(price) ? price : 0,
                description: customKey
                    ? `${item.product_name}\n${deps.customizationLabel(customization)}`
                    : item.product_name,
                sizes: deps.emptySizeFields(),
                unmapped: []
            };
            lines.set(key, line);
        }
        const field = deps.printavoSizeField(item.size);
        if (field) line.sizes[field] += Number(item.quantity) || 0;
        else line.unmapped.push(`${item.size} x${item.quantity}`);
    }
    return Array.from(lines.values());
}

/** "Western Champs 2026 Tee – Alberta" -> "Alberta" is not safe in general, so keep the full name but trim. */
function itemText(item: any, customizationLabel: (c: any) => string, rowCustomization: (r: any) => any): string {
    const label = customizationLabel(rowCustomization(item));
    return `${item.product_name} / ${item.color || "-"} / ${item.size || "-"} x${item.quantity}${label ? ` [${label}]` : ""}`;
}

/** Group item rows by order and attach the customer details (Shopify details win over the database's). */
export function buildCustomers(
    orders: any[],
    items: any[],
    shopifyById: Record<string, any>,
    deps: Pick<GroupDeps, "customizationLabel" | "rowCustomization">
): Customer[] {
    const byOrder = new Map<string, any[]>();
    for (const it of items) {
        const list = byOrder.get(String(it.order_id)) || [];
        list.push(it);
        byOrder.set(String(it.order_id), list);
    }
    return orders
        .map((o): Customer => {
            const s = shopifyById[String(o.shopify_order_id)] || null;
            const ship = s?.shippingAddress || null;
            const addr = ship
                ? [ship.name, ship.address1, ship.address2, ship.city, ship.province, ship.zip, ship.country].filter(Boolean).join(", ")
                : "";
            const pickup = (s?.shippingLines?.nodes || []).map((n: any) => n.title).filter(Boolean).join(", ");
            return {
                orderNumber: o.order_number,
                name: (s?.shippingAddress?.name || s?.billingAddress?.name || o.customer_name || "").trim(),
                email: (s?.email || o.email || "").trim(),
                phone: (s?.phone || ship?.phone || s?.billingAddress?.phone || o.phone || "").trim(),
                delivery: addr || (pickup ? `Pickup (${pickup})` : [o.city, o.zip, o.country].filter(Boolean).join(", ") || "Pickup"),
                note: (s?.note || "").trim(),
                items: (byOrder.get(String(o.id)) || []).map(it => itemText(it, deps.customizationLabel, deps.rowCustomization)),
                cancelled: !!s?.cancelledAt,
                status: s?.displayFinancialStatus || ""
            };
        })
        .sort((a, b) => Number(a.orderNumber) - Number(b.orderNumber));
}

/** Text for the Printavo order notes. One row per customer, in order-number order. */
export function formatCustomerNotes(storeName: string, customers: Customer[], excluded: Customer[] = []): string {
    const units = (c: Customer) => c.items.reduce((n, t) => n + (Number((t.match(/ x(\d+)(?: \[|$)/) || [])[1]) || 0), 0);
    const total = customers.reduce((n, c) => n + units(c), 0);
    const out: string[] = [
        `Batch Shopify Orders for store ${storeName}`,
        `${customers.length} orders, ${total} items. One row per order below.`,
        ""
    ];
    for (const c of customers) {
        out.push(`#${c.orderNumber} | ${c.name || "(no name)"} | ${c.email || "-"} | ${c.phone || "-"} | ${c.delivery}`);
        for (const it of c.items) out.push(`    - ${it}`);
        if (c.note) out.push(`    Note: ${c.note}`);
    }
    if (excluded.length) {
        out.push("", `NOT INCLUDED (cancelled in Shopify): ${excluded.map(c => `#${c.orderNumber} ${c.name}`).join("; ")}`);
    }
    return out.join("\n");
}
