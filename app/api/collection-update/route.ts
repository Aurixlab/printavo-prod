import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendStoreCloseSummary } from "../../../lib/store-close-summary/route";
import { sendStoreResumeSummary } from "../../../lib/store-resume-summary/route";
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

        const customUrl = `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01/custom_collections/${collection.id}.json`;
        const metaUrl = `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01/collections/${collection.id}/metafields.json`;


        const customRes = await fetch(customUrl, {
            headers: { "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN! }
        });

        console.log("Custom collection status:", customRes.status);
        const customData: any = await customRes.json();
        console.log("Custom collection response:", JSON.stringify(customData, null, 2));

        console.log("Fetching metafields:", metaUrl);

        const metaRes = await fetch(metaUrl, {
            headers: { "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN! }
        });

        console.log("Metafields response status:", metaRes.status);
        const metaData: any = await metaRes.json();
        console.log("Metafields raw response:", JSON.stringify(metaData, null, 2));

        const storeStatus = metaData.metafields?.find(
            (m: any) => m.namespace === "custom" && m.key === "store_status"
        )?.value ?? null;

        const storeName = metaData.metafields?.find(
            (m: any) => m.namespace === "custom" && m.key === "store_name"
        )?.value ?? null;

        console.log("Store status:", storeStatus);
        console.log("Store name:", storeName);
        if (storeStatus.toLowerCase() === "resume") {

            const { data: lastStore } = await supabase
                .from("stores")
                .select("*")
                .eq("name", storeName)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

            if (lastStore) {
                await supabase
                    .from("stores")
                    .update({
                        is_active: true,
                        closed_at: null,
                    })
                    .eq("id", lastStore.id);
                await sendStoreResumeSummary(storeName);
            }
        }

        else if (storeStatus.toLowerCase() === "closed") {

            const { data: lastStore } = await supabase
                .from("stores")
                .select("*")
                .eq("name", storeName)
                .eq("is_active", true)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

            if (lastStore) {
                await supabase
                    .from("stores")
                    .update({
                        is_active: false,
                        closed_at: new Date().toISOString(),
                    })
                    .eq("id", lastStore.id);

                await sendStoreCloseSummary(storeName);
            }
        }
        else if (storeStatus.toLowerCase() === "open") {

            //----------------------------------
            // CHECK ACTIVE STORE
            //----------------------------------

            const { data: activeStore } = await supabase
                .from("stores")
                .select("*")
                .eq("name", storeName)
                .eq("is_active", true)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            //----------------------------------
            // IF ACTIVE STORE EXISTS → IGNORE
            //----------------------------------

            if (activeStore) {
                console.log("Active store already exists, skipping creation:", storeName);
                return NextResponse.json({ skipped: true });
            }

            //----------------------------------
            // CREATE NEW STORE
            //----------------------------------

            console.log("Creating new store:", storeName);

            const { error } = await supabase
                .from("stores")
                .insert({
                    name: storeName,
                    created_at: new Date().toISOString(),
                    is_active: true,
                    closed_at: null
                });

            if (error) {
                console.error("Store insert error:", error);
            }
        }

        return NextResponse.json({ success: true });

    } catch (err) {
        console.error("Collection webhook error:", err);
        return new NextResponse("Server Error", { status: 500 });
    }
}