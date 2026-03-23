import type { Transaction, BudgetSettings, Bill } from "@shared/types";

const BASE = import.meta.env.VITE_API_URL || "/api";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

// Transactions
export const getTransactions = () =>
  req<Transaction[]>("/budget/transactions");

export const createTransaction = (data: Omit<Transaction, "id" | "createdAt" | "updatedAt">) =>
  req<Transaction>("/budget/transactions", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateTransaction = (id: string, data: Partial<Transaction>) =>
  req<Transaction>(`/budget/transactions/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteTransaction = (id: string) =>
  req<{ success: boolean }>(`/budget/transactions/${id}`, {
    method: "DELETE",
  });

// Bills
export const getBills = () => req<Bill[]>("/budget/bills");
export const createBill = (data: Omit<Bill, "id" | "createdAt" | "updatedAt">) =>
  req<Bill>("/budget/bills", { method: "POST", body: JSON.stringify(data) });
export const updateBill = (data: Partial<Bill> & { id: string }) =>
  req<Bill>("/budget/bills", { method: "PUT", body: JSON.stringify(data) });
export const deleteBill = (id: string) =>
  req<{ success: boolean }>(`/budget/bills?id=${id}`, { method: "DELETE" });

// Settings
export const getSettings = () => req<BudgetSettings>("/budget/settings");

export const updateSettings = (data: Partial<BudgetSettings> & { manualOverride?: boolean }) =>
  req<BudgetSettings>("/budget/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
