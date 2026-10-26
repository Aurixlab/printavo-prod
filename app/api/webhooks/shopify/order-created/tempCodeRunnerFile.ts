// const body = await req.text();
// const hmac = req.headers.get("x-shopify-hmac-sha256") || "";

// const hash = crypto.createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!).update(body, "utf8").digest("base64");
// if (hash !== hmac) return new NextResponse("Unauthorized", { status: 401 });

// const order = JSON.parse(body);
// console.log("📦 NEW SHOPIFY ORDER RECEIVED:: ", order);
// require("dotenv").config();

// const { createClient } = require("@supabase/supabase-js");

// const supabase = createClient(
//     process.env.SUPABASE_URL,
//     process.env.SUPABASE_SERVICE_ROLE_KEY
// );

// async function test() {
//     const { data, error } = await supabase
//         .from("webstore_orders")
//         .insert({
//             collection_handle: "test-store",
//             product_id: "123",
//             product_name: "Test Shirt",
//             color: "Black",
//             size: "L",
//             quantity: 5
//         });

//     console.log("DATA:", data);
//     console.log("ERROR:", error);
// }

// test();