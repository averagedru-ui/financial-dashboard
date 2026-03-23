import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPlaidClient } from "../../lib/plaid-client";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { CountryCode, Products } = await import("plaid");
    const client = await getPlaidClient();

    const response = await client.linkTokenCreate({
      user: { client_user_id: "ledgr-user" },
      client_name: "Ledgr",
      products: [Products.Transactions],
      language: "en",
      country_codes: [CountryCode.Us],
    });

    return res.status(200).json({ link_token: response.data.link_token });
  } catch (err: any) {
    console.error("Plaid link-token error:", err.response?.data || err.message);
    return res.status(500).json({ error: err.response?.data?.error_message || err.message });
  }
}
