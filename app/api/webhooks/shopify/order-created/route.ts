

import crypto from "crypto";
import fetch from "node-fetch";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ----------------------------------
// SUPABASE
// ----------------------------------

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ----------------------------------
// VARIANT PARSER
// ----------------------------------

function extractVariant(item: any) {

    const sizes = ["XS", "S", "M", "L", "XL", "2XL", "XXL", "3XL", "4XL", "5XL"];

    let size = "UNKNOWN";
    let color = "N/A";

    if (item.variant_options?.length) {

        for (const opt of item.variant_options) {

            const val = opt.toUpperCase().trim();

            if (sizes.includes(val)) {
                console.log(`Identified size: ${val} from variant options`);
                size = val;
            } else {
                console.log(`Identified color: ${val} from variant options`);
                color = val;
            }

        }

    } else {

        const parts = (item.variant_title || "")
            .split("/")
            .map((p: string) => p.trim().toUpperCase());

        for (const p of parts) {

            if (sizes.includes(p)) size = p;
            else if (!p.includes("DESIGN")) color = p;

        }

    }

    return { size, color };

}

// ----------------------------------
// WEBHOOK
// ----------------------------------

export async function POST(req: NextRequest) {

    const rawBody = await req.text();

    const hmacHeader = req.headers.get("x-shopify-hmac-sha256") || "";

    const generatedHash = crypto
        .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!)
        .update(rawBody, "utf8")
        .digest("base64");

    if (generatedHash !== hmacHeader) {

        console.error("Invalid webhook signature");

        return new NextResponse("Unauthorized", { status: 401 });

    }

    const order = JSON.parse(rawBody);

    console.log("Shopify order received:", order);

    try {

        // After INSERT ORDER ITEMS, replace the collection block with this:

        const productId = order.line_items[0]?.product_id;

        console.log("=== COLLECTION DEBUG START ===");
        console.log("Product ID:", productId);
        console.log("SHOPIFY_SHOP_DOMAIN:", process.env.SHOPIFY_SHOP_DOMAIN);
        console.log("SHOPIFY_ADMIN_TOKEN exists:", !!process.env.SHOPIFY_ADMIN_TOKEN);
        console.log("SHOPIFY_ADMIN_TOKEN prefix:", process.env.SHOPIFY_ADMIN_TOKEN?.slice(0, 10));

        // ----------------------------------
        // STEP 1: GET COLLECTION ID
        // ----------------------------------

        const collectUrl = `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01/collects.json?product_id=${productId}`;
        console.log("Fetching collects URL:", collectUrl);

        const collectRes = await fetch(collectUrl, {
            headers: { "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN! }
        });

        console.log("Collects response status:", collectRes.status);
        const collectData: any = await collectRes.json();
        console.log("Collects raw response:", JSON.stringify(collectData, null, 2));

        const collectionId = collectData.collects?.[0]?.collection_id;
        console.log("Resolved collection ID:", collectionId);

        if (!collectionId) {
            console.warn("⚠️ No collection ID found for product:", productId);
            console.warn("This means the product is either:");
            console.warn("  1. Not in any collection");
            console.warn("  2. Only in a smart collection (collects API won't return it)");
        }

        // ----------------------------------
        // STEP 2: TRY CUSTOM COLLECTION
        // ----------------------------------

        let templateSuffix: string | null = null;
        let storeStatus: string | null = null;
        let storeName: string | null = null;

        if (collectionId) {

            const customUrl = `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01/custom_collections/${collectionId}.json`;
            const smartUrl = `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01/smart_collections/${collectionId}.json`;
            const metaUrl = `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01/collections/${collectionId}/metafields.json`;

            console.log("Fetching custom collection:", customUrl);

            const customRes = await fetch(customUrl, {
                headers: { "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN! }
            });

            console.log("Custom collection status:", customRes.status);
            const customData: any = await customRes.json();
            console.log("Custom collection response:", JSON.stringify(customData, null, 2));

            // ----------------------------------
            // STEP 3: FALLBACK TO SMART COLLECTION
            // ----------------------------------

            if (customRes.status === 404 || !customData.custom_collection) {

                console.log("Not a custom collection, trying smart collection...");

                const smartRes = await fetch(smartUrl, {
                    headers: { "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN! }
                });

                console.log("Smart collection status:", smartRes.status);
                const smartData: any = await smartRes.json();
                console.log("Smart collection response:", JSON.stringify(smartData, null, 2));

                templateSuffix = smartData.smart_collection?.template_suffix ?? null;

            } else {

                templateSuffix = customData.custom_collection?.template_suffix ?? null;

            }

            // ----------------------------------
            // STEP 4: GET METAFIELDS
            // ----------------------------------

            console.log("Fetching metafields:", metaUrl);

            const metaRes = await fetch(metaUrl, {
                headers: { "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN! }
            });

            console.log("Metafields response status:", metaRes.status);
            const metaData: any = await metaRes.json();
            console.log("Metafields raw response:", JSON.stringify(metaData, null, 2));

            storeStatus = metaData.metafields?.find(
                (m: any) => m.namespace === "custom" && m.key === "store_status"
            )?.value ?? null;

            storeName = metaData.metafields?.find(
                (m: any) => m.namespace === "custom" && m.key === "store_name"
            )?.value ?? null;

        }

        console.log("=== COLLECTION DEBUG RESULT ===");
        console.log("Template suffix:", templateSuffix);
        console.log("Store name:", storeName);
        console.log("=== COLLECTION DEBUG END ===");

        // ----------------------------------
        // ROUTE BASED ON storeName
        // ----------------------------------


        // ----------------------------------
        // BASIC ORDER INFO
        // ----------------------------------

        const billing = order.billing_address || {};

        const customerName =
            `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim();

        const vendorHandle = order.line_items[0]?.vendor
            ?.toLowerCase()
            .replace(/\s+/g, "-");

        if (templateSuffix?.toLowerCase() === "webstore") {
            // ----------------------------------
            // INSERT Store
            // ----------------------------------
            // Check if there's already an active store
            const { data: existingStore, error: selectError } = await supabase
                .from("stores")
                .select("*")
                .eq("is_active", true)
                .limit(1);

            if (selectError) {
                console.error("Error checking existing stores:", selectError);
            } else if (!existingStore || existingStore.length === 0) {
                // No active store found, insert a new one
                const { data: newStore, error: insertError } = await supabase
                    .from("stores")
                    .insert({
                        name: storeName,
                        is_active: true,
                        created_at: new Date().toISOString()
                    });

                if (insertError) {
                    console.error("Error inserting store:", insertError);
                } else {
                    console.log("Store created:", newStore);
                }
            } else {
                console.log("An active store already exists. Skipping insert.");
            }


            const { data: newOrder, error: orderError } = await supabase
                .from("orders")
                .upsert(
                    {
                        shopify_order_id: order.id,
                        order_number: order.order_number,
                        customer_name: customerName,
                        email: order.email,
                        phone: billing.phone || null,
                        city: billing.city,
                        country: billing.country,
                        zip: billing.zip,
                        price_paid: order.total_price,
                        store_name: storeName,
                        ordered_at: new Date().toISOString()
                    },
                    { onConflict: "shopify_order_id" }
                )
                .select()
                .single();

            if (orderError) {

                console.error("Order insert failed:", orderError);

                return new NextResponse("DB Error", { status: 500 });

            }

            const orderId = newOrder.id;

            // ----------------------------------
            // INSERT ORDER ITEMS
            // ----------------------------------

            for (const item of order.line_items) {

                const { size, color } = extractVariant(item);

                const { error: itemError } = await supabase
                    .from("order_items")
                    .upsert(
                        {
                            shopify_line_item_id: item.id,
                            order_id: orderId,
                            product_id: item.product_id,
                            product_name: item.title,
                            color,
                            size,
                            quantity: item.quantity,
                            price: item.price
                        },
                        { onConflict: "shopify_line_item_id" }
                    );

                if (itemError) {

                    console.error("Item insert failed:", itemError);

                }

            }
            console.log("Webstore order stored in DB only");

            return NextResponse.json({ stored: true });
        }



        console.log("Budget promotion order detected → sending to Printavo");

        // ----------------------------------
        // LOGIN TO PRINTAVO
        // ----------------------------------

        const loginRes = await fetch(
            "https://www.printavo.com/api/v1/sessions",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: "aurixlab@gmail.com",
                    password: process.env.PRINTAVO_PASSWORD
                })
            }
        );

        const loginData: any = await loginRes.json();

        const token = loginData.token;
        const myUserId = loginData.id;

        // ----------------------------------
        // FIND CUSTOMER
        // ----------------------------------

        const shopifyEmail = (order.email || "").toLowerCase().trim();

        const searchRes = await fetch(
            `https://www.printavo.com/api/v1/customers?email=aurixlab@gmail.com&token=${token}&query=${encodeURIComponent(shopifyEmail)}`
        );

        const searchData: any = await searchRes.json();

        let customerId = searchData.data?.find(
            (c: any) => c.email?.toLowerCase() === shopifyEmail
        )?.id;
        const addressSource = order.billing_address || order.shipping_address
        if (!customerId) {

            const custRes = await fetch(
                `https://www.printavo.com/api/v1/customers?email=aurixlab@gmail.com&token=${token}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        user_id: myUserId,
                        first_name: order.customer?.first_name || "Shopify",
                        last_name: order.customer?.last_name || "Customer",
                        customer_email: shopifyEmail,
                        phone: order.billing_address?.phone || "Unknown",
                        billing_address_attributes: [
                            {
                                address1: addressSource?.address1,
                                city: addressSource?.city || "",
                                state: addressSource?.province || "",
                                zip: addressSource?.zip || "",
                                country: addressSource?.country_code || "CA",
                            }
                        ],
                    })
                }
            );

            const newCust: any = await custRes.json();

            customerId = newCust.id;
            console.log("Created new Printavo customer with ID:", customerId);
        }
        console.log("Found Printavo customer with ID:", customerId);
        // ----------------------------------
        // DELIVERY DATE
        // ----------------------------------

        const calgaryNow = new Date(
            new Date().toLocaleString("en-US", { timeZone: "America/Denver" })
        );

        calgaryNow.setDate(calgaryNow.getDate() + 1);

        const formattedDueDate =
            calgaryNow.toLocaleDateString("en-US");

        // ----------------------------------
        // GROUP ITEMS FOR PRINTAVO
        // ----------------------------------

        const groupedItems: Record<string, any> = {};

        order.line_items.forEach((item: any) => {

            const variant = (item.variant_title || "").toUpperCase();
            const parts = variant.split("/").map((p: string) => p.trim());

            const color = parts[0] || "Unknown";
            const size = parts[1] || "";
            const qty = Number(item.quantity);

            const groupKey = `${item.product_id}-${color}`;

            if (!groupedItems[groupKey]) {

                groupedItems[groupKey] = {
                    style_description: item.title,
                    unit_cost: parseFloat(item.price),
                    color: color,

                    size_xs: 0,
                    size_s: 0,
                    size_m: 0,
                    size_l: 0,
                    size_xl: 0,
                    size_2xl: 0,
                    size_3xl: 0,
                    size_4xl: 0,
                    size_5xl: 0,
                    size_6xl: 0,

                    images_attributes:
                        item.properties
                            ?.filter((p: any) => p.value?.toString().includes("http"))
                            .map((p: any) => ({
                                file_url: p.value,
                                mime_type: "image/png"
                            })) || []
                };
            }

            if (size === "XS") groupedItems[groupKey].size_xs += qty;
            else if (size === "S") groupedItems[groupKey].size_s += qty;
            else if (size === "M") groupedItems[groupKey].size_m += qty;
            else if (size === "L") groupedItems[groupKey].size_l += qty;
            else if (size === "XL") groupedItems[groupKey].size_xl += qty;
            else if (size === "2XL" || size === "XXL") groupedItems[groupKey].size_2xl += qty;
            else if (size === "3XL") groupedItems[groupKey].size_3xl += qty;
            else if (size === "4XL") groupedItems[groupKey].size_4xl += qty;
            else if (size === "5XL") groupedItems[groupKey].size_5xl += qty;
            else if (size === "6XL") groupedItems[groupKey].size_6xl += qty;

        });


        const lineitems_attributes = Object.values(groupedItems);
        // Status IDs from your printed list
        const RUSH_STATUS_ID = 134404; // 📦ORDER ITEMS **RUSH**
        const QUOTE_STATUS_ID = 22634;  // Quote

        const isRush = order.shipping_lines?.some((s: any) => s.title.includes("Calgary Location"));
        const finalStatusId = isRush ? RUSH_STATUS_ID : QUOTE_STATUS_ID;
        // ----------------------------------
        // CREATE PRINTAVO ORDER
        // ----------------------------------
        const isPickup = !order.shipping_address;

        const orderPayload = {

            user_id: myUserId,
            customer_id: customerId,
            visual_id: order.order_number.toString(),
            orderstatus_id: finalStatusId,
            formatted_due_date: formattedDueDate,
            formatted_customer_due_date: formattedDueDate,

            notes: `Budget Promotion Shopify Order #${order.order_number}`,
            order_addresses_attributes: [
                {
                    name: customerName || "Shopify Customer",
                    address1: addressSource?.address1 || (isPickup ? "LOCAL PICKUP" : ""),
                    city: addressSource?.city || "",
                    state: addressSource?.province || "",
                    zip: addressSource?.zip || "",
                    country: addressSource?.country_code || "CA",
                    phone: addressSource?.phone || ""
                }
            ],

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

            console.error("Printavo error:", err);

            return new NextResponse(err, { status: 400 });

        }

        // const createdOrder: any = await orderRes.json();

        // const printavoOrderId = createdOrder.id;

        // console.log("Created Printavo Order ID:", printavoOrderId);

        // await fetch(
        //     `https://www.printavo.com/api/v1/orders/${printavoOrderId}?email=aurixlab@gmail.com&token=${token}`,
        //     {
        //         method: "PUT",
        //         headers: {
        //             "Content-Type": "application/json"
        //         },
        //         body: JSON.stringify({
        //             order_status_id: finalStatusId
        //         })
        //     }
        // );

        console.log("Printavo order created");

        return NextResponse.json({ success: true });

    } catch (err) {

        console.error("Webhook error:", err);

        return new NextResponse("Server Error", { status: 500 });

    }

}