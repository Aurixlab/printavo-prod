    // const body = await req.text();
    // const hmac = req.headers.get("x-shopify-hmac-sha256") || "";

    // const hash = crypto.createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!).update(body, "utf8").digest("base64");
    // if (hash !== hmac) return new NextResponse("Unauthorized", { status: 401 });

    // const order = JSON.parse(body);
    // console.log("📦 NEW SHOPIFY ORDER RECEIVED:: ", order);