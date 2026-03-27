import { randomUUID } from "crypto";
import { getFirestore } from "./firebase";
import type { Transaction, BudgetSettings } from "../shared/types";

const SETTINGS_DOC = "budget/settings";
const TRANSACTIONS_COL = "budget_transactions";

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<BudgetSettings> {
  const db = await getFirestore();
  const doc = await db.doc(SETTINGS_DOC).get();
  if (!doc.exists) {
    return {
      startingBalance: 0,
      currentBalance: 0,
      balanceLastUpdated: new Date().toISOString(),
    };
  }
  return doc.data() as BudgetSettings;
}

export async function updateSettings(
  updates: Partial<BudgetSettings>
): Promise<BudgetSettings> {
  const db = await getFirestore();
  const ref = db.doc(SETTINGS_DOC);
  const payload = { ...updates, balanceLastUpdated: new Date().toISOString() };
  await ref.set(payload, { merge: true });
  const doc = await ref.get();
  return doc.data() as BudgetSettings;
}

// ── Transactions ───────────────────────────────────────────────────────────────

export async function getTransactions(): Promise<Transaction[]> {
  const db = await getFirestore();
  const snap = await db
    .collection(TRANSACTIONS_COL)
    .orderBy("date", "desc")
    .get();
  return snap.docs.map((d: any) => d.data() as Transaction);
}

export async function addTransaction(
  data: Omit<Transaction, "id" | "createdAt" | "updatedAt">,
  skipBalanceUpdate = false
): Promise<Transaction> {
  const db = await getFirestore();
  const now = new Date().toISOString();
  const tx: Transaction = {
    ...data,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(TRANSACTIONS_COL).doc(tx.id).set(tx);
  if (!skipBalanceUpdate) await recalcBalance();
  return tx;
}

export async function updateTransaction(
  id: string,
  updates: Partial<Transaction>
): Promise<Transaction> {
  const db = await getFirestore();
  const ref = db.collection(TRANSACTIONS_COL).doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new Error(`Transaction ${id} not found`);

  const updated: Transaction = {
    ...(doc.data() as Transaction),
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };
  await ref.set(updated);
  await recalcBalance();
  return updated;
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getFirestore();
  await db.collection(TRANSACTIONS_COL).doc(id).delete();
  await recalcBalance();
}

// ── Balance helpers ────────────────────────────────────────────────────────────

async function recalcBalance(): Promise<void> {
  const db = await getFirestore();
  const settings = await getSettings();
  const snap = await db.collection(TRANSACTIONS_COL).get();
  const txs = snap.docs.map((d: any) => d.data() as Transaction);

  const net = txs.reduce((sum: number, tx: Transaction) => sum + tx.amount, 0);
  const computed = settings.startingBalance + net;

  const settingsDoc = await db.doc(SETTINGS_DOC).get();
  const settingsData = settingsDoc.exists
    ? (settingsDoc.data() as BudgetSettings & { manualOverride?: boolean })
    : null;

  if (!settingsData?.manualOverride) {
    await db.doc(SETTINGS_DOC).set(
      {
        currentBalance: computed,
        balanceLastUpdated: new Date().toISOString(),
      },
      { merge: true }
    );
  }
}

export async function clearManualOverride(): Promise<BudgetSettings> {
  const db = await getFirestore();
  await db.doc(SETTINGS_DOC).set({ manualOverride: false }, { merge: true });
  await recalcBalance();
  const doc = await db.doc(SETTINGS_DOC).get();
  return doc.data() as BudgetSettings;
}

export async function setManualBalance(amount: number): Promise<BudgetSettings> {
  const db = await getFirestore();
  await db.doc(SETTINGS_DOC).set(
    {
      currentBalance: amount,
      balanceLastUpdated: new Date().toISOString(),
      manualOverride: true,
    },
    { merge: true }
  );
  const doc = await db.doc(SETTINGS_DOC).get();
  return doc.data() as BudgetSettings;
}
