import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function GET() {
  try {
    // ----------------------------------
    // DATE RANGE (Last week)
    // ----------------------------------
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 7);

    const startISO = start.toISOString();
    const endISO = now.toISOString();

    const formattedStartDate = start.toLocaleDateString("en-US", { month: 'short', day: 'numeric' });
    const formattedEndDate = now.toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' });

    // ----------------------------------
    // FETCH STORES (active OR closed this week)
    // ----------------------------------

    const { data: stores } = await supabase
      .from("stores")
      .select("*")
      .or(`closed_at.is.null,closed_at.gt.${startISO}`);

    const validStores = new Set(
      stores?.map((s: any) => s.name) || []
    );

    // ----------------------------------
    // FETCH ORDERS
    // ----------------------------------

    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .gte("ordered_at", startISO)
      .lte("ordered_at", endISO);

    // Filter orders by valid stores
    const filteredOrders =
      orders?.filter((o: any) => validStores.has(o.store_name)) || [];

    // ----------------------------------
    // FETCH ITEMS
    // ----------------------------------

    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .gte("created_at", startISO)
      .lte("created_at", endISO);

    // Only keep items belonging to filtered orders
    const filteredItems =
      items?.filter((i: any) =>
        filteredOrders.some((o: any) => o.id === i.order_id)
      ) || [];

    // ----------------------------------
    // GLOBAL SUMMARY
    // ----------------------------------
    const totalOrders = filteredOrders.length || 0;

    const totalAmount =
      filteredOrders.reduce((sum, o) => sum + Number(o.price_paid || 0), 0) || 0;

    const totalSkus =
      filteredItems.reduce((sum, i) => sum + i.quantity, 0) || 0;

    // ----------------------------------
    // STORE GROUPING
    // ----------------------------------
    const storeMap: any = {};

    filteredOrders.forEach((order) => {
      const store = order.collection_handle || "Unknown";
      if (!storeMap[store]) {
        storeMap[store] = { orders: [], items: [], storeRevenue: 0 };
      }
      storeMap[store].orders.push(order);
      storeMap[store].storeRevenue += Number(order.price_paid || 0);
    });

    filteredItems.forEach((item) => {
      const order = filteredOrders.find((o) => o.id === item.order_id);
      const store = order?.collection_handle || "Unknown";
      if (!storeMap[store]) {
        storeMap[store] = { orders: [], items: [], storeRevenue: 0 };
      }
      storeMap[store].items.push(item);
    });

    // ----------------------------------
    // BUILD HTML
    // ----------------------------------
    let storeSections = "";

    for (const store in storeMap) {
      const storeData = storeMap[store];
      const productMap: any = {};

      // Group items by Product + Color + Size
      storeData.items.forEach((item: any) => {
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
        // Striped rows for better readability
        const bg = index % 2 === 0 ? "#ffffff" : "#f9fafb";
        rows += `
        <tr style="background-color: ${bg}; border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px; font-size: 14px; color: #374151;">${p.product}</td>
          <td style="padding: 12px; font-size: 14px; color: #4b5563;">${p.color}</td>
          <td style="padding: 12px; font-size: 14px; color: #4b5563; text-align: center;">
            <span style="background: #e5e7eb; padding: 2px 8px; border-radius: 12px; font-weight: bold; font-size: 12px;">${p.size}</span>
          </td>
          <td style="padding: 12px; font-size: 14px; font-weight: bold; color: #111827; text-align: center;">${p.qty}</td>
        </tr>
        `;
      });

      // Format store name for display (e.g., LION'S-VOLLEYBALL-CLUB -> Lion's Volleyball Club)
      const displayStoreName = store.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      storeSections += `
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 30px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="background: #f3f4f6; padding: 16px 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0; font-size: 18px; color: #1f2937;">${displayStoreName}</h2>
          <span style="background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 16px; font-size: 14px; font-weight: bold;">
            Revenue: $${storeData.storeRevenue.toFixed(2)}
          </span>
        </div>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #ffffff; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Product</th>
                <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Color</th>
                <th style="padding: 12px; text-align: center; font-size: 12px; text-transform: uppercase; color: #6b7280;">Size</th>
                <th style="padding: 12px; text-align: center; font-size: 12px; text-transform: uppercase; color: #6b7280;">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #9ca3af;">No items ordered this week.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      `;
    }

    // ----------------------------------
    // FINAL EMAIL HTML
    // ----------------------------------
    const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 30px 15px; background: #f9fafb; min-height: 100vh;">
      
      <div style="max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #111827; margin: 0 0 8px 0; font-size: 26px;">Weekly Store Summary</h1>
          <p style="color: #6b7280; margin: 0; font-size: 14px;">Report for ${formattedStartDate} - ${formattedEndDate}</p>
        </div>

        <div style="display: block; margin-bottom: 30px;">
          <table style="width: 100%; border-spacing: 10px; border-collapse: separate; margin: -10px;">
            <tr>
              <td style="width: 33%; background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <p style="margin: 0; font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: bold;">Total Orders</p>
                <p style="margin: 8px 0 0 0; font-size: 28px; font-weight: bold; color: #2563eb;">${totalOrders}</p>
              </td>
              <td style="width: 33%; background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <p style="margin: 0; font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: bold;">Total Revenue</p>
                <p style="margin: 8px 0 0 0; font-size: 28px; font-weight: bold; color: #16a34a;">$${totalAmount.toFixed(2)}</p>
              </td>
              <td style="width: 33%; background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <p style="margin: 0; font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: bold;">Items Sold</p>
                <p style="margin: 8px 0 0 0; font-size: 28px; font-weight: bold; color: #9333ea;">${totalSkus}</p>
              </td>
            </tr>
          </table>
        </div>

        ${storeSections}

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="font-size: 12px; color: #9ca3af; margin: 0;">
            Automated report generated by <strong>AurixLab</strong>
          </p>
        </div>
      </div>

    </div>
    `;
    // ----------------------------------
    // SEND EMAIL
    // ----------------------------------
    console.log("📧 Sending weekly summary email...", html);
    const emailsent = await resend.emails.send({

      from: "AurixLab Automation <onboarding@resend.dev>",

      to: "0168mehrab@gmail.com",

      subject: "Weekly Store Summary",

      html

    });
    console.log("📧 Weekly summary email sent:", emailsent);
    return NextResponse.json({ success: true });

  } catch (err) {

    console.error(err);

    return NextResponse.json({ error: "failed" });

  }

}

