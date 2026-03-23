import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const plaidEnv = process.env.PLAID_ENV;

  // Check env vars first
  if (!clientId || !secret) {
    return res.status(500).json({
      error: "Missing Plaid credentials",
      PLAID_CLIENT_ID: !!clientId,
      PLAID_SECRET: !!secret,
      PLAID_ENV: plaidEnv || "not set (defaults to sandbox)",
    });
  }

  // Try to create a link token to verify keys work
  try {
    const { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } = await import("plaid");

    const config = new Configuration({
      basePath: PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": clientId,
          "PLAID-SECRET": secret,
          "Content-Type": "application/json",
        },
      },
    });

    const client = new PlaidApi(config);
    const response = await client.linkTokenCreate({
      user: { client_user_id: "test-user" },
      client_name: "Ledgr",
      products: [Products.Transactions],
      language: "en",
      country_codes: [CountryCode.Us],
    });

    return res.status(200).json({
      ok: true,
      env: plaidEnv || "sandbox",
      link_token_preview: response.data.link_token.slice(0, 30) + "...",
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message,
      plaidError: err.response?.data,
      PLAID_CLIENT_ID: clientId?.slice(0, 8) + "...",
      PLAID_SECRET: secret?.slice(0, 8) + "...",
    });
  }
}
