import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function sendPrintavoBatch(store: any) {
    const storeName = store.name;

    try {
        const now = new Date().toISOString();
        // ----------------------------------
        // FETCH ALL ORDER ITEMS DURING ACTIVE PERIOD
        // ----------------------------------
        // 1️⃣ Get all orders for this store during active period
        const { data: storeOrderList, error: orderError } = await supabase
            .from("orders")
            .select("id")
            .eq("store_name", storeName)
            .gte("created_at", store.created_at)
            .lte("created_at", now); // use current timestamp instead of null
        if (orderError) throw orderError;

        const orderIds = storeOrderList?.map(o => o.id) || [];

        if (orderIds.length === 0) {
            console.log("No orders found for store:", storeName);
            return { skipped: true };
        }

        // 2️⃣ Fetch all order items for those orders
        const { data: storeOrders, error: itemsError } = await supabase
            .from("order_items")
            .select("*")
            .in("order_id", orderIds);

        if (itemsError) throw itemsError;

        if (!storeOrders || storeOrders.length === 0) {
            console.log("No orders found for store:", storeName);
            return { skipped: true };
        }

        // ----------------------------------
        // AGGREGATE ITEMS
        // ----------------------------------
        const grouped: Record<string, any> = {};

        for (const item of storeOrders) {
            const key = `${item.product_id}-${item.color}`;
            if (!grouped[key]) {
                grouped[key] = {
                    style_description: item.product_name,
                    unit_cost: parseFloat(item.price),
                    color: item.color,
                    size_s: 0,
                    size_m: 0,
                    size_l: 0,
                    size_xl: 0,
                    size_2xl: 0
                };
            }

            switch (item.size) {
                case "S": grouped[key].size_s += item.quantity; break;
                case "M": grouped[key].size_m += item.quantity; break;
                case "L": grouped[key].size_l += item.quantity; break;
                case "XL": grouped[key].size_xl += item.quantity; break;
                case "2XL":
                case "XXL": grouped[key].size_2xl += item.quantity; break;
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

        // ----------------------------------
        // CREATE PRINTAVO ORDER
        // ----------------------------------
        const calgaryNow = new Date(
            new Date().toLocaleString("en-US", { timeZone: "America/Denver" })
        );
        calgaryNow.setDate(calgaryNow.getDate() + 1);
        const formattedDueDate = calgaryNow.toLocaleDateString("en-US");
        const webstoreStatus = 533440
        const orderPayload = {
            user_id: myUserId,
            customer_id: 10572789,
            order_status_id: webstoreStatus,
            visual_id: Date.now().toString(),

            formatted_due_date: formattedDueDate,
            formatted_customer_due_date: formattedDueDate,

            notes: `Batch Shopify Orders for store ${storeName}`,

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
        return { success: true };

    } catch (err) {
        console.error("Error sending Printavo batch:", err);
        return { success: false, error: err };
    }
}