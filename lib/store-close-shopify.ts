// Full customer details for a bulk webstore's orders, read from Shopify at closing time.
// The database only keeps name, email, phone, city and postal code.
//
// Never blocks the close: if Shopify cannot be reached, the batch goes out with the
// database's details and the failure is logged.

const ORDERS_QUERY = `
query StoreCloseOrders($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on Order {
      legacyResourceId
      name
      cancelledAt
      displayFinancialStatus
      email
      phone
      note
      shippingAddress { name address1 address2 city province zip country phone }
      billingAddress { name phone }
      shippingLines(first: 3) { nodes { title } }
    }
  }
}`;

export async function fetchShopifyOrders(shopifyOrderIds: Array<string | number>): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    const ids = Array.from(new Set(shopifyOrderIds.map(String)));
    for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50);
        try {
            const res = await fetch(`https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2025-07/graphql.json`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN!
                },
                body: JSON.stringify({ query: ORDERS_QUERY, variables: { ids: chunk.map(id => `gid://shopify/Order/${id}`) } })
            });
            const data: any = await res.json();
            if (data?.errors?.length) {
                console.warn("Store close: Shopify order details error:", JSON.stringify(data.errors).slice(0, 300));
                continue;
            }
            for (const n of data?.data?.nodes || []) {
                if (n?.legacyResourceId) result[String(n.legacyResourceId)] = n;
            }
        } catch (err: any) {
            console.warn("Store close: could not read order details from Shopify:", err?.message || err);
        }
    }
    return result;
}
