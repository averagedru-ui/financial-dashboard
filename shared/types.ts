export interface Transaction {
  id: string;
  date: string; // ISO string
  description: string;
  amount: number; // positive = income, negative = expense
  category: string;
  type: "income" | "expense";
  source: "manual" | "n8n"; // how it was added
  mode?: "personal" | "business"; // which area this belongs to
  merchant?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetSettings {
  startingBalance: number;
  currentBalance: number; // overrideable
  balanceLastUpdated: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDay: number; // day of month 1-31
  frequency: "monthly" | "weekly" | "yearly" | "biweekly";
  category: string;
  autoPay: boolean;
  cancelled?: boolean;
  cancelledAt?: string;
  notes?: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export const BILL_COLORS = [
  "#3b82f6", "#22c55e", "#ef4444", "#f59e0b",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
];

export interface DashboardData {
  settings: BudgetSettings;
  transactions: Transaction[];
}

export const CATEGORIES = [
  "Food & Dining",
  "Shopping",
  "Transportation",
  "Entertainment",
  "Health & Medical",
  "Bills & Utilities",
  "Housing",
  "Personal Care",
  "Travel",
  "Education",
  "Income",
  "Transfer",
  "Cash App",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_ICONS: Record<string, string> = {
  "Food & Dining": "🍔",
  Shopping: "🛍️",
  Transportation: "🚗",
  Entertainment: "🎬",
  "Health & Medical": "🏥",
  "Bills & Utilities": "⚡",
  Housing: "🏠",
  "Personal Care": "💄",
  Travel: "✈️",
  Education: "📚",
  Income: "💰",
  Transfer: "↔️",
  "Cash App": "💸",
  Other: "📦",
};

export const CATEGORY_COLORS: Record<string, string> = {
  "Food & Dining": "#f59e0b",
  Shopping: "#8b5cf6",
  Transportation: "#3b82f6",
  Entertainment: "#ec4899",
  "Health & Medical": "#10b981",
  "Bills & Utilities": "#f97316",
  Housing: "#6366f1",
  "Personal Care": "#14b8a6",
  Travel: "#06b6d4",
  Education: "#84cc16",
  Income: "#22c55e",
  Transfer: "#94a3b8",
  "Cash App": "#00d64f",
  Other: "#64748b",
};
