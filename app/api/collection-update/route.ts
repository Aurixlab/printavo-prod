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
        // FETCH ACCESS TOKEN
        //----------------------------------
        const shop = req.headers.get("x-shopify-shop-domain");

        if (!shop) {
            console.error("Missing shop domain header.");
            return new NextResponse("Bad Request: Missing shop domain", { status: 400 });
        }

        // Request a new token using client credentials
        const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "client_credentials",
                client_id: process.env.SHOPIFY_CLIENT_ID!,
                client_secret: process.env.SHOPIFY_CLIENT_SECRET!,
            }).toString(),
        });

        if (!tokenRes.ok) {
            const errorText = await tokenRes.text();
            console.error("Failed to fetch access token:", errorText);
            return new NextResponse("Failed to authenticate with Shopify", { status: 500 });
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        //----------------------------------
        // FETCH COLLECTION METAFIELDS
        //----------------------------------
        const metafieldRes = await fetch(
            `https://${shop}/admin/api/2024-01/collections/${collection.id}/metafields.json`,
            {
                headers: {
                    "X-Shopify-Access-Token": accessToken,
                    "Content-Type": "application/json"
                }
            }
        );

        const raw = await metafieldRes.text();

        console.log("Metafield API status:", metafieldRes.status);
        console.log("Metafield API response:", raw);

        if (!metafieldRes.ok) {
            // Failsafe in case the token lacks scopes or the endpoint changes
            throw new Error(`Shopify API responded with ${metafieldRes.status}: ${raw}`);
        }

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