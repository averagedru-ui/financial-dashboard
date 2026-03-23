import { useState, useEffect, useMemo, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Plus, Edit2, Trash2,
  ChevronLeft, ChevronRight, Search, X, Check, AlertCircle,
  Wallet, ArrowDownCircle, ArrowUpCircle, RefreshCw, Briefcase, User,
} from "lucide-react";
import PeptideCalculator from "../components/PeptideCalculator";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths } from "date-fns";
import type { Transaction, BudgetSettings } from "@shared/types";
import { CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS } from "@shared/types";
import * as api from "../lib/api";
import styles from "./Budget.module.css";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(Math.abs(n));
}
function fmtSigned(n: number) {
  return (n >= 0 ? "+" : "-") + fmt(n);
}
function pct(n: number) {
  return n.toFixed(1) + "%";
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Budget() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<BudgetSettings>({
    startingBalance: 0, currentBalance: 0, balanceLastUpdated: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(true);
  const [area, setArea] = useState<"personal" | "business">("personal");
  const [view, setView] = useState<"dashboard" | "transactions">("dashboard");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");
  const [editingStarting, setEditingStarting] = useState(false);
  const [startingInput, setStartingInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [txs, cfg] = await Promise.all([api.getTransactions(), api.getSettings()]);
      setTransactions(txs);
      setSettings(cfg);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  // Filter by area + month
  const personalTxs = useMemo(() => transactions.filter(t => !t.mode || t.mode === "personal"), [transactions]);
  const businessTxs = useMemo(() => transactions.filter(t => t.mode === "business"), [transactions]);

  const monthTxs = useMemo(() => {
    const src = area === "personal" ? personalTxs : businessTxs;
    return src.filter(tx => {
      try { return isWithinInterval(parseISO(tx.date), { start: monthStart, end: monthEnd }); }
      catch { return false; }
    });
  }, [area, personalTxs, businessTxs, monthStart, monthEnd]);

  const totalIncome = monthTxs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExpenses = monthTxs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const netCashflow = totalIncome - totalExpenses;

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    monthTxs.filter(t => t.amount < 0).forEach(t => { map[t.category] = (map[t.category] || 0) + Math.abs(t.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] || "#64748b" })).sort((a, b) => b.value - a.value);
  }, [monthTxs]);

  const areaData = useMemo(() => {
    const src = area === "personal" ? personalTxs : businessTxs;
    return Array.from({ length: 6 }, (_, i) => {
      const m = subMonths(selectedMonth, 5 - i);
      const mTxs = src.filter(tx => { try { return isWithinInterval(parseISO(tx.date), { start: startOfMonth(m), end: endOfMonth(m) }); } catch { return false; } });
      return { month: format(m, "MMM"), income: mTxs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0), expenses: mTxs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0) };
    });
  }, [area, personalTxs, businessTxs, selectedMonth]);

  const filteredTxs = useMemo(() => {
    const q = search.toLowerCase();
    return monthTxs.filter(t => !q || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || (t.merchant || "").toLowerCase().includes(q));
  }, [monthTxs, search]);

  const saveBalance = async () => {
    const val = parseFloat(balanceInput);
    if (isNaN(val)) return;
    try { const updated = await api.updateSettings({ currentBalance: val, manualOverride: true }); setSettings(updated); setEditingBalance(false); }
    catch (e: any) { setError(e.message); }
  };

  const saveStarting = async () => {
    const val = parseFloat(startingInput);
    if (isNaN(val)) return;
    try { const updated = await api.updateSettings({ startingBalance: val }); setSettings(updated); setEditingStarting(false); }
    catch (e: any) { setError(e.message); }
  };

  const deleteTx = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    try {
      await api.deleteTransaction(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      setSettings(await api.getSettings());
    } catch (e: any) { setError(e.message); }
  };

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <RefreshCw className={styles.spinner} size={32} />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <Wallet size={22} />
          <span>Ledgr</span>
        </div>

        {/* Personal / Business toggle */}
        <div className={styles.areaToggle}>
          <button
            className={`${styles.areaBtn} ${area === "personal" ? styles.areaBtnActive : ""}`}
            onClick={() => { setArea("personal"); setView("dashboard"); }}
          >
            <User size={14} /> Personal
          </button>
          <button
            className={`${styles.areaBtn} ${area === "business" ? styles.areaBtnActive : ""}`}
            onClick={() => { setArea("business"); setView("dashboard"); }}
          >
            <Briefcase size={14} /> Business
          </button>
        </div>

        <nav className={styles.sidebarNav}>
          <button className={`${styles.navBtn} ${view === "dashboard" ? styles.navBtnActive : ""}`} onClick={() => setView("dashboard")}>
            Dashboard
          </button>
          <button className={`${styles.navBtn} ${view === "transactions" ? styles.navBtnActive : ""}`} onClick={() => setView("transactions")}>
            Transactions
          </button>
        </nav>

        {/* Month picker */}
        <div className={styles.monthPicker}>
          <p className={styles.monthLabel}>Period</p>
          <div className={styles.monthNav}>
            <button onClick={() => setSelectedMonth(m => subMonths(m, 1))}><ChevronLeft size={16} /></button>
            <span>{format(selectedMonth, "MMM yyyy")}</span>
            <button onClick={() => setSelectedMonth(m => subMonths(m, -1))}><ChevronRight size={16} /></button>
          </div>
          <div className={styles.monthList}>
            {Array.from({ length: 6 }, (_, i) => {
              const m = subMonths(new Date(), 5 - i);
              const active = format(m, "yyyy-MM") === format(selectedMonth, "yyyy-MM");
              return (
                <button key={i} className={`${styles.monthItem} ${active ? styles.monthItemActive : ""}`} onClick={() => setSelectedMonth(m)}>
                  {format(m, "MMM yyyy")}
                </button>
              );
            })}
          </div>
        </div>

        {/* Balance (personal only) */}
        {area === "personal" && (
          <div className={styles.sidebarBalance}>
            <p className={styles.sidebarBalanceLabel}>Available Balance</p>
            {editingBalance ? (
              <div className={styles.inlineEdit}>
                <input value={balanceInput} onChange={e => setBalanceInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveBalance(); if (e.key === "Escape") setEditingBalance(false); }} autoFocus className={styles.balanceInput} placeholder="0.00" />
                <button onClick={saveBalance} className={styles.inlineEditSave}><Check size={14} /></button>
                <button onClick={() => setEditingBalance(false)} className={styles.inlineEditCancel}><X size={14} /></button>
              </div>
            ) : (
              <button className={styles.sidebarBalanceAmount} onClick={() => { setBalanceInput(String(settings.currentBalance)); setEditingBalance(true); }} title="Click to edit">
                {fmt(settings.currentBalance)}
              </button>
            )}
            <p className={styles.sidebarBalanceSub}>
              Starting:{" "}
              {editingStarting ? (
                <span className={styles.inlineEditSmall}>
                  <input value={startingInput} onChange={e => setStartingInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveStarting(); if (e.key === "Escape") setEditingStarting(false); }} autoFocus className={styles.startingInput} placeholder="0.00" />
                  <button onClick={saveStarting}><Check size={11} /></button>
                  <button onClick={() => setEditingStarting(false)}><X size={11} /></button>
                </span>
              ) : (
                <button className={styles.startingEdit} onClick={() => { setStartingInput(String(settings.startingBalance)); setEditingStarting(true); }}>
                  {fmt(settings.startingBalance)} ✎
                </button>
              )}
            </p>
          </div>
        )}

        <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> Add Transaction
        </button>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        {error && (
          <div className={styles.errorBanner}>
            <AlertCircle size={16} /> {error}
            <button onClick={() => setError(null)}><X size={14} /></button>
          </div>
        )}

        {view === "dashboard" && (
          <div className={styles.dashboard}>
            {/* Business header */}
            {area === "business" && (
              <div className={styles.businessHeader}>
                <Briefcase size={18} />
                <span>Ready Pep Go</span>
              </div>
            )}

            <h1 className={styles.pageTitle}>
              {area === "business" ? "Business — " : ""}{format(selectedMonth, "MMMM yyyy")} Overview
            </h1>

            <div className={styles.statGrid}>
              <StatCard icon={<ArrowDownCircle size={20} />} label={area === "business" ? "Revenue" : "Money In"} value={fmt(totalIncome)} valueColor="var(--accent-green)" sub={`${monthTxs.filter(t => t.amount > 0).length} transactions`} />
              <StatCard icon={<ArrowUpCircle size={20} />} label={area === "business" ? "Costs" : "Money Out"} value={fmt(totalExpenses)} valueColor="var(--accent-red)" sub={`${monthTxs.filter(t => t.amount < 0).length} transactions`} />
              <StatCard icon={<TrendingUp size={20} />} label={area === "business" ? "Net Profit" : "Net Cashflow"} value={fmtSigned(netCashflow)} valueColor={netCashflow >= 0 ? "var(--accent-green)" : "var(--accent-red)"} sub={netCashflow >= 0 ? (area === "business" ? "Profitable" : "Positive month") : (area === "business" ? "Operating loss" : "Over budget")} />
              <StatCard icon={<DollarSign size={20} />} label={area === "business" ? "Margin" : "Transactions"} value={area === "business" ? (totalIncome > 0 ? pct((netCashflow / totalIncome) * 100) : "—") : String(monthTxs.length)} valueColor="var(--accent-blue)" sub={area === "business" ? "profit margin" : "this period"} />
            </div>

            <div className={styles.chartsRow}>
              <div className={styles.card} style={{ flex: 2 }}>
                <h2 className={styles.cardTitle}>{area === "business" ? "Revenue & Costs" : "Income & Expenses"} — 6 Months</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d56" />
                    <XAxis dataKey="month" tick={{ fill: "#8fa3c8", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#8fa3c8", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip contentStyle={{ background: "#111d3a", border: "1px solid #1e2d56", borderRadius: 8 }} labelStyle={{ color: "#8fa3c8" }} formatter={(v: number, name: string) => [fmt(v), name === "income" ? (area === "business" ? "Revenue" : "Income") : (area === "business" ? "Costs" : "Expenses")]} />
                    <Area type="monotone" dataKey="income" stroke="#22c55e" fill="url(#incomeGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="url(#expGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className={styles.card} style={{ flex: 1, minWidth: 260 }}>
                <h2 className={styles.cardTitle}>Spending Breakdown</h2>
                {categoryData.length === 0 ? (
                  <p className={styles.emptyState}>No expenses this month</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                        {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#111d3a", border: "1px solid #1e2d56", borderRadius: 8 }} formatter={(v: number) => [fmt(v)]} />
                      <Legend formatter={value => <span style={{ color: "#8fa3c8", fontSize: 11 }}>{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className={styles.bottomRow}>
              <div className={styles.card} style={{ flex: 1 }}>
                <h2 className={styles.cardTitle}>Top Categories</h2>
                {categoryData.length === 0 ? <p className={styles.emptyState}>No data for this period</p> : (
                  <div className={styles.catList}>
                    {categoryData.slice(0, 6).map(cat => (
                      <div key={cat.name} className={styles.catRow}>
                        <span className={styles.catIcon}>{CATEGORY_ICONS[cat.name] || "📦"}</span>
                        <div className={styles.catInfo}>
                          <div className={styles.catHeader}><span>{cat.name}</span><span style={{ color: "var(--accent-red)" }}>{fmt(cat.value)}</span></div>
                          <div className={styles.catBar}><div className={styles.catBarFill} style={{ width: `${Math.min(100, (cat.value / totalExpenses) * 100)}%`, background: cat.color }} /></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.card} style={{ flex: 1 }}>
                <div className={styles.cardHeaderRow}>
                  <h2 className={styles.cardTitle}>Recent Transactions</h2>
                  <button className={styles.viewAllBtn} onClick={() => setView("transactions")}>View all</button>
                </div>
                {monthTxs.length === 0 ? <p className={styles.emptyState}>No transactions this month</p> : (
                  <div className={styles.recentList}>
                    {monthTxs.slice(0, 8).map(tx => <TxRow key={tx.id} tx={tx} onEdit={() => setEditingTx(tx)} onDelete={() => deleteTx(tx.id)} compact />)}
                  </div>
                )}
              </div>
            </div>

            {/* Peptide calculator at the bottom of business dashboard */}
            {area === "business" && <PeptideCalculator />}
          </div>
        )}

        {view === "transactions" && (
          <div className={styles.txView}>
            <div className={styles.txHeader}>
              <h1 className={styles.pageTitle}>{area === "business" ? "Business " : ""}Transactions — {format(selectedMonth, "MMM yyyy")}</h1>
              <div className={styles.txActions}>
                <div className={styles.searchBox}>
                  <Search size={14} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions..." className={styles.searchInput} />
                  {search && <button onClick={() => setSearch("")}><X size={12} /></button>}
                </div>
                <button className={styles.addBtnSmall} onClick={() => setShowAddModal(true)}><Plus size={14} /> Add</button>
              </div>
            </div>

            {filteredTxs.length === 0 ? (
              <div className={styles.emptyFull}>
                <p>No transactions found</p>
                <button className={styles.addBtnSmall} onClick={() => setShowAddModal(true)}><Plus size={14} /> Add your first transaction</button>
              </div>
            ) : (
              <div className={styles.txTable}>
                <div className={styles.txTableHead}>
                  <span>Date</span><span>Description</span><span>Category</span><span>Source</span><span className={styles.txAmtHead}>Amount</span><span></span>
                </div>
                {filteredTxs.map(tx => <TxRow key={tx.id} tx={tx} onEdit={() => setEditingTx(tx)} onDelete={() => deleteTx(tx.id)} />)}
              </div>
            )}
          </div>
        )}
      </main>

      {(showAddModal || editingTx) && (
        <TxModal
          tx={editingTx}
          defaultMode={area}
          onClose={() => { setShowAddModal(false); setEditingTx(null); }}
          onSave={async (data) => {
            try {
              if (editingTx) {
                const updated = await api.updateTransaction(editingTx.id, data);
                setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
              } else {
                const created = await api.createTransaction(data as any);
                setTransactions(prev => [created, ...prev]);
              }
              setSettings(await api.getSettings());
              setShowAddModal(false);
              setEditingTx(null);
            } catch (e: any) { setError(e.message); }
          }}
        />
      )}
    </div>
  );
}


// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, valueColor, sub }: { icon: React.ReactNode; label: string; value: string; valueColor: string; sub: string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statCardIcon}>{icon}</div>
      <div>
        <p className={styles.statCardLabel}>{label}</p>
        <p className={styles.statCardValue} style={{ color: valueColor }}>{value}</p>
        <p className={styles.statCardSub}>{sub}</p>
      </div>
    </div>
  );
}

function TxRow({ tx, onEdit, onDelete, compact = false }: { tx: Transaction; onEdit: () => void; onDelete: () => void; compact?: boolean }) {
  const color = tx.amount >= 0 ? "var(--accent-green)" : "var(--accent-red)";

  if (compact) {
    return (
      <div className={styles.compactTxRow}>
        <span className={styles.compactCatIcon}>{CATEGORY_ICONS[tx.category] || "📦"}</span>
        <div className={styles.compactTxInfo}>
          <span className={styles.compactTxDesc}>{tx.description}</span>
          <span className={styles.compactTxDate}>{format(parseISO(tx.date), "MMM d")}</span>
        </div>
        <span className={styles.compactTxAmt} style={{ color }}>{tx.amount >= 0 ? "+" : ""}{fmt(tx.amount)}</span>
        <div className={styles.txRowActions}>
          <button onClick={onEdit} className={styles.iconBtn}><Edit2 size={12} /></button>
          <button onClick={onDelete} className={styles.iconBtnDanger}><Trash2 size={12} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.txRow}>
      <span className={styles.txDate}>{format(parseISO(tx.date), "MMM d, yyyy")}</span>
      <div className={styles.txDesc}>
        <span>{tx.description}</span>
        {tx.merchant && <span className={styles.txMerchant}>{tx.merchant}</span>}
      </div>
      <span className={styles.txCat}>{CATEGORY_ICONS[tx.category] || "📦"} {tx.category}</span>
      <span className={`${styles.txSource} ${tx.source === "n8n" ? styles.txSourceAuto : ""}`}>{tx.source === "n8n" ? "AUTO" : "Manual"}</span>
      <span className={styles.txAmt} style={{ color }}>{tx.amount >= 0 ? "+" : ""}{fmt(tx.amount)}</span>
      <div className={styles.txRowActions}>
        <button onClick={onEdit} className={styles.iconBtn}><Edit2 size={13} /></button>
        <button onClick={onDelete} className={styles.iconBtnDanger}><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function TxModal({ tx, defaultMode, onClose, onSave }: { tx: Transaction | null; defaultMode: "personal" | "business"; onClose: () => void; onSave: (data: Partial<Transaction>) => Promise<void> }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [form, setForm] = useState({
    date: tx?.date?.slice(0, 10) || today,
    description: tx?.description || "",
    amount: tx ? String(Math.abs(tx.amount)) : "",
    category: tx?.category || "Other",
    type: tx?.type || "expense",
    merchant: tx?.merchant || "",
    notes: tx?.notes || "",
    mode: tx?.mode || defaultMode,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const amount = form.type === "expense" ? -Math.abs(parseFloat(form.amount)) : Math.abs(parseFloat(form.amount));
    try {
      await onSave({
        date: new Date(form.date).toISOString(),
        description: form.description,
        amount,
        category: form.category,
        type: form.type as "income" | "expense",
        source: tx?.source || "manual",
        mode: form.mode as "personal" | "business",
        merchant: form.merchant || undefined,
        notes: form.notes || undefined,
      });
    } finally { setSaving(false); }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{tx ? "Edit Transaction" : "Add Transaction"}</h2>
          <button onClick={onClose} className={styles.modalClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.typeToggle}>
            <button type="button" className={`${styles.typeBtn} ${form.type === "expense" ? styles.typeBtnExpense : ""}`} onClick={() => set("type", "expense")}>Expense</button>
            <button type="button" className={`${styles.typeBtn} ${form.type === "income" ? styles.typeBtnIncome : ""}`} onClick={() => set("type", "income")}>Income</button>
          </div>
          <div className={styles.typeToggle} style={{ marginTop: -6 }}>
            <button type="button" className={`${styles.typeBtn} ${form.mode === "personal" ? styles.typeBtnPersonal : ""}`} onClick={() => set("mode", "personal")}>
              <User size={12} style={{ display: "inline", marginRight: 4 }} />Personal
            </button>
            <button type="button" className={`${styles.typeBtn} ${form.mode === "business" ? styles.typeBtnBusiness : ""}`} onClick={() => set("mode", "business")}>
              <Briefcase size={12} style={{ display: "inline", marginRight: 4 }} />Business
            </button>
          </div>
          <div className={styles.formRow}><label>Date</label><input type="date" value={form.date} onChange={e => set("date", e.target.value)} required className={styles.formInput} /></div>
          <div className={styles.formRow}><label>Description *</label><input value={form.description} onChange={e => set("description", e.target.value)} required className={styles.formInput} placeholder="e.g. Grocery run" /></div>
          <div className={styles.formRow}><label>Amount *</label><input type="number" step="0.01" min="0" value={form.amount} onChange={e => set("amount", e.target.value)} required className={styles.formInput} placeholder="0.00" /></div>
          <div className={styles.formRow}>
            <label>Category</label>
            <select value={form.category} onChange={e => set("category", e.target.value)} className={styles.formInput}>
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c] || ""} {c}</option>)}
            </select>
          </div>
          <div className={styles.formRow}><label>Merchant</label><input value={form.merchant} onChange={e => set("merchant", e.target.value)} className={styles.formInput} placeholder="Optional" /></div>
          <div className={styles.formRow}><label>Notes</label><input value={form.notes} onChange={e => set("notes", e.target.value)} className={styles.formInput} placeholder="Optional" /></div>
          <div className={styles.modalActions}>
            <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancel</button>
            <button type="submit" disabled={saving} className={styles.saveBtn}>{saving ? "Saving..." : tx ? "Save Changes" : "Add Transaction"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
