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
        // VERIFY SHOPIFY WEBHOOK
        //----------------------------------

        const rawBody = await req.text();

        const hmacHeader = req.headers.get("x-shopify-hmac-sha256") || "";

        const generatedHash = crypto
            .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!)
            .update(rawBody, "utf8")
            .digest("base64");

        if (generatedHash !== hmacHeader) {
            console.error("Invalid Shopify webhook signature");
            return new NextResponse("Unauthorized", { status: 401 });
        }

        //----------------------------------
        // PARSE COLLECTION DATA
        //----------------------------------

        const collection = JSON.parse(rawBody);
        console.log("Collection update received:", collection);
        const handle = collection.handle;

        console.log("Collection update received:", handle);

        //----------------------------------
        // DETECT IF COLLECTION IS ARCHIVED
        //----------------------------------

        /**
         * Shopify doesn't send a direct "archived" field for collections.
         * When you uncheck "Online Store" from sales channels,
         * the collection stops being published.
         */

        const isPublishedOnline =
            collection.published_scope === "web" ||
            collection.published_scope === "global";

        //----------------------------------
        // STORE CLOSED
        //----------------------------------

        if (!isPublishedOnline) {

            console.log("Store closed:", handle);

            await supabase
                .from("stores")
                .update({
                    is_active: false,
                    closed_at: new Date().toISOString()
                })
                .eq("collection_handle", handle);

        }

        //----------------------------------
        // STORE REOPENED
        //----------------------------------

        if (isPublishedOnline) {

            console.log("Store reopened:", handle);

            await supabase
                .from("stores")
                .update({
                    is_active: true,
                    closed_at: null
                })
                .eq("collection_handle", handle);

        }

        return NextResponse.json({ success: true });

    } catch (err) {

        console.error("Collection webhook error:", err);

        return new NextResponse("Server Error", { status: 500 });

    }

}