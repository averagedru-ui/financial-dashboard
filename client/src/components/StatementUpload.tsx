import { useState, useRef } from "react";
import Papa from "papaparse";
import { Upload, X, Check, AlertCircle, FileText, ChevronDown } from "lucide-react";
import { CATEGORIES, CATEGORY_ICONS } from "@shared/types";
import type { Transaction } from "@shared/types";
import * as api from "../lib/api";

// ── PDF Parser (Cash App & generic) ─────────────────────────────────────────

async function parsePDF(file: File): Promise<ParsedRow[]> {
  // Destructure directly — pdfjs v5 dynamic imports don't expose on the namespace object
  const { getDocument, GlobalWorkerOptions, version } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map((item: any) => item.str).join(" ") + "\n";
  }

  return parseCashAppText(fullText);
}

function parseCashAppText(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];

  // Cash App PDF pattern: date + type + name + amount on nearby lines
  // Common patterns: "Jan 1, 2026" or "01/01/2026" or "2026-01-01"
  const datePattern = /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b)/gi;
  const amountPattern = /([+-]?\$[\d,]+\.?\d*|-?\$[\d,]+\.?\d*|\$[\d,]+\.?\d*)/g;

  // Split into lines and try to find transaction blocks
  const lines = text.split(/\n|\r/).map(l => l.trim()).filter(Boolean);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Look for a date line
    const dateMatch = line.match(datePattern);
    if (dateMatch) {
      const dateStr = dateMatch[0];

      // Look ahead up to 5 lines for an amount
      let amount = 0;
      let description = "";
      let foundAmount = false;

      for (let j = i; j < Math.min(i + 6, lines.length); j++) {
        const amtMatch = lines[j].match(/([+-]?\$[\d,]+\.?\d*)/);
        if (amtMatch) {
          const raw = amtMatch[1].replace(/[$,]/g, "");
          amount = parseFloat(raw);
          foundAmount = true;

          // Description is whatever text was between date and amount
          const descLines = lines.slice(i + 1, j)
            .filter(l => !l.match(datePattern) && !l.match(/^\$/) && l.length > 1);
          description = descLines.join(" ").trim() || lines[i + 1] || "Transaction";
          break;
        }
      }

      if (foundAmount && amount !== 0) {
        rows.push({
          date: parseDate(dateStr),
          description: description.slice(0, 80),
          amount,
          type: amount >= 0 ? "income" : "expense",
          category: guessCategory(description),
          merchant: description.slice(0, 50),
          selected: true,
          raw: {},
        });
        i += 2;
        continue;
      }
    }
    i++;
  }

  return rows;
}

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  merchant: string;
  selected: boolean;
  raw: Record<string, string>;
}

const BANK_FORMATS: Record<string, {
  label: string;
  dateCol: string[];
  descCol: string[];
  amountCol: string[];
  creditCol?: string[];
  debitCol?: string[];
}> = {
  auto: {
    label: "Auto-detect",
    dateCol: ["date", "transaction date", "posted date", "trans date"],
    descCol: ["description", "memo", "payee", "transaction", "name", "merchant", "details"],
    amountCol: ["amount", "net amount", "transaction amount"],
    creditCol: ["credit", "deposit", "credits", "money in"],
    debitCol: ["debit", "withdrawal", "debits", "money out"],
  },
  varo: {
    label: "Varo",
    dateCol: ["date"],
    descCol: ["description", "merchant"],
    amountCol: ["amount"],
  },
  cashapp: {
    label: "Cash App",
    dateCol: ["date"],
    descCol: ["notes", "name"],
    amountCol: ["net amount", "amount"],
  },
  chase: {
    label: "Chase",
    dateCol: ["transaction date", "posting date"],
    descCol: ["description"],
    amountCol: ["amount"],
  },
  bofa: {
    label: "Bank of America",
    dateCol: ["date"],
    descCol: ["description", "payee"],
    amountCol: ["amount"],
  },
  wells: {
    label: "Wells Fargo",
    dateCol: ["date"],
    descCol: ["description"],
    amountCol: ["amount"],
    creditCol: [],
    debitCol: [],
  },
};

function findCol(headers: string[], candidates: string[]): string | null {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx !== -1) return headers[idx];
  }
  return null;
}

function guessCategory(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes("grocery") || d.includes("food") || d.includes("restaurant") || d.includes("mcdonald") || d.includes("starbucks") || d.includes("chipotle") || d.includes("doordash") || d.includes("ubereats")) return "Food & Dining";
  if (d.includes("amazon") || d.includes("walmart") || d.includes("target") || d.includes("shop") || d.includes("store")) return "Shopping";
  if (d.includes("uber") || d.includes("lyft") || d.includes("gas") || d.includes("fuel") || d.includes("parking") || d.includes("transit")) return "Transportation";
  if (d.includes("netflix") || d.includes("spotify") || d.includes("hulu") || d.includes("disney") || d.includes("movie") || d.includes("game")) return "Entertainment";
  if (d.includes("doctor") || d.includes("pharmacy") || d.includes("medical") || d.includes("health") || d.includes("cvs") || d.includes("walgreen")) return "Health & Medical";
  if (d.includes("electric") || d.includes("water") || d.includes("internet") || d.includes("phone") || d.includes("bill") || d.includes("utility") || d.includes("at&t") || d.includes("verizon")) return "Bills & Utilities";
  if (d.includes("rent") || d.includes("mortgage") || d.includes("home") || d.includes("apartment")) return "Housing";
  if (d.includes("payroll") || d.includes("salary") || d.includes("direct dep") || d.includes("income") || d.includes("zelle") || d.includes("cashapp") || d.includes("venmo")) return "Income";
  if (d.includes("transfer") || d.includes("payment")) return "Transfer";
  if (d.includes("salon") || d.includes("hair") || d.includes("spa") || d.includes("barber")) return "Personal Care";
  if (d.includes("airline") || d.includes("hotel") || d.includes("airbnb") || d.includes("travel")) return "Travel";
  return "Other";
}

function parseAmount(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/[$,\s]/g, "").trim();
  return parseFloat(cleaned) || 0;
}

function parseDate(val: string): string {
  if (!val) return new Date().toISOString();
  try {
    const d = new Date(val.trim());
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {}
  return new Date().toISOString();
}

export default function StatementUpload({ onImport, defaultMode }: {
  onImport: () => void;
  defaultMode: "personal" | "business";
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [bankFormat, setBankFormat] = useState("auto");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const parseCSV = (file: File, format: string) => {
    setFileName(file.name);
    setError(null);
    setDone(false);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Record<string, string>[];
        if (!data.length) { setError("No data found in file."); return; }

        const headers = Object.keys(data[0]);
        const fmt = BANK_FORMATS[format] || BANK_FORMATS.auto;

        const dateCol = findCol(headers, fmt.dateCol);
        const descCol = findCol(headers, fmt.descCol);
        const amtCol = findCol(headers, fmt.amountCol);
        const creditCol = fmt.creditCol ? findCol(headers, fmt.creditCol) : null;
        const debitCol = fmt.debitCol ? findCol(headers, fmt.debitCol) : null;

        if (!dateCol || !descCol) {
          setError(`Could not find required columns. Found: ${headers.join(", ")}`);
          return;
        }

        const parsed: ParsedRow[] = data.map(row => {
          const desc = row[descCol] || "";
          let amount = 0;

          if (creditCol && debitCol) {
            const credit = parseAmount(row[creditCol] || "0");
            const debit = parseAmount(row[debitCol] || "0");
            amount = credit > 0 ? credit : -debit;
          } else if (amtCol) {
            amount = parseAmount(row[amtCol]);
            // Cash App: "net amount" already has sign
          } else {
            amount = 0;
          }

          // Some banks use negative for expenses, positive for income
          // If all amounts are negative, likely expense-negative format
          const type: "income" | "expense" = amount >= 0 ? "income" : "expense";

          return {
            date: parseDate(row[dateCol] || ""),
            description: desc.trim(),
            amount,
            type,
            category: guessCategory(desc),
            merchant: desc.trim(),
            selected: true,
            raw: row,
          };
        }).filter(r => r.description && r.amount !== 0);

        setRows(parsed);
      },
      error: (err) => setError(err.message),
    });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setDone(false);

    if (file.name.toLowerCase().endsWith(".pdf")) {
      try {
        const parsed = await parsePDF(file);
        if (!parsed.length) {
          setError("No transactions found in PDF. Try uploading a CSV export instead.");
        } else {
          setRows(parsed);
        }
      } catch (err: any) {
        setError("Could not parse PDF: " + err.message);
      }
    } else {
      parseCSV(file, bankFormat);
    }
  };

  const toggleRow = (i: number) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r));
  };

  const updateRow = (i: number, field: keyof ParsedRow, value: any) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };

  const selectAll = (val: boolean) => setRows(prev => prev.map(r => ({ ...r, selected: val })));

  const handleImport = async () => {
    const selected = rows.filter(r => r.selected);
    if (!selected.length) return;
    setImporting(true);
    setError(null);

    try {
      for (const row of selected) {
        await api.createTransaction({
          date: row.date,
          description: row.description,
          amount: row.amount,
          category: row.category,
          type: row.type,
          source: "manual",
          mode: defaultMode,
          merchant: row.merchant || undefined,
        } as any);
      }
      setDone(true);
      setRows([]);
      onImport();
      setTimeout(() => { setOpen(false); setDone(false); }, 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = rows.filter(r => r.selected).length;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "rgba(59,130,246,0.1)", border: "1px dashed rgba(59,130,246,0.4)",
        borderRadius: 10, padding: "10px 16px", color: "#60a5fa",
        fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%",
        marginBottom: 12,
      }}>
        <Upload size={15} /> Upload Bank Statement (CSV)
      </button>
    );
  }

  return (
    <div style={{
      background: "var(--navy-800)", border: "1px solid var(--border)",
      borderRadius: 12, padding: 20, marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)", fontWeight: 700, fontSize: 15 }}>
          <FileText size={16} /> Import Bank Statement
        </div>
        <button onClick={() => { setOpen(false); setRows([]); setError(null); }}
          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
          <X size={16} />
        </button>
      </div>

      {/* Bank format selector + file upload */}
      {rows.length === 0 && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Bank Format</label>
              <div style={{ position: "relative" }}>
                <select value={bankFormat} onChange={e => setBankFormat(e.target.value)} style={{
                  width: "100%", background: "var(--navy-900)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "8px 32px 8px 12px", color: "var(--text-primary)",
                  fontSize: 13, appearance: "none", cursor: "pointer",
                }}>
                  {Object.entries(BANK_FORMATS).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
              </div>
            </div>

            <div style={{ flex: 2, minWidth: 200 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>CSV or PDF File</label>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: "1px dashed var(--border)", borderRadius: 8, padding: "8px 14px",
                  color: "var(--text-muted)", fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  background: "var(--navy-900)",
                }}
              >
                <Upload size={14} />
                {fileName || "Click to choose CSV or PDF file..."}
              </div>
              <input ref={fileRef} type="file" accept=".csv,.pdf" onChange={handleFile} style={{ display: "none" }} />
            </div>
          </div>

          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
            💡 Supports CSV and PDF exports. Most banks offer CSV — look for "Download" or "Export" in your transaction history.
          </p>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Cash App PDF: Profile → Personal → Documents → Monthly Statements → Download
          </p>
        </>
      )}

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#f87171", fontSize: 13, marginTop: 10, background: "rgba(239,68,68,0.1)", padding: "8px 12px", borderRadius: 8 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {done && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#22c55e", fontSize: 13, marginTop: 10 }}>
          <Check size={14} /> Imported successfully!
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              <strong style={{ color: "var(--text-primary)" }}>{rows.length}</strong> transactions found —{" "}
              <strong style={{ color: "#60a5fa" }}>{selectedCount}</strong> selected
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => selectAll(true)} style={{ fontSize: 11, color: "var(--accent-blue)", background: "none", border: "none", cursor: "pointer" }}>Select all</button>
              <button onClick={() => selectAll(false)} style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>Deselect all</button>
              <button onClick={() => { setRows([]); setFileName(""); if (fileRef.current) fileRef.current.value = ""; }} style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                Change file
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 340, overflowY: "auto", borderRadius: 8, border: "1px solid var(--border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--navy-900)", position: "sticky", top: 0 }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600 }}>✓</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600 }}>Date</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600 }}>Description</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600 }}>Category</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)", background: row.selected ? "transparent" : "rgba(0,0,0,0.2)", opacity: row.selected ? 1 : 0.5 }}>
                    <td style={{ padding: "6px 10px" }}>
                      <input type="checkbox" checked={row.selected} onChange={() => toggleRow(i)} style={{ cursor: "pointer" }} />
                    </td>
                    <td style={{ padding: "6px 10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {new Date(row.date).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "6px 10px", color: "var(--text-primary)", maxWidth: 220 }}>
                      <input
                        value={row.description}
                        onChange={e => updateRow(i, "description", e.target.value)}
                        style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 12, width: "100%", outline: "none" }}
                      />
                    </td>
                    <td style={{ padding: "6px 10px" }}>
                      <select
                        value={row.category}
                        onChange={e => updateRow(i, "category", e.target.value)}
                        style={{ background: "var(--navy-900)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 6px", color: "var(--text-secondary)", fontSize: 11, cursor: "pointer" }}
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600, color: row.amount >= 0 ? "#22c55e" : "#f87171", whiteSpace: "nowrap" }}>
                      {row.amount >= 0 ? "+" : ""}${Math.abs(row.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
            <button onClick={() => { setRows([]); setFileName(""); }} style={{ padding: "8px 16px", background: "none", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing || selectedCount === 0}
              style={{ padding: "8px 20px", background: selectedCount > 0 ? "var(--accent-blue)" : "var(--navy-700)", border: "none", borderRadius: 8, color: "white", fontSize: 13, fontWeight: 600, cursor: selectedCount > 0 ? "pointer" : "not-allowed" }}
            >
              {importing ? "Importing..." : `Import ${selectedCount} Transaction${selectedCount !== 1 ? "s" : ""}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
