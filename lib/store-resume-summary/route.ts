import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendStoreResumeSummary(storeName: string) {

    //----------------------------------
    // GET LAST STORE
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
    // SEND EMAIL
    //----------------------------------

    await resend.emails.send({

        from: "AurixLab Automation <onboarding@resend.dev>",

        to: "0168mehrab@gmail.com",

        subject: `Store Resume Summary — ${storeName}`,

        html: `
      <h1>🟡 Store Resume Summary</h1>
      <p>${storeName}</p>

      <p>Orders So Far: ${orders?.length || 0}</p>

      <p>
        ${new Date(startISO).toLocaleDateString()} 
        →
        Now
      </p>
    `

    });

}