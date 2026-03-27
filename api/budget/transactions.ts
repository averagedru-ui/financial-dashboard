import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getTransactions,
  addTransaction,
} from "../../lib/budget-storage";
import { CATEGORIES } from "../../shared/types";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const transactions = await getTransactions();
      return res.status(200).json(transactions);
    }

    if (req.method === "POST") {
      const { date, description, amount, category, type, source, merchant, notes, skipBalanceUpdate } =
        req.body;

      if (!date || !description || amount === undefined || !category || !type) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }

      const tx = await addTransaction({
        date,
        description,
        amount: Number(amount),
        category,
        type,
        source: source || "manual",
        merchant,
        notes,
      }, skipBalanceUpdate === true);

      return res.status(201).json(tx);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
