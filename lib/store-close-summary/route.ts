// import { createClient } from "@supabase/supabase-js";
// import { Resend } from "resend";

// const supabase = createClient(
//     process.env.SUPABASE_URL!,
//     process.env.SUPABASE_SERVICE_ROLE_KEY!
// );

// const resend = new Resend(process.env.RESEND_API_KEY!);

// export async function sendStoreCloseSummary(storeName: string) {

//     //----------------------------------
//     // GET LAST STORE SESSION
//     //----------------------------------

//     const { data: store } = await supabase
//         .from("stores")
//         .select("*")
//         .eq("name", storeName)
//         .order("created_at", { ascending: false })
//         .limit(1)
//         .single();

//     if (!store) return;

//     const startISO = store.created_at;
//     const endISO = store.closed_at;

//     //----------------------------------
//     // FETCH ORDERS
//     //----------------------------------

//     const { data: orders } = await supabase
//         .from("orders")
//         .select("*")
//         .eq("store_name", storeName)
//         .gte("ordered_at", startISO)
//         .lte("ordered_at", endISO);

//     //----------------------------------
//     // FETCH ITEMS
//     //----------------------------------

//     const { data: items } = await supabase
//         .from("order_items")
//         .select("*")
//         .gte("created_at", startISO)
//         .lte("created_at", endISO);

//     const filteredItems =
//         items?.filter((i: any) =>
//             orders?.some((o: any) => o.id === i.order_id)
//         ) || [];

//     //----------------------------------
//     // SUMMARY
//     //----------------------------------

//     const totalOrders = orders?.length || 0;

//     const totalRevenue =
//         orders?.reduce((sum, o) =>
//             sum + Number(o.price_paid || 0), 0) || 0;

//     const totalItems =
//         filteredItems.reduce((sum, i) =>
//             sum + i.quantity, 0);

//     //----------------------------------
//     // SEND EMAIL
//     //----------------------------------

//     await resend.emails.send({

//         from: "AurixLab Automation <onboarding@resend.dev>",

//         to: "0168mehrab@gmail.com",

//         subject: `Store Closed Summary — ${storeName}`,

//         html: `
//       <h1>🔴 Store Closed Summary</h1>
//       <p>${storeName}</p>

//       <p>Total Orders: ${totalOrders}</p>
//       <p>Total Revenue: $${totalRevenue}</p>
//       <p>Total Items: ${totalItems}</p>

//       <p>
//         ${new Date(startISO).toLocaleDateString()} 
//         →
//         ${new Date(endISO).toLocaleDateString()}
//       </p>
//     `

//     });

// }"
// "

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendStoreCloseSummary(storeName: string) {

    //----------------------------------
    // GET LAST STORE SESSION
    //----------------------------------

    const { data: store } = await supabase
        .from("stores")
        .select("*")
        .eq("name", storeName)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (!store) return;

    const startISO = store.created_at;
    const endISO = store.closed_at;

    const formattedStart = new Date(startISO).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const formattedEnd = new Date(endISO).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    //----------------------------------
    // FETCH ORDERS
    //----------------------------------

    const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .eq("store_name", storeName)  // ✅ matches your original
        .gte("ordered_at", startISO)
        .lte("ordered_at", endISO);

    //----------------------------------
    // FETCH ITEMS
    //----------------------------------

    const { data: items } = await supabase
        .from("order_items")
        .select("*")
        .gte("created_at", startISO)
        .lte("created_at", endISO);

    const filteredItems =
        items?.filter((i: any) =>
            orders?.some((o: any) => o.id === i.order_id)
        ) || [];

    //----------------------------------
    // SUMMARY
    //----------------------------------

    const totalOrders = orders?.length || 0;

    const totalRevenue =
        orders?.reduce((sum, o) =>
            sum + Number(o.price_paid || 0), 0) || 0;

    const totalItems =
        filteredItems.reduce((sum, i) =>
            sum + i.quantity, 0);

    //----------------------------------
    // BUILD PRODUCT TABLE
    //----------------------------------

    const productMap: any = {};

    filteredItems.forEach((item: any) => {
        const key = `${item.product_name}-${item.color}-${item.size}`;
        if (!productMap[key]) {
            productMap[key] = {
                product: item.product_name,
                color: item.color || "N/A",
                size: item.size,
                qty: 0,
            };
        }
        productMap[key].qty += item.quantity;
    });

    let rows = "";
    Object.values(productMap).forEach((p: any, index: number) => {
        const bg = index % 2 === 0 ? "#ffffff" : "#f9fafb";
        rows += `
        <tr style="background-color: ${bg}; border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 16px; font-size: 14px; color: #374151;">${p.product}</td>
          <td style="padding: 12px 16px; font-size: 14px; color: #4b5563;">${p.color}</td>
          <td style="padding: 12px 16px; font-size: 14px; color: #4b5563; text-align: center;">
            <span style="background: #e5e7eb; padding: 2px 10px; border-radius: 12px; font-weight: 600; font-size: 12px; color: #374151;">${p.size}</span>
          </td>
          <td style="padding: 12px 16px; font-size: 14px; font-weight: 700; color: #111827; text-align: center;">${p.qty}</td>
        </tr>`;
    });

    const displayStoreName = storeName
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());

    //----------------------------------
    // BUILD HTML
    //----------------------------------

    const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 30px 15px; background: #f9fafb; min-height: 100vh;">
      <div style="max-width: 600px; margin: 0 auto;">

        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; background: #fee2e2; color: #991b1b; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 14px;">
            Store Closed
          </div>
          <h1 style="color: #111827; margin: 0 0 6px 0; font-size: 26px; font-weight: 700;">${displayStoreName}</h1>
          <p style="color: #6b7280; margin: 0; font-size: 14px;">${formattedStart} &rarr; ${formattedEnd}</p>
        </div>

        <!-- Stats Row -->
        <table style="width: 100%; border-collapse: separate; border-spacing: 10px; margin: 0 -10px 30px -10px;">
          <tr>
            <td style="background: #ffffff; padding: 20px; border-radius: 10px; border: 1px solid #e5e7eb; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; font-weight: 700;">Total Orders</p>
              <p style="margin: 8px 0 0 0; font-size: 30px; font-weight: 700; color: #2563eb;">${totalOrders}</p>
            </td>
            <td style="background: #ffffff; padding: 20px; border-radius: 10px; border: 1px solid #e5e7eb; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; font-weight: 700;">Total Revenue</p>
              <p style="margin: 8px 0 0 0; font-size: 30px; font-weight: 700; color: #16a34a;">$${totalRevenue.toFixed(2)}</p>
            </td>
            <td style="background: #ffffff; padding: 20px; border-radius: 10px; border: 1px solid #e5e7eb; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; font-weight: 700;">Items Sold</p>
              <p style="margin: 8px 0 0 0; font-size: 30px; font-weight: 700; color: #9333ea;">${totalItems}</p>
            </td>
          </tr>
        </table>

        <!-- Product Breakdown -->
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 30px;">
          <div style="background: #f3f4f6; padding: 16px 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
            <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: #1f2937;">Order Breakdown</h2>
            <span style="background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 700;">
              $${totalRevenue.toFixed(2)} revenue
            </span>
          </div>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #ffffff; border-bottom: 2px solid #e5e7eb;">
                  <th style="padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; font-weight: 700;">Product</th>
                  <th style="padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; font-weight: 700;">Color</th>
                  <th style="padding: 12px 16px; text-align: center; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; font-weight: 700;">Size</th>
                  <th style="padding: 12px 16px; text-align: center; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; font-weight: 700;">Qty</th>
                </tr>
              </thead>
              <tbody>
                ${rows || `<tr><td colspan="4" style="padding: 24px; text-align: center; color: #9ca3af; font-size: 14px;">No items ordered during this session.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="font-size: 12px; color: #9ca3af; margin: 0;">
            Automated report by <strong style="color: #6b7280;">AurixLab</strong>
          </p>
        </div>

      </div>
    </div>
    `;

    //----------------------------------
    // SEND EMAIL
    //----------------------------------

    await resend.emails.send({
        from: "AurixLab Automation <onboarding@resend.dev>",
        to: "0168mehrab@gmail.com",
        subject: `Store Closed — ${displayStoreName}`,
        html,
    });
}