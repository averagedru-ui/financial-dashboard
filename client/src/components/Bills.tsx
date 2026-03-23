import { useState, useEffect, useMemo } from "react";
import { Plus, Edit2, Trash2, X, Check, CreditCard, AlertCircle, Repeat } from "lucide-react";
import type { Bill } from "@shared/types";
import { CATEGORIES, CATEGORY_ICONS, BILL_COLORS } from "@shared/types";
import * as api from "../lib/api";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function monthlyAmount(bill: Bill): number {
  switch (bill.frequency) {
    case "weekly":    return bill.amount * 52 / 12;
    case "biweekly":  return bill.amount * 26 / 12;
    case "yearly":    return bill.amount / 12;
    default:          return bill.amount;
  }
}

function freqLabel(f: Bill["frequency"]) {
  return { monthly: "Monthly", weekly: "Weekly", biweekly: "Bi-weekly", yearly: "Yearly" }[f];
}

function dueSoon(dueDay: number): boolean {
  const today = new Date().getDate();
  const diff = dueDay - today;
  return diff >= 0 && diff <= 5;
}

export default function Bills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);

  const load = async () => {
    try {
      setBills(await api.getBills());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const totalMonthly = useMemo(() =>
    bills.reduce((s, b) => s + monthlyAmount(b), 0), [bills]);

  const totalYearly = totalMonthly * 12;

  const deleteBill = async (id: string) => {
    if (!confirm("Delete this bill?")) return;
    try {
      await api.deleteBill(id);
      setBills(prev => prev.filter(b => b.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  return (
    <div style={{ background: "var(--navy-800)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", marginTop: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Repeat size={16} style={{ color: "var(--accent-blue)" }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Subscriptions & Bills
          </span>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          style={{ background: "var(--accent-blue)", border: "none", borderRadius: 7, padding: "6px 12px", color: "#fff", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
        >
          <Plus size={13} /> Add Bill
        </button>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, color: "#ef4444", fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {/* Summary row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ background: "var(--navy-900)", borderRadius: 8, padding: "10px 16px", flex: 1, minWidth: 120 }}>
          <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Monthly Total</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: "var(--accent-red)" }}>{fmt(totalMonthly)}</p>
        </div>
        <div style={{ background: "var(--navy-900)", borderRadius: 8, padding: "10px 16px", flex: 1, minWidth: 120 }}>
          <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Yearly Total</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(totalYearly)}</p>
        </div>
        <div style={{ background: "var(--navy-900)", borderRadius: 8, padding: "10px 16px", flex: 1, minWidth: 120 }}>
          <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Active Bills</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: "var(--accent-blue)" }}>{bills.length}</p>
        </div>
      </div>

      {/* Bills list */}
      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 16 }}>Loading...</p>
      ) : bills.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}>
          <CreditCard size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p style={{ fontSize: 13 }}>No bills added yet</p>
          <button onClick={() => setShowModal(true)} style={{ marginTop: 10, background: "none", border: "1px solid var(--border)", borderRadius: 7, padding: "6px 14px", color: "var(--accent-blue)", fontSize: 12, cursor: "pointer" }}>
            + Add your first bill
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {bills.map(bill => (
            <div key={bill.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--navy-900)", borderRadius: 9, padding: "10px 14px", border: dueSoon(bill.dueDay) ? "1px solid rgba(245,158,11,0.4)" : "1px solid transparent" }}>
              <div style={{ width: 4, height: 36, borderRadius: 2, background: bill.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{bill.name}</span>
                  {bill.autoPay && <span style={{ fontSize: 9, background: "rgba(34,197,94,0.15)", color: "#22c55e", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>AUTO</span>}
                  {dueSoon(bill.dueDay) && <span style={{ fontSize: 9, background: "rgba(245,158,11,0.15)", color: "#f59e0b", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>DUE SOON</span>}
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {CATEGORY_ICONS[bill.category] || "📦"} {bill.category} · {freqLabel(bill.frequency)} · Due day {bill.dueDay}
                </span>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-red)" }}>{fmt(bill.amount)}</p>
                <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{fmt(monthlyAmount(bill))}/mo</p>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => { setEditing(bill); setShowModal(true); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}><Edit2 size={13} /></button>
                <button onClick={() => deleteBill(bill.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <BillModal
          bill={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={async (data) => {
            try {
              if (editing) {
                const updated = await api.updateBill({ ...data, id: editing.id });
                setBills(prev => prev.map(b => b.id === updated.id ? updated : b));
              } else {
                const created = await api.createBill(data as any);
                setBills(prev => [created, ...prev]);
              }
              setShowModal(false);
              setEditing(null);
            } catch (e: any) { setError(e.message); }
          }}
        />
      )}
    </div>
  );
}

// ── Bill Modal ────────────────────────────────────────────────────────────────

function BillModal({ bill, onClose, onSave }: { bill: Bill | null; onClose: () => void; onSave: (data: Partial<Bill>) => Promise<void> }) {
  const [form, setForm] = useState({
    name: bill?.name || "",
    amount: bill ? String(bill.amount) : "",
    dueDay: bill ? String(bill.dueDay) : "1",
    frequency: bill?.frequency || "monthly",
    category: bill?.category || "Bills & Utilities",
    autoPay: bill?.autoPay ?? false,
    notes: bill?.notes || "",
    color: bill?.color || BILL_COLORS[0],
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name: form.name,
        amount: parseFloat(form.amount),
        dueDay: parseInt(form.dueDay),
        frequency: form.frequency as Bill["frequency"],
        category: form.category,
        autoPay: form.autoPay,
        notes: form.notes || undefined,
        color: form.color,
      });
    } finally { setSaving(false); }
  };

  const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
  const modal: React.CSSProperties = { background: "var(--navy-800)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto" };
  const inp: React.CSSProperties = { width: "100%", background: "var(--navy-900)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{bill ? "Edit Bill" : "Add Bill"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div><label style={lbl}>Bill Name *</label><input value={form.name} onChange={e => set("name", e.target.value)} required style={inp} placeholder="e.g. Netflix, Rent, Electric" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label style={lbl}>Amount *</label><input type="number" step="0.01" min="0" value={form.amount} onChange={e => set("amount", e.target.value)} required style={inp} placeholder="0.00" /></div>
            <div><label style={lbl}>Due Day</label><input type="number" min="1" max="31" value={form.dueDay} onChange={e => set("dueDay", e.target.value)} style={inp} /></div>
          </div>
          <div>
            <label style={lbl}>Frequency</label>
            <select value={form.frequency} onChange={e => set("frequency", e.target.value)} style={inp}>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Category</label>
            <select value={form.category} onChange={e => set("category", e.target.value)} style={inp}>
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c] || ""} {c}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Color</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {BILL_COLORS.map(c => (
                <button key={c} type="button" onClick={() => set("color", c)} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: form.color === c ? "3px solid white" : "2px solid transparent", cursor: "pointer" }} />
              ))}
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={form.autoPay} onChange={e => set("autoPay", e.target.checked)} />
            Auto-pay enabled
          </label>
          <div><label style={lbl}>Notes</label><input value={form.notes} onChange={e => set("notes", e.target.value)} style={inp} placeholder="Optional" /></div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: "var(--navy-700)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13 }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent-blue)", border: "none", borderRadius: 8, padding: "10px", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>{saving ? "Saving..." : bill ? "Save Changes" : "Add Bill"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
