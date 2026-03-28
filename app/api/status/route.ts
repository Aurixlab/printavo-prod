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

        if (!loginData.token) {
            return NextResponse.json(
                { error: "Printavo login failed", loginData },
                { status: 500 }
            );
        }

        const token = loginData.token;

        // ----------------------------------
        // GET ORDER STATUSES
        // ----------------------------------

        const statusRes = await fetch(
            `https://www.printavo.com/api/v1/orderstatuses?email=aurixlab@gmail.com&token=${token}&per_page=100`
        );

        const statusData: any = await statusRes.json();

        if (!statusData.data) {
            return NextResponse.json(
                { error: "Failed to fetch statuses", statusData },
                { status: 500 }
            );
        }

        // ----------------------------------
        // FIND WEBSTORE-2026
        // ----------------------------------

        // console.log("Printavo Statuses:", statusData.data);

        const webstoreStatus = statusData.data.find(
            (status: any) =>
                status.name?.trim().toLowerCase() === "webstore-2026"
        );
        const webstore = statusData.data.find(
            (s: any) =>
                s.name?.toLowerCase().trim() === "webstore-2026"
        );

        console.log("WEBSTORE:", webstore);

        if (!webstoreStatus) {
            return NextResponse.json(
                { error: "WEBSTORE-2026 not found" },
                { status: 404 }
            );
        }

        // ----------------------------------
        // RETURN RESPONSE
        // ----------------------------------

        return NextResponse.json({
            success: true,
            statusId: webstoreStatus.id,
            status: webstoreStatus
        });

    } catch (error: any) {
        console.error("Printavo Error:", error);

        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: error.message
            },
            { status: 500 }
        );
    }
}