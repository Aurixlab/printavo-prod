import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendStoreResumeSummary(storeName: string) {

    //----------------------------------
    // GET STORE
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
    const endISO = new Date().toISOString();

    const formattedStart = new Date(startISO)
        .toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });

    //----------------------------------
    // FETCH ORDERS
    //----------------------------------

    const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .eq("store_name", storeName)
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

    //----------------------------------
    // SUMMARY
    //----------------------------------

    const totalOrders = orders?.length || 0;

    const totalRevenue =
        orders?.reduce((sum, o) =>
            sum + Number(o.price_paid || 0), 0) || 0;

    const totalItems =
        items?.reduce((sum, i) =>
            sum + i.quantity, 0) || 0;

    const displayStoreName = storeName
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, l => l.toUpperCase());

    //----------------------------------
    // HTML
    //----------------------------------

    const html = `
<div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 30px 15px; background: #f9fafb; min-height: 100vh;">
<div style="max-width:600px;margin:0 auto">

<div style="text-align:center;margin-bottom:30px">

<div style="display:inline-block;background:#fef3c7;color:#92400e;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700">
Store Resumed
</div>

<h1 style="margin:10px 0 6px 0">
${displayStoreName}
</h1>

<p style="color:#6b7280">
${formattedStart} → Now
</p>

</div>

<table style="width:100%;border-spacing:10px">

<tr>

<td style="background:#fff;padding:20px;border-radius:10px;text-align:center">
<p>Total Orders</p>
<h2>${totalOrders}</h2>
</td>

<td style="background:#fff;padding:20px;border-radius:10px;text-align:center">
<p>Total Revenue</p>
<h2>$${totalRevenue.toFixed(2)}</h2>
</td>

<td style="background:#fff;padding:20px;border-radius:10px;text-align:center">
<p>Items Sold</p>
<h2>${totalItems}</h2>
</td>

</tr>

</table>

<div style="margin-top:40px;text-align:center;color:#9ca3af">
Automated report by AurixLab
</div>

</div>
</div>
`;

    //----------------------------------
    // SEND EMAIL
    //----------------------------------

    await resend.emails.send({
        from: "AurixLab Webstore Automation <webstores@aurixlab.com>",
        to: "aurixlab@gmail.com",
        // cc: "0168mehrab@gmail.com",
        subject: `Store Resume Summary — ${displayStoreName}`,
        html
    });

}