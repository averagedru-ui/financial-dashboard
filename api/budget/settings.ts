import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSettings,
  updateSettings,
  setManualBalance,
  clearManualOverride,
} from "../../lib/budget-storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const settings = await getSettings();
      return res.status(200).json(settings);
    }

    if (req.method === "PUT") {
      const { startingBalance, currentBalance, manualOverride } = req.body;

      if (manualOverride === true && currentBalance !== undefined) {
        const settings = await setManualBalance(Number(currentBalance));
        return res.status(200).json(settings);
      }

      if (manualOverride === false) {
        const settings = await clearManualOverride();
        return res.status(200).json(settings);
      }

      const updates: any = {};
      if (startingBalance !== undefined) updates.startingBalance = Number(startingBalance);
      if (currentBalance !== undefined) updates.currentBalance = Number(currentBalance);

      const settings = await updateSettings(updates);
      return res.status(200).json(settings);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
