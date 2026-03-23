import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../../lib/firebase";
import { getPlaidClient } from "../../lib/plaid-client";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    // List connected institutions + balances
    try {
      const db = await getFirestore();
      const client = await getPlaidClient();
      const itemsSnap = await db.collection("plaid_items").get();

      const accounts = await Promise.all(
        itemsSnap.docs.map(async (doc) => {
          const { access_token, institution_name, connectedAt } = doc.data();
          try {
            const balRes = await client.accountsBalanceGet({ access_token });
            return {
              item_id: doc.id,
              institution_name,
              connectedAt,
              accounts: balRes.data.accounts.map((a) => ({
                id: a.account_id,
                name: a.name,
                type: a.type,
                subtype: a.subtype,
                balance: a.balances.current,
                available: a.balances.available,
                currency: a.balances.iso_currency_code,
              })),
            };
          } catch {
            return { item_id: doc.id, institution_name, connectedAt, accounts: [], error: "Could not fetch balances" };
          }
        })
      );

      return res.status(200).json({ accounts });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "DELETE") {
    // Disconnect an institution
    const { item_id } = req.body;
    if (!item_id) return res.status(400).json({ error: "Missing item_id" });
    try {
      const db = await getFirestore();
      const client = await getPlaidClient();
      const doc = await db.collection("plaid_items").doc(item_id).get();
      if (doc.exists) {
        await client.itemRemove({ access_token: doc.data()!.access_token });
        await doc.ref.delete();
      }
      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
