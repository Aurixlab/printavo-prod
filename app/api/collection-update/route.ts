import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {

    try {

        //----------------------------------
        // VERIFY WEBHOOK
        //----------------------------------

        const rawBody = await req.text();

        const hmac = req.headers.get("x-shopify-hmac-sha256") || "";

        const hash = crypto
            .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!)
            .update(rawBody, "utf8")
            .digest("base64");

        if (hash !== hmac) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        //----------------------------------
        // PARSE COLLECTION
        //----------------------------------

        const collection = JSON.parse(rawBody);

        const handle = collection.handle;
        console.log("Received collection update for:", collection);
        //----------------------------------
        // FETCH COLLECTION METAFIELDS
        //----------------------------------

        const shop = req.headers.get("x-shopify-shop-domain");

        const accessToken = process.env.SHOPIFY_ADMIN_TOKEN;

        const metafieldRes = await fetch(
            `https://${shop}/admin/api/2024-01/collections/${collection.id}/metafields.json`,
            {
                headers: {
                    "X-Shopify-Access-Token": accessToken!,
                    "Content-Type": "application/json"
                }
            }
        );

        const raw = await metafieldRes.text();

        console.log("Metafield API status:", metafieldRes.status);
        console.log("Metafield API response:", raw);

        const metafieldData = JSON.parse(raw);

        const statusField = metafieldData.metafields?.find(
            (m: any) =>
                m.namespace === "custom" &&
                m.key === "store_status"
        );

        const status = statusField?.value || "open";

        console.log("Collection status:", status);
        //----------------------------------
        // UPDATE DATABASE
        //----------------------------------

        if (status === "closed") {

            console.log("Closing store:", handle);

            await supabase
                .from("stores")
                .update({
                    is_active: false,
                    closed_at: new Date().toISOString(),
                })
                .eq("collection_handle", handle);

        } else {

            console.log("Opening store:", handle);

            await supabase
                .from("stores")
                .update({
                    is_active: true,
                    closed_at: null,
                })
                .eq("collection_handle", handle);

        }

        return NextResponse.json({ success: true });

    } catch (err) {

        console.error("Collection webhook error:", err);

        return new NextResponse("Server Error", { status: 500 });

    }

}