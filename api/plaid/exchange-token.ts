import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPlaidClient } from "../../lib/plaid-client";
import { getFirestore } from "../../lib/firebase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { public_token, institution_name, institution_id } = req.body;
  if (!public_token) return res.status(400).json({ error: "Missing public_token" });

  try {
    const client = await getPlaidClient();
    const response = await client.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = response.data;

    // Store in Firestore
    const db = await getFirestore();
    await db.collection("plaid_items").doc(item_id).set({
      access_token,
      item_id,
      institution_name: institution_name || "Unknown Bank",
      institution_id: institution_id || "",
      cursor: null,
      connectedAt: new Date().toISOString(),
    });

    return res.status(200).json({ success: true, item_id, institution_name });
  } catch (err: any) {
    console.error("Plaid exchange-token error:", err.response?.data || err.message);
    return res.status(500).json({ error: err.response?.data?.error_message || err.message });
  }
}
