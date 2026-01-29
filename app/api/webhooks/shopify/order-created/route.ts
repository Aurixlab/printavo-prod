// import crypto from "crypto";
// import fetch from "node-fetch";
// import { NextRequest, NextResponse } from "next/server";

// export async function POST(req: NextRequest) {
//     const body = await req.text();
//     const hmac = req.headers.get("x-shopify-hmac-sha256") || "";

//     // 1. Verify Shopify HMAC
//     const hash = crypto.createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!).update(body, "utf8").digest("base64");
//     if (hash !== hmac) return new NextResponse("Unauthorized", { status: 401 });

//     const order = JSON.parse(body);
//     console.log("📦 NEW SHOPIFY ORDER RECEIVED:: ", order);
//     try {
//         // --- STEP 1: LOGIN ---
//         const loginRes = await fetch("https://www.printavo.com/api/v1/sessions", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({
//                 email: "mehrab367@gmail.com",
//                 password: process.env.PRINTAVO_PASSWORD
//             })
//         });
//         const loginData: any = await loginRes.json();
//         const token = loginData.token;
//         const userId = loginData.id;

//         // --- STEP 2: CREATE CUSTOMER ---
//         const customerPayload = {
//             user_id: userId,
//             first_name: order.customer?.first_name || "Shopify",
//             last_name: order.customer?.last_name || "Customer",
//             company: order.customer?.company || "Individual", // Printavo docs say 'company' is required
//             customer_email: order.email,
//             phone: order.phone || ""
//         };

//         const custRes = await fetch(`https://www.printavo.com/api/v1/customers?email=mehrab367@gmail.com&token=${token}`, {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify(customerPayload)
//         });
//         const customerData: any = await custRes.json();

//         if (!custRes.ok) {
//             console.error("Customer Creation Failed:", customerData);
//             return new NextResponse("Customer Creation Failed", { status: 400 });
//         }

//         const customerId = customerData.id;
//         console.log("✅ CUSTOMER CREATED!:: ", customerId);
//         // --- STEP 3: CREATE ORDER ---
//         // --- STEP 3: CREATE ORDER ---
//         const today = new Date();
//         const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

//         // const orderPayload = {
//         //     user_id: userId,
//         //     customer_id: customerId,
//         //     orderstatus_id: 1,
//         //     visual_id: order.order_number.toString(),
//         //     notes: `Shopify Order #${order.order_number}`,

//         //     // Printavo requires MM/DD/YYYY format
//         //     // Both of these are often required to satisfy their validator
//         //     formatted_due_date: nextWeek.toLocaleDateString('en-US'),          // Production Due Date
//         //     formatted_customer_due_date: nextWeek.toLocaleDateString('en-US'), // Customer Due Date

//         //     // Ensure this is lineitems_attributes (no underscore after line)
//         //     lineitems_attributes: order.line_items.map((item: any) => ({
//         //         style_description: item.title,
//         //         unit_cost: parseFloat(item.price),
//         //         total_quantities: parseInt(item.quantity)
//         //     }))
//         // };

//         const orderPayload = {
//             user_id: userId,
//             customer_id: customerId,
//             orderstatus_id: 1,
//             visual_id: order.order_number.toString(),
//             notes: `Shopify Order #${order.order_number}. Total Discount: ${order.total_discounts}`,

//             formatted_due_date: nextWeek.toLocaleDateString('en-US'),
//             formatted_customer_due_date: nextWeek.toLocaleDateString('en-US'),

//             // Add Shipping Address mapping so Printavo isn't blank
//             order_addresses_attributes: [
//                 {
//                     address1: order.billing_address?.address1 || "",
//                     city: order.billing_address?.city || "",
//                     state: order.billing_address?.province || "",
//                     zip: order.billing_address?.zip || "",
//                     country: order.billing_address?.country_code || "CA"
//                 }
//             ],

//             lineitems_attributes: order.line_items.map((item: any) => {
//                 // Extract design links from Shopify properties and add MIME TYPE
//                 const designImages = item.properties
//                     ? item.properties
//                         .filter((p: any) => p.value && typeof p.value === 'string' && p.value.includes("http"))
//                         .map((p: any) => ({
//                             file_url: p.value,
//                             mime_type: "image/png" // Required by Printavo
//                         }))
//                     : [];

//                 return {
//                     style_description: `${item.title} - ${item.variant_title}`,
//                     unit_cost: parseFloat(item.price),
//                     total_quantities: parseInt(item.quantity),
//                     images_attributes: designImages
//                 };
//             })
//         };

//         const orderRes = await fetch(`https://www.printavo.com/api/v1/orders?email=mehrab367@gmail.com&token=${token}`, {
//             method: "POST",
//             headers: {
//                 "Content-Type": "application/json",
//                 "Accept": "application/json"
//             },
//             body: JSON.stringify(orderPayload)
//         });
//         if (!orderRes.ok) {
//             const err = await orderRes.text();
//             console.error("Order Error:", err);
//             return new NextResponse(err, { status: 400 });
//         }

//         console.log("✅ CUSTOMER & ORDER CREATED!");
//         return NextResponse.json({ success: true });

//     } catch (error) {
//         console.error(error);
//         return new NextResponse("System Error", { status: 500 });
//     }
// }

import crypto from "crypto";
import fetch from "node-fetch";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const body = await req.text();
    const hmac = req.headers.get("x-shopify-hmac-sha256") || "";

    const hash = crypto.createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!).update(body, "utf8").digest("base64");
    if (hash !== hmac) return new NextResponse("Unauthorized", { status: 401 });

    const order = JSON.parse(body);
    console.log("📦 NEW SHOPIFY ORDER RECEIVED:: ", order);

    try {
        // --- STEP 1: LOGIN TO PRINTAVO ---
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
        const userId = loginData.id;

        // --- STEP 2: SEARCH/CREATE CUSTOMER (STRICT MATCH) ---
        let customerId: number;
        const shopifyEmail = (order.email || order.customer?.email || "").toLowerCase();
        const customerPhone = order.customer?.phone || order.billing_address?.phone || order.phone || "";

        const searchRes = await fetch(
            `https://www.printavo.com/api/v1/customers?email=aurixlab@gmail.com&token=${token}&query=${shopifyEmail}`,
            { method: "GET" }
        );
        const searchData: any = await searchRes.json();

        // STRICT FILTER: Only accept a match where the email is identical
        const existingCustomer = searchData.data?.find((c: any) => c.email.toLowerCase() === shopifyEmail);

        if (existingCustomer) {
            customerId = existingCustomer.id;
            console.log(`✅ MATCHED EXISTING CUSTOMER: ${customerId} (${existingCustomer.first_name} ${existingCustomer.last_name})`);
        } else {
            const customerPayload = {
                user_id: userId,
                first_name: order.customer?.first_name || "Shopify",
                last_name: order.customer?.last_name || "Customer",
                company: order.billing_address?.company || "Individual",
                customer_email: shopifyEmail,
                phone: customerPhone
            };

            const custRes = await fetch(`https://www.printavo.com/api/v1/customers?email=aurixlab@gmail.com&token=${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(customerPayload)
            });
            const newCust = await custRes.json() as { id: number };
            customerId = newCust.id;
            console.log(`✅ NEW CUSTOMER CREATED: ${customerId}`);
        }

        // --- STEP 3: CALGARY DELIVERY LOGIC (11 AM CUTOFF) ---
        const calgaryTimeStr = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/Denver",
            hour: "numeric",
            hour12: false
        }).format(new Date());

        const currentHour = parseInt(calgaryTimeStr);
        let deliveryDate = new Date();
        // If 11:00 AM or later in Calgary, set to tomorrow
        if (currentHour >= 11) deliveryDate.setDate(deliveryDate.getDate() + 1);
        const formattedDueDate = deliveryDate.toLocaleDateString('en-US');

        // Pickup vs Shipping
        const isPickup = !order.shipping_address;
        const addressSource = order.shipping_address || order.billing_address;

        // --- STEP 4: ORDER PAYLOAD WITH SIZES ---
        const orderPayload = {
            user_id: userId,
            customer_id: customerId,
            orderstatus_id: 1,
            visual_id: order.order_number.toString(),
            notes: `Shopify Order #${order.order_number}.${isPickup ? ' [PICKUP]' : ''} Total Discount: ${order.total_discounts}`,
            formatted_due_date: formattedDueDate,
            formatted_customer_due_date: formattedDueDate,
            order_addresses_attributes: [{
                address1: addressSource?.address1 || (isPickup ? "LOCAL PICKUP" : ""),
                city: addressSource?.city || "",
                state: addressSource?.province || "",
                zip: addressSource?.zip || "",
                country: addressSource?.country_code || "CA"
            }],
            lineitems_attributes: order.line_items.map((item: any) => {
                const qty = parseInt(item.quantity);
                const variant = (item.variant_title || "").toUpperCase();

                // Helper to map sizes so they populate the XS/S/M/L/XL boxes
                const sizeMapping: any = {};
                if (variant.includes("2XL")) sizeMapping.size_2xl_qty = qty;
                else if (variant.includes("XL")) sizeMapping.size_xl_qty = qty;
                else if (variant.includes(" L ") || variant.endsWith(" L") || variant === "L") sizeMapping.size_l_qty = qty;
                else if (variant.includes(" M ") || variant.endsWith(" M") || variant === "M") sizeMapping.size_m_qty = qty;
                else if (variant.includes(" S ") || variant.endsWith(" S") || variant === "S") sizeMapping.size_s_qty = qty;
                else if (variant.includes("XS")) sizeMapping.size_xs_qty = qty;

                return {
                    style_description: `${item.title} - ${item.variant_title}`,
                    unit_cost: parseFloat(item.price),
                    total_quantities: qty,
                    ...sizeMapping, // Spreads size_xl_qty: 1, etc.
                    images_attributes: item.properties
                        ? item.properties
                            .filter((p: any) => p.value && typeof p.value === 'string' && p.value.includes("http"))
                            .map((p: any) => ({ file_url: p.value, mime_type: "image/png" }))
                        : []
                };
            })
        };

        const orderRes = await fetch(`https://www.printavo.com/api/v1/orders?email=aurixlab@gmail.com&token=${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify(orderPayload)
        });

        if (!orderRes.ok) return new NextResponse(await orderRes.text(), { status: 400 });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return new NextResponse("System Error", { status: 500 });
    }
}