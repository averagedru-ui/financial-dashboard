import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPlaidClient, mapPlaidCategory } from "../../lib/plaid-client";
import { getFirestore } from "../../lib/firebase";
import { addTransaction } from "../../lib/budget-storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const db = await getFirestore();
    const client = await getPlaidClient();

    const itemsSnap = await db.collection("plaid_items").get();
    if (itemsSnap.empty) return res.status(200).json({ success: true, synced: 0, message: "No accounts connected" });

    let totalSynced = 0;

    for (const doc of itemsSnap.docs) {
      const { access_token, cursor } = doc.data();

      let added: any[] = [];
      let nextCursor = cursor || "";
      let hasMore = true;

      // Page through all new transactions
      while (hasMore) {
        const syncRes = await client.transactionsSync({
          access_token,
          cursor: nextCursor || undefined,
        });

        added = added.concat(syncRes.data.added);
        nextCursor = syncRes.data.next_cursor;
        hasMore = syncRes.data.has_more;
      }

      // Save new transactions
      for (const tx of added) {
        // Skip pending transactions
        if (tx.pending) continue;

        // Plaid: positive amount = money leaving account (expense)
        //        negative amount = money entering account (income)
        const isExpense = tx.amount > 0;
        const amount = isExpense ? -Math.abs(tx.amount) : Math.abs(tx.amount);
        const category = mapPlaidCategory(tx.personal_finance_category?.primary);

        await addTransaction({
          date: new Date(tx.date).toISOString(),
          description: tx.name,
          amount,
          category: isExpense ? category : "Income",
          type: isExpense ? "expense" : "income",
          source: "n8n", // reuse AUTO badge
          merchant: tx.merchant_name || undefined,
          mode: "personal",
        });

        totalSynced++;
      }

      // Update cursor
      await doc.ref.update({ cursor: nextCursor });
    }

    return res.status(200).json({ success: true, synced: totalSynced });
  } catch (err: any) {
    console.error("Plaid sync error:", err.response?.data || err.message);
    return res.status(500).json({ error: err.response?.data?.error_message || err.message });
  }
}
