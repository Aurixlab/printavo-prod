// const body = await req.text();
// const hmac = req.headers.get("x-shopify-hmac-sha256") || "";

// const hash = crypto.createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!).update(body, "utf8").digest("base64");
// if (hash !== hmac) return new NextResponse("Unauthorized", { status: 401 });

// const order = JSON.parse(body);
// console.log("📦 NEW SHOPIFY ORDER RECEIVED:: ", order);
// require("dotenv").config();

// const { createClient } = require("@supabase/supabase-js");

// const supabase = createClient(
//     "https://qcbnpgctowjclxtalsmj.supabase.co",
//     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjYm5wZ2N0b3dqY2x4dGFsc21qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE0NDE2MSwiZXhwIjoyMDg4NzIwMTYxfQ._hm3Gb9a7uDQbuK00g_akkTjq3XUw8PCGJ5qkctSvuk"
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