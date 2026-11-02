import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import { emptySizeFields, printavoSizeField } from "@/lib/webstore-routing";
import { applyExtras, newEnrichCache, webstoreLineExtras } from "@/lib/webstore-enrich";
import { customizationKey, customizationLabel, rowCustomization } from "@/lib/webstore-customization";
import { buildCustomers, formatCustomerNotes, groupBatchLines } from "@/lib/store-close-details";
import { fetchShopifyOrders } from "@/lib/store-close-shopify";

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const groupDeps = { printavoSizeField, emptySizeFields, rowCustomization, customizationKey, customizationLabel };

/**
 * Sends ONE Printavo order for the whole store session: one line per product + colour + price,
 * and the order notes list every customer (name, email, phone, delivery, items).
 * `closedAt` is the moment the store was closed; orders after it are not part of this batch.
 */
export async function sendPrintavoBatch(store: any, closedAt?: string) {
    const storeName = store.name;

    try {
        const now = closedAt || new Date().toISOString();
        // ----------------------------------
        // FETCH ALL ORDERS + ITEMS DURING THE ACTIVE PERIOD
        // ----------------------------------
        const { data: storeOrderList, error: orderError } = await supabase
            .from("orders")
            .select("*")
            .eq("store_name", storeName)
            .gte("created_at", store.created_at)
            .lte("created_at", now);
        if (orderError) throw orderError;

        const allOrders = storeOrderList || [];

        if (allOrders.length === 0) {
            console.log("No orders found for store:", storeName);
            return { skipped: true };
        }

        const { data: allItems, error: itemsError } = await supabase
            .from("order_items")
            .select("*")
            .in("order_id", allOrders.map(o => o.id));

        if (itemsError) throw itemsError;

        if (!allItems || allItems.length === 0) {
            console.log("No orders found for store:", storeName);
            return { skipped: true };
        }

        // ----------------------------------
        // CUSTOMER DETAILS FROM SHOPIFY (falls back to the database's if Shopify is unreachable)
        // ----------------------------------
        const shopifyById = await fetchShopifyOrders(allOrders.map(o => o.shopify_order_id));
        const everyone = buildCustomers(allOrders, allItems, shopifyById, groupDeps);
        // An order cancelled in Shopify must not be printed
        const cancelledNumbers = new Set(everyone.filter(c => c.cancelled).map(c => String(c.orderNumber)));
        const customers = everyone.filter(c => !c.cancelled);
        const excluded = everyone.filter(c => c.cancelled);
        const keepOrderIds = new Set(allOrders.filter(o => !cancelledNumbers.has(String(o.order_number))).map(o => String(o.id)));
        const storeOrders = allItems.filter(i => keepOrderIds.has(String(i.order_id)));

        if (storeOrders.length === 0) {
            console.log("Every order of this store was cancelled:", storeName);
            return { skipped: true };
        }

        // ----------------------------------
        // AGGREGATE ITEMS: product + colour + price (+ personalization)
        // ----------------------------------
        const lines = groupBatchLines(storeOrders, groupDeps);
        const grouped: Record<string, any> = {};
        // Shopify product + colour behind each line, for the artwork lookup
        const groupSource: Record<string, { productId: any; colorText: string }> = {};
        const unmapped: string[] = [];

        for (const line of lines) {
            groupSource[line.key] = { productId: line.product_id, colorText: line.color };
            grouped[line.key] = {
                style_description: line.description,
                unit_cost: line.unit_cost,
                color: line.color,
                ...line.sizes
            };
            for (const u of line.unmapped) {
                // A size Printavo has no field for is reported in the notes instead of being dropped
                unmapped.push(`${line.description.split("\n")[0]} / ${line.color}: ${u}`);
                console.warn(`Batch: size "${u}" has no Printavo field (${line.description})`);
            }
        }

        const lineitems_attributes = Object.values(grouped);

        // ----------------------------------
        // PRINTAVO LOGIN
        // ----------------------------------
        const loginRes = await fetch("https://www.printavo.com/api/v1/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "aurixlab@gmail.com",
                password: process.env.PRINTAVO_PASSWORD
            })
        });
        const loginData: any = await loginRes.json();
        const token = loginData.token;
        const myUserId = loginData.id;
        if (!token || !myUserId) {
            throw new Error("Printavo login did not return a token and user ID");
        }

        // Artwork, item # and category per product + colour (lib/webstore-enrich).
        // Failures are logged and the batch still goes out without them.
        const enrichCache = newEnrichCache();
        for (const [key, src] of Object.entries(groupSource)) {
            const extras = await webstoreLineExtras({ productId: src.productId, colorText: src.colorText }, token, enrichCache);
            applyExtras(grouped[key], extras);
        }

        ///Create customer
        const { data: storeInfo, error } = await supabase
            .from("stores")
            .select("*")
            .eq("name", storeName)
            .maybeSingle();

        console.log("Store found:", storeInfo, { error });
        let custId: number | undefined = storeInfo?.customer_id;
        if (!custId) {
            let email = storeInfo.name.replace(/\s/g, "").toLocaleLowerCase() + "@budgetpromotion.com";
            const custRes = await fetch(
                `https://www.printavo.com/api/v1/customers?email=aurixlab@gmail.com&token=${token}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        user_id: myUserId,
                        first_name: storeInfo?.name || "Shopify",
                        // last_name: order.customer?.last_name || "Customer",
                        customer_email: email,
                    })
                }
            );
            const resp: any = await custRes.json();
            custId = resp?.id;

            const { error } = await supabase
                .from('stores')
                .update({ customer_id: custId })
                .eq('name', storeInfo?.name);
            console.log("Updated store:", { customer_id: custId, name: storeInfo?.name });
        }
        // ----------------------------------
        // CREATE PRINTAVO ORDER
        // ----------------------------------
        const calgaryNow = new Date(
            new Date().toLocaleString("en-US", { timeZone: "America/Denver" })
        );
        calgaryNow.setDate(calgaryNow.getDate() + 1);
        const formattedDueDate = calgaryNow.toLocaleDateString("en-US");
        const webstoreStatus = 533440
        let notes = formatCustomerNotes(storeName, customers, excluded);
        if (unmapped.length) notes += `\n\nSIZES PRINTAVO HAS NO FIELD FOR (add by hand): ${unmapped.join("; ")}`;
        const orderPayload = {
            user_id: myUserId,
            customer_id: custId,
            orderstatus_id: webstoreStatus,
            visual_id: Date.now().toString(),

            formatted_due_date: formattedDueDate,
            formatted_customer_due_date: formattedDueDate,

            notes,

            lineitems_attributes
        };

        const orderRes = await fetch(
            `https://www.printavo.com/api/v1/orders?email=aurixlab@gmail.com&token=${token}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(orderPayload)
            }
        );

        if (!orderRes.ok) {
            const err = await orderRes.text();
            console.error("Printavo batch order error:", err);
            return { success: false, error: err };
        }

        console.log("Printavo batch order created for stores:", storeName);
        return { success: true, orders: customers.length, lines: lineitems_attributes.length };

    } catch (err) {
        console.error("Error sending Printavo batch:", err);
        return { success: false, error: err };
    }
}
