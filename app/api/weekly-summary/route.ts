// import { NextResponse } from "next/server";
// import { createClient } from "@supabase/supabase-js";
// import { Resend } from "resend";

// const supabase = createClient(
//   process.env.SUPABASE_URL!,
//   process.env.SUPABASE_SERVICE_ROLE_KEY!
// );

// const resend = new Resend(process.env.RESEND_API_KEY!);

// export async function GET() {
//   try {

//     //----------------------------------
//     // DATE RANGE (Weekly)
//     //----------------------------------

//     const now = new Date();
//     const start = new Date();
//     start.setDate(now.getDate() - 7);

//     const startISO = start.toISOString();
//     const endISO = now.toISOString();

//     const formattedStart = start.toLocaleDateString("en-US", {
//       month: "short",
//       day: "numeric"
//     });

//     const formattedEnd = now.toLocaleDateString("en-US", {
//       month: "short",
//       day: "numeric",
//       year: "numeric"
//     });

//     //----------------------------------
//     // FETCH RUNNING STORES ONLY
//     //----------------------------------

//     const { data: stores } = await supabase
//       .from("stores")
//       .select("*")
//       .or("is_active.eq.true,closed_at.is.null");

//     //----------------------------------
//     // FETCH ORDERS
//     //----------------------------------

//     const { data: orders } = await supabase
//       .from("orders")
//       .select("*");

//     //----------------------------------
//     // FETCH ITEMS
//     //----------------------------------

//     const { data: items } = await supabase
//       .from("order_items")
//       .select("*");

//     //----------------------------------
//     // BUILD STORE SESSIONS
//     //----------------------------------

//     const storeSessions =
//       stores?.map((s: any) => ({
//         key: `${s.name}-${s.created_at}`,
//         name: s.name,
//         created_at: s.created_at,
//         start: new Date(s.created_at),
//         end: new Date(),
//       })) || [];

//     //----------------------------------
//     // FILTER WEEKLY ORDERS
//     //----------------------------------

//     const weeklyOrders =
//       orders?.filter((order: any) => {

//         const orderDate = new Date(order.ordered_at);

//         if (orderDate < start || orderDate > now) return false;

//         return storeSessions.some(session =>
//           session.name === order.store_name &&
//           orderDate >= session.start &&
//           orderDate <= session.end
//         );

//       }) || [];

//     //----------------------------------
//     // FILTER LIFETIME ORDERS
//     //----------------------------------

//     const lifetimeOrders =
//       orders?.filter((order: any) => {

//         const orderDate = new Date(order.ordered_at);

//         return storeSessions.some(session =>
//           session.name === order.store_name &&
//           orderDate >= session.start &&
//           orderDate <= session.end
//         );

//       }) || [];

//     //----------------------------------
//     // ITEMS FILTER
//     //----------------------------------

//     const weeklyItems =
//       items?.filter((i: any) =>
//         weeklyOrders.some((o: any) => o.id === i.order_id)
//       ) || [];

//     const lifetimeItems =
//       items?.filter((i: any) =>
//         lifetimeOrders.some((o: any) => o.id === i.order_id)
//       ) || [];

//     //----------------------------------
//     // BUILD STORE SECTION FUNCTION
//     //----------------------------------

//     function buildStoreSections(ordersData: any[], itemsData: any[], isLifetime = false) {

//       const storeMap: any = {};

//       ordersData.forEach(order => {

//         const session = storeSessions.find(s =>
//           s.name === order.store_name &&
//           new Date(order.ordered_at) >= s.start
//         );

//         if (!session) return;

//         const key = session.key;

//         if (!storeMap[key]) {
//           storeMap[key] = {
//             name: session.name,
//             created_at: session.created_at,
//             orders: [],
//             items: [],
//             revenue: 0
//           };
//         }

//         storeMap[key].orders.push(order);
//         storeMap[key].revenue += Number(order.price_paid || 0);
//       });

//       itemsData.forEach(item => {
//         const order = ordersData.find(o => o.id === item.order_id);
//         if (!order) return;

//         const session = storeSessions.find(s =>
//           s.name === order.store_name &&
//           new Date(order.ordered_at) >= s.start
//         );

//         if (!session) return;

//         storeMap[session.key].items.push(item);
//       });

//       //----------------------------------
//       // BUILD HTML
//       //----------------------------------

//       let html = "";

//       Object.values(storeMap).forEach((store: any) => {

//         //----------------------------------
//         // PRODUCT + SIZE MATRIX
//         //----------------------------------

//         const productMap: any = {};
//         const sizeSet = new Set<string>();

//         store.items.forEach((item: any) => {

//           const product = item.product_name;

//           if (!productMap[product]) {
//             productMap[product] = {};
//           }

//           productMap[product][item.size] =
//             (productMap[product][item.size] || 0) + item.quantity;

//           sizeSet.add(item.size);
//         });

//         const sizes = Array.from(sizeSet).sort();

//         //----------------------------------
//         // TABLE HEADER
//         //----------------------------------

//         let header = `
//         <th style="padding:12px;text-align:left">Product</th>
//         ${sizes.map(s =>
//           `<th style="padding:12px;text-align:center">${s}</th>`
//         ).join("")}
//         <th style="padding:12px;text-align:center">Total</th>
//         `;

//         //----------------------------------
//         // ROWS
//         //----------------------------------

//         let rows = "";

//         Object.keys(productMap).forEach((product, index) => {

//           const bg = index % 2 ? "#f9fafb" : "#ffffff";

//           let total = 0;

//           const sizeCols = sizes.map(size => {
//             const qty = productMap[product][size] || 0;
//             total += qty;
//             return `<td style="padding:12px;text-align:center">${qty}</td>`;
//           }).join("");

//           rows += `
//           <tr style="background:${bg}">
//             <td style="padding:12px">${product}</td>
//             ${sizeCols}
//             <td style="padding:12px;font-weight:bold;text-align:center">${total}</td>
//           </tr>
//           `;
//         });

//         //----------------------------------
//         // STORE HEADER
//         //----------------------------------

//         const created = new Date(store.created_at)
//           .toLocaleDateString("en-US", {
//             month: "short",
//             day: "numeric",
//             year: "numeric"
//           });

//         html += `
//         <div style="background:#fff;border-radius:8px;margin-bottom:30px;border:1px solid #e5e7eb">

//           <div style="padding:16px;background:#f3f4f6;border-bottom:1px solid #e5e7eb">
//             <h2 style="margin:0">${store.name}</h2>
//             <div style="font-size:12px;color:#6b7280">
//               Store Created: ${created}
//               ${isLifetime ? ` • Inception Summary` : ""}
//             </div>
//             <div style="font-weight:bold;color:#16a34a">
//               Revenue: $${store.revenue.toFixed(2)}
//             </div>
//           </div>

//           <table style="width:100%;border-collapse:collapse">
//             <thead>
//               <tr style="background:#fafafa">
//                 ${header}
//               </tr>
//             </thead>
//             <tbody>
//               ${rows}
//             </tbody>
//           </table>

//         </div>
//         `;
//       });

//       return html;
//     }

//     //----------------------------------
//     // GLOBAL SUMMARY
//     //----------------------------------

//     const weeklyRevenue =
//       weeklyOrders.reduce((s, o) => s + Number(o.price_paid || 0), 0);

//     const weeklyOrdersCount = weeklyOrders.length;

//     const weeklyItemsCount =
//       weeklyItems.reduce((s, i) => s + i.quantity, 0);

//     //----------------------------------
//     // HTML
//     //----------------------------------

//     const html = `
//     <div style="font-family:Arial;padding:30px;background:#f9fafb">

//       <h1>Weekly Store Summary</h1>
//       <p>${formattedStart} - ${formattedEnd}</p>

//       <div>
//         Orders: ${weeklyOrdersCount} <br/>
//         Revenue: $${weeklyRevenue.toFixed(2)} <br/>
//         Items: ${weeklyItemsCount}
//       </div>

//       ${buildStoreSections(weeklyOrders, weeklyItems)}

//       <hr style="margin:50px 0"/>

//       <h1>Running Store Lifetime Summary</h1>
//       <p>From Store Creation → Current</p>

//       ${buildStoreSections(lifetimeOrders, lifetimeItems, true)}

//     </div>
//     `;

//     //----------------------------------
//     // SEND EMAIL
//     //----------------------------------

//     await resend.emails.send({
//       from: "AurixLab Webstore Automation <webstores@aurixlab.com>",
//       to: "0168mehrab@gmail.com",
//       subject: "Weekly + Running Store Summary",
//       html
//     });

//     return NextResponse.json({ success: true });

//   } catch (err) {

//     console.error(err);

//     return NextResponse.json({ error: "failed" });

//   }
// }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function GET() {
  try {

    //----------------------------------
    // DATE RANGE
    //----------------------------------

    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - 7);

    const startISO = start.toISOString();
    const endISO = now.toISOString();

    const formattedStart = start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });

    const formattedEnd = now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    //----------------------------------
    // FETCH DATA
    //----------------------------------

    const { data: stores } = await supabase
      .from("stores")
      .select("*")
      .or("is_active.eq.true,closed_at.is.null");

    const { data: orders } = await supabase
      .from("orders")
      .select("*");

    const { data: items } = await supabase
      .from("order_items")
      .select("*");

    //----------------------------------
    // STORE SESSIONS
    //----------------------------------

    const storeSessions =
      stores?.map((s: any) => ({
        key: `${s.name}-${s.created_at}`,
        name: s.name,
        created_at: s.created_at,
        start: new Date(s.created_at),
        end: new Date(),
      })) || [];

    //----------------------------------
    // WEEKLY ORDERS
    //----------------------------------

    const weeklyOrders =
      orders?.filter((order: any) => {

        const orderDate = new Date(order.ordered_at);

        if (orderDate < start || orderDate > now) return false;

        return storeSessions.some(session =>
          session.name === order.store_name &&
          orderDate >= session.start &&
          orderDate <= session.end
        );

      }) || [];

    //----------------------------------
    // LIFETIME ORDERS
    //----------------------------------

    const lifetimeOrders =
      orders?.filter((order: any) => {

        const orderDate = new Date(order.ordered_at);

        return storeSessions.some(session =>
          session.name === order.store_name &&
          orderDate >= session.start &&
          orderDate <= session.end
        );

      }) || [];

    //----------------------------------
    // ITEMS
    //----------------------------------

    const weeklyItems =
      items?.filter((i: any) =>
        weeklyOrders.some((o: any) => o.id === i.order_id)
      ) || [];

    const lifetimeItems =
      items?.filter((i: any) =>
        lifetimeOrders.some((o: any) => o.id === i.order_id)
      ) || [];

    //----------------------------------
    // STORE SECTION BUILDER
    //----------------------------------

    function buildStoreSections(ordersData: any[], itemsData: any[], isLifetime = false) {

      const storeMap: any = {};

      ordersData.forEach(order => {

        const session = storeSessions.find(s =>
          s.name === order.store_name &&
          new Date(order.ordered_at) >= s.start
        );

        if (!session) return;

        const key = session.key;

        if (!storeMap[key]) {
          storeMap[key] = {
            name: session.name,
            created_at: session.created_at,
            orders: [],
            items: [],
            revenue: 0
          };
        }

        storeMap[key].orders.push(order);
        storeMap[key].revenue += Number(order.price_paid || 0);
      });

      itemsData.forEach(item => {

        const order = ordersData.find(o => o.id === item.order_id);
        if (!order) return;

        const session = storeSessions.find(s =>
          s.name === order.store_name &&
          new Date(order.ordered_at) >= s.start
        );

        if (!session) return;

        storeMap[session.key].items.push(item);
      });

      let html = "";

      Object.values(storeMap).forEach((store: any) => {

        const productMap: any = {};
        const sizeSet = new Set<string>();

        store.items.forEach((item: any) => {

          const product = item.product_name;

          if (!productMap[product]) {
            productMap[product] = {};
          }

          productMap[product][item.size] =
            (productMap[product][item.size] || 0) + item.quantity;

          sizeSet.add(item.size);
        });

        const sizes = Array.from(sizeSet).sort();

        let header = `
        <th style="padding:12px;text-align:left">Product</th>
        ${sizes.map(s =>
          `<th style="padding:12px;text-align:center">${s}</th>`
        ).join("")}
        <th style="padding:12px;text-align:center">Total</th>
        `;

        let rows = "";

        Object.keys(productMap).forEach((product, index) => {

          const bg = index % 2 ? "#f9fafb" : "#ffffff";

          let total = 0;

          const sizeCols = sizes.map(size => {
            const qty = productMap[product][size] || 0;
            total += qty;
            return `<td style="padding:12px;text-align:center">${qty}</td>`;
          }).join("");

          rows += `
          <tr style="background:${bg}">
            <td style="padding:12px">${product}</td>
            ${sizeCols}
            <td style="padding:12px;font-weight:bold;text-align:center">${total}</td>
          </tr>
          `;
        });

        const created = new Date(store.created_at)
          .toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          });

        html += `
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; margin-bottom: 30px;">
          <div style="background: #f3f4f6; padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
            <h2 style="margin:0">${store.name}</h2>
            <div style="font-size:12px;color:#6b7280">
              Created: ${created}
              ${isLifetime ? ` • Lifetime` : ""}
            </div>
            <div style="font-weight:700;color:#16a34a">
              Revenue: $${store.revenue.toFixed(2)}
            </div>
          </div>

          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#fafafa">
                ${header}
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

        </div>
        `;
      });

      return html;
    }

    //----------------------------------
    // SUMMARY
    //----------------------------------

    const weeklyRevenue =
      weeklyOrders.reduce((s, o) => s + Number(o.price_paid || 0), 0);

    const weeklyOrdersCount = weeklyOrders.length;

    const weeklyItemsCount =
      weeklyItems.reduce((s, i) => s + i.quantity, 0);

    //----------------------------------
    // HTML
    //----------------------------------

    const html = `
<div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 30px 15px; background: #f9fafb; min-height: 100vh;">
<div style="max-width:600px;margin:0 auto">

<div style="text-align:center;margin-bottom:30px">
<div style="display:inline-block;background:#e0f2fe;color:#075985;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700">
Weekly Summary
</div>

<h1 style="margin:10px 0 6px 0">Budget Promotion Webstores</h1>
<p style="color:#6b7280">${formattedStart} → ${formattedEnd}</p>
</div>

<table style="width:100%;border-spacing:10px">
<tr>

<td style="background:#fff;padding:20px;border-radius:10px;text-align:center">
<p>Total Orders</p>
<h2>${weeklyOrdersCount}</h2>
</td>

<td style="background:#fff;padding:20px;border-radius:10px;text-align:center">
<p>Revenue</p>
<h2>$${weeklyRevenue.toFixed(2)}</h2>
</td>

<td style="background:#fff;padding:20px;border-radius:10px;text-align:center">
<p>Items</p>
<h2>${weeklyItemsCount}</h2>
</td>

</tr>
</table>

${buildStoreSections(weeklyOrders, weeklyItems)}

<hr style="margin:40px 0"/>

<div style="text-align:center;margin-bottom:20px">
<div style="display:inline-block;background:#fef3c7;color:#92400e;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700">
Running Store Lifetime
</div>
</div>

${buildStoreSections(lifetimeOrders, lifetimeItems, true)}

<div style="margin-top:40px;text-align:center;color:#9ca3af">
Automated by AurixLab
</div>

</div>
</div>
`;

    //----------------------------------
    // SEND
    //----------------------------------

    await resend.emails.send({
      from: "AurixLab Webstore Automation <webstores@aurixlab.com>",
      to: "aurixlab@gmail.com",
      // cc: "0168mehrab@gmail.com",
      subject: "Budget Promotions Webstores Weekly + Running Store Summary",
      html
    });

    return NextResponse.json({ success: true });

  } catch (err) {

    console.error(err);

    return NextResponse.json({ error: "failed" });

  }
}