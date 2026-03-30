import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        // ----------------------------------
        // LOGIN TO PRINTAVO
        // ----------------------------------

        const loginRes = await fetch(
            "https://www.printavo.com/api/v1/sessions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: "aurixlab@gmail.com",
                    password: process.env.PRINTAVO_PASSWORD
                })
            }
        );

        const loginData: any = await loginRes.json();

        const token = loginData.token;
        const myUserId = loginData.id;
        if (!token) {
            return NextResponse.json(
                { error: "Login failed", loginData },
                { status: 500 }
            );
        }

        // ----------------------------------
        // SEARCH CUSTOMER BY EMAIL
        // ----------------------------------
        const { data: store, error } = await supabase
            .from("stores")
            .select("*")
            .eq("name", "Lions Volley Ball Club")
            .maybeSingle();

        console.log("Store found:", store, { error });
        if (!store) {
            return NextResponse.json(
                {
                    error: "Store not found",
                },
                { status: 400 }
            );
        }
        else if (!store?.customer_id) {
            let email = store.name.replace(/\s/g, "").toLocaleLowerCase() + "@budgetpromotion.com";
            const custRes = await fetch(
                `https://www.printavo.com/api/v1/customers?email=aurixlab@gmail.com&token=${token}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        user_id: myUserId,
                        first_name: store?.name || "Shopify",
                        // last_name: order.customer?.last_name || "Customer",
                        customer_email: email,
                    })
                }
            );
            const resp = await custRes.json()
            const custId = resp?.id;

            const { error } = await supabase
                .from('stores')
                .update({ customer_id: custId })
                .eq('name', store?.name);
            console.log("Updated store:", { customer_id: custId, name: store?.name });
        }
        // const searchEmail = "aurixlab@gmail.com";

        // const customerRes = await fetch(
        //     `https://www.printavo.com/api/v1/customers?email=aurixlab@gmail.com&token=${token}&query=${encodeURIComponent(
        //         searchEmail
        //     )}`
        // );

        // const customerData: any = await customerRes.json();

        // console.log("Customers:", customerData);

        // let page = 1;
        // let foundCustomer = null;

        // while (!foundCustomer) {
        //     const res = await fetch(
        //         `https://www.printavo.com/api/v1/customers?email=aurixlab@gmail.com&token=${token}&page=${page}`
        //     );

        //     const data = await res.json();

        //     foundCustomer = data.data.find((c: any) =>
        //         c.customer_email?.toLowerCase() === "aurixlab@gmail.com"
        //     );

        //     if (page >= data.meta.total_pages) break;

        //     page++;
        // }

        // console.log("FOUND:", foundCustomer);

        // if (!foundCustomer) {
        //     return NextResponse.json(
        //         { message: "Customer not found" },
        //         { status: 404 }
        //     );
        // }

        // return NextResponse.json({
        //     success: true,
        //     customerId: foundCustomer.id,
        //     foundCustomer
        // });

    } catch (error: any) {
        console.error(error);

        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: error.message
            },
            { status: 500 }
        );
    }
}