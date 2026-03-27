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
    // SEND EMAIL
    //----------------------------------

    await resend.emails.send({

        from: "AurixLab Automation <onboarding@resend.dev>",

        to: "0168mehrab@gmail.com",

        subject: `Store Closed Summary — ${storeName}`,

        html: `
      <h1>🔴 Store Closed Summary</h1>
      <p>${storeName}</p>

      <p>Total Orders: ${totalOrders}</p>
      <p>Total Revenue: $${totalRevenue}</p>
      <p>Total Items: ${totalItems}</p>

      <p>
        ${new Date(startISO).toLocaleDateString()} 
        →
        ${new Date(endISO).toLocaleDateString()}
      </p>
    `

    });

}