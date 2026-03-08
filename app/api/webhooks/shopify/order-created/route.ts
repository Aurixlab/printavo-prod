// import crypto from "crypto";
// import fetch from "node-fetch";
// import { NextRequest, NextResponse } from "next/server";

// export async function POST(req: NextRequest) {
//     const body = await req.text();
//     const hmac = req.headers.get("x-shopify-hmac-sha256") || "";

//     const hash = crypto.createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!).update(body, "utf8").digest("base64");
//     if (hash !== hmac) return new NextResponse("Unauthorized", { status: 401 });

//     const order = JSON.parse(body);
//     console.log("📦 NEW SHOPIFY ORDER RECEIVED:: ", order);
//     try {
//         // --- STEP 1: LOGIN ---
//         const loginRes = await fetch("https://www.printavo.com/api/v1/sessions", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ email: "aurixlab@gmail.com", password: process.env.PRINTAVO_PASSWORD })
//         });
//         const loginData: any = await loginRes.json();
//         const token = loginData.token;
//         const myUserId = loginData.id;

//         // --- STEP 2: STRICT CUSTOMER MATCH ---
//         let targetCustomerId: number | null = null;
//         const shopifyEmail = (order.email || order.customer?.email || "").toLowerCase().trim();

//         const searchRes = await fetch(
//             `https://www.printavo.com/api/v1/customers?email=aurixlab@gmail.com&token=${token}&query=${encodeURIComponent(shopifyEmail)}`
//         );
//         const searchData: any = await searchRes.json();
//         // searchData.data is the actual array
//         const matchedCust = searchData.data?.find((c: any) => c.email.toLowerCase().trim() === shopifyEmail);

//         if (matchedCust) {
//             targetCustomerId = matchedCust.id;
//             console.log(`✅ Found existing customer: ${targetCustomerId}`);
//         } else {
//             const customerPayload = {
//                 user_id: myUserId,
//                 first_name: order.customer?.first_name || "Shopify",
//                 last_name: order.customer?.last_name || "Customer",
//                 customer_email: shopifyEmail,
//                 phone: order.billing_address?.phone || ""
//             };
//             const custRes = await fetch(`https://www.printavo.com/api/v1/customers?email=aurixlab@gmail.com&token=${token}`, {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify(customerPayload)
//             });
//             const newCust: any = await custRes.json();
//             targetCustomerId = newCust.id;
//             console.log(`👤 Created new customer: ${JSON.stringify(customerPayload)}`);
//         }

//         // --- STEP 3: CALGARY TIME & STATUS LOGIC ---
//         const calgaryTimeStr = new Intl.DateTimeFormat("en-US", {
//             timeZone: "America/Denver", hour: "numeric", hour12: false
//         }).format(new Date());

//         const currentHour = parseInt(calgaryTimeStr);
//         let deliveryDate = new Date();
//         if (currentHour >= 11) deliveryDate.setDate(deliveryDate.getDate() + 1);
//         const formattedDueDate = deliveryDate.toLocaleDateString('en-US');

//         // Status IDs from your printed list
//         const RUSH_STATUS_ID = 134404; // 📦ORDER ITEMS **RUSH**
//         const QUOTE_STATUS_ID = 22634;  // Quote

//         const isRush = order.shipping_lines?.some((s: any) => s.title.includes("Calgary Location"));
//         const finalStatusId = isRush ? RUSH_STATUS_ID : QUOTE_STATUS_ID;

//         // --- STEP 4: CREATE ORDER PAYLOAD ---
//         const isPickup = !order.shipping_address;
//         const addressSource = order.shipping_address || order.billing_address;
//         console.log(`line items::: ${JSON.stringify(order.line_items)}`)
//         const orderPayload = {
//             user_id: myUserId,
//             customer_id: targetCustomerId,
//             orderstatus_id: finalStatusId, // Status set at creation
//             visual_id: order.order_number.toString(),
//             notes: `Shopify Order #${order.order_number}.${isRush ? ' [RUSH]' : ''}${isPickup ? ' [PICKUP]' : ''}`,
//             formatted_due_date: formattedDueDate,
//             formatted_customer_due_date: formattedDueDate,
//             order_addresses_attributes: [{
//                 address1: addressSource?.address1 || (isPickup ? "LOCAL PICKUP" : ""),
//                 city: addressSource?.city || "",
//                 state: addressSource?.province || "",
//                 zip: addressSource?.zip || "",
//                 country: addressSource?.country_code || "CA"
//             }],
//             lineitems_attributes: order.line_items.map((item: any) => {
//                 const qty = parseInt(item.quantity);
//                 const variant = (item.variant_title || "").toUpperCase();
//                 const parts = variant.split('/').map((p: string) => p.trim());

//                 // Initialize all size columns as null or 0
//                 const sizeMapping: any = {
//                     size_s_qty: null,
//                     size_m_qty: null,
//                     size_l_qty: null,
//                     size_xl_qty: null,
//                     size_2xl_qty: null
//                 };

//                 // Explicitly map the Shopify quantity to the Printavo column
//                 if (parts.includes("2XL") || parts.includes("XXL")) sizeMapping.size_2xl_qty = qty;
//                 else if (parts.includes("XL")) sizeMapping.size_xl_qty = qty;
//                 else if (parts.includes("L")) sizeMapping.size_l_qty = qty;
//                 else if (parts.includes("M")) sizeMapping.size_m_qty = qty;
//                 else if (parts.includes("S")) sizeMapping.size_s_qty = qty;
//                 else if (parts.includes("XS")) sizeMapping.size_xs_qty = qty;

//                 // Extract Color from variant (e.g., "Royal" or "Navy")
//                 const colorValue = parts[0] || "";

//                 return {
//                     style_description: `${item.title} - ${item.variant_title}`,
//                     unit_cost: parseFloat(item.price),
//                     color: colorValue, // This fills the 'Color' column in Printavo
//                     ...sizeMapping,    // This fills the XS, S, M, L, XL, 2XL columns
//                     images_attributes: item.properties
//                         ?.filter((p: any) => p.value?.toString().includes("http"))
//                         .map((p: any) => ({ file_url: p.value, mime_type: "image/png" })) || []
//                 };
//             })
//         };

//         const orderRes = await fetch(`https://www.printavo.com/api/v1/orders?email=aurixlab@gmail.com&token=${token}`, {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify(orderPayload)
//         });

//         if (!orderRes.ok) return new NextResponse(await orderRes.text(), { status: 400 });

//         return NextResponse.json({ success: true });
//     } catch (error) {
//         console.error(error);
//         return new NextResponse("Error", { status: 500 });
//     }
// }


import crypto from "crypto";
import fetch from "node-fetch";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {

    const body = await req.text();
    const hmac = req.headers.get("x-shopify-hmac-sha256") || "";

    const hash = crypto
        .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!)
        .update(body, "utf8")
        .digest("base64");

    if (hash !== hmac) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const order = JSON.parse(body);
    console.log("📦 NEW SHOPIFY ORDER RECEIVED:", order.order_number);

    try {

        // -----------------------------
        // STEP 1: LOGIN TO PRINTAVO
        // -----------------------------

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

        // -----------------------------
        // STEP 2: FIND OR CREATE CUSTOMER
        // -----------------------------

        const shopifyEmail = (order.email || order.customer?.email || "")
            .toLowerCase()
            .trim();

        let targetCustomerId: number | null = null;

        const searchRes = await fetch(
            `https://www.printavo.com/api/v1/customers?email=aurixlab@gmail.com&token=${token}&query=${encodeURIComponent(shopifyEmail)}`
        );

        const searchData: any = await searchRes.json();

        const matchedCust = searchData.data?.find(
            (c: any) => c.email?.toLowerCase().trim() === shopifyEmail
        );

        if (matchedCust) {

            targetCustomerId = matchedCust.id;
            console.log("✅ Found existing customer:", targetCustomerId);

        } else {

            const customerPayload = {
                user_id: myUserId,
                first_name: order.customer?.first_name || "Shopify",
                last_name: order.customer?.last_name || "Customer",
                customer_email: shopifyEmail,
                phone: order.billing_address?.phone || ""
            };

            const custRes = await fetch(
                `https://www.printavo.com/api/v1/customers?email=aurixlab@gmail.com&token=${token}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(customerPayload)
                }
            );

            const newCust: any = await custRes.json();

            targetCustomerId = newCust.id;

            console.log("👤 Created new customer:", customerPayload);
        }

        // -----------------------------
        // STEP 3: DELIVERY DATE LOGIC
        // -----------------------------

        const calgaryNow = new Date(
            new Date().toLocaleString("en-US", { timeZone: "America/Denver" })
        );

        const currentHour = calgaryNow.getHours();
        const day = calgaryNow.getDay(); // 0=Sun 1=Mon ... 6=Sat

        let deliveryDate = new Date(calgaryNow);

        // --- WEEKEND RULE ---
        if (day === 6) {
            // Saturday → Monday
            deliveryDate.setDate(deliveryDate.getDate() + 2);
        }
        else if (day === 0) {
            // Sunday → Monday
            deliveryDate.setDate(deliveryDate.getDate() + 1);
        }
        else {
            // Weekday rule
            if (currentHour >= 11) {
                deliveryDate.setDate(deliveryDate.getDate() + 1);
            }

            // If next day lands on weekend → push to Monday
            const nextDay = deliveryDate.getDay();
            if (nextDay === 6) deliveryDate.setDate(deliveryDate.getDate() + 2);
            if (nextDay === 0) deliveryDate.setDate(deliveryDate.getDate() + 1);
        }

        const formattedDueDate = deliveryDate.toLocaleDateString("en-US");

        const RUSH_STATUS_ID = 134404;
        const QUOTE_STATUS_ID = 22634;

        const isRush = order.shipping_lines?.some((s: any) =>
            s.title.includes("Calgary Location")
        );

        const finalStatusId = isRush ? RUSH_STATUS_ID : QUOTE_STATUS_ID;

        // -----------------------------
        // STEP 4: ADDRESS
        // -----------------------------

        const isPickup = !order.shipping_address;
        const addressSource = order.shipping_address || order.billing_address;

        // -----------------------------
        // STEP 5: GROUP ITEMS (PRO TIP)
        // -----------------------------

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

        // -----------------------------
        // STEP 6: BUILD PRINTAVO ORDER
        // -----------------------------

        const orderPayload = {

            user_id: myUserId,
            customer_id: targetCustomerId,
            orderstatus_id: finalStatusId,

            visual_id: order.order_number.toString(),

            notes: `Shopify Order #${order.order_number}.${isRush ? " [RUSH]" : ""}${isPickup ? " [PICKUP]" : ""}`,

            formatted_due_date: formattedDueDate,
            formatted_customer_due_date: formattedDueDate,

            order_addresses_attributes: [
                {
                    address1: addressSource?.address1 || (isPickup ? "LOCAL PICKUP" : ""),
                    city: addressSource?.city || "",
                    state: addressSource?.province || "",
                    zip: addressSource?.zip || "",
                    country: addressSource?.country_code || "CA"
                }
            ],

            lineitems_attributes
        };

        // -----------------------------
        // STEP 7: CREATE PRINTAVO ORDER
        // -----------------------------

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
            console.error("❌ Printavo error:", err);
            return new NextResponse(err, { status: 400 });
        }

        console.log("✅ Order successfully sent to Printavo");

        return NextResponse.json({ success: true });

    } catch (error) {

        console.error("❌ Webhook error:", error);

        return new NextResponse("Error", { status: 500 });
    }
}