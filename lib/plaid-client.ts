export async function getPlaidClient() {
  const { Configuration, PlaidApi, PlaidEnvironments } = await import("plaid");

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV || "sandbox";

  if (!clientId || !secret) {
    throw new Error(`Plaid credentials missing — PLAID_CLIENT_ID: ${!!clientId}, PLAID_SECRET: ${!!secret}`);
  }

  const basePath =
    env === "production"
      ? PlaidEnvironments.production
      : env === "development"
      ? PlaidEnvironments.development
      : PlaidEnvironments.sandbox;

  const config = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
        "Content-Type": "application/json",
      },
    },
  });

  return new PlaidApi(config);
}

export function mapPlaidCategory(primary?: string): string {
  const map: Record<string, string> = {
    FOOD_AND_DRINK: "Food & Dining",
    TRANSPORTATION: "Transportation",
    ENTERTAINMENT: "Entertainment",
    GENERAL_MERCHANDISE: "Shopping",
    GENERAL_SERVICES: "Other",
    PAYMENT: "Bills & Utilities",
    TRANSFER_IN: "Income",
    TRANSFER_OUT: "Transfer",
    LOAN_PAYMENTS: "Bills & Utilities",
    BANK_FEES: "Other",
    TRAVEL: "Travel",
    MEDICAL: "Health & Medical",
    HOME_IMPROVEMENT: "Housing",
    PERSONAL_CARE: "Personal Care",
    EDUCATION: "Education",
    INCOME: "Income",
  };
  return map[primary || ""] || "Other";
}
