import { useState, useMemo } from "react";
import {
  Search, Plus, Trash2, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, DollarSign, Package,
  ShoppingCart, X, Check, Truck,
} from "lucide-react";
import { format } from "date-fns";
import { PEPTIDE_CATEGORIES, PEPTIDE_SUPPLIERS, type PeptideProduct } from "../data/peptides";
import * as api from "../lib/api";
import styles from "./PeptideCalculator.module.css";

interface CartItem {
  product: PeptideProduct;
  packs: number;
  sellPricePerVial: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}
function pct(n: number) {
  return isFinite(n) ? n.toFixed(1) + "%" : "—";
}

// Extract vial size label from spec string: "5mg × 10 vials" → "5mg"
function parseVialSize(spec: string): string {
  const match = spec.match(/^([\d.]+\s*(?:mg|mcg|IU|ml|iu))/i);
  return match ? match[1].trim() : "Other";
}

export default function PeptideCalculator() {
  const [supplierId, setSupplierId] = useState("A");
  const [category, setCategory] = useState("All");
  const [vialSize, setVialSize] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCatalog, setShowCatalog] = useState(true);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const activeSupplier = PEPTIDE_SUPPLIERS.find(s => s.id === supplierId) ?? PEPTIDE_SUPPLIERS[0];
  const PEPTIDE_DB = activeSupplier.db;

  // Build unique vial size list from the DB
  const vialSizes = useMemo(() => {
    const sizes = new Set(PEPTIDE_DB.map(p => parseVialSize(p.spec)));
    return ["All", ...Array.from(sizes).sort((a, b) => {
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    })];
  }, [PEPTIDE_DB]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return PEPTIDE_DB.filter(p => {
      const matchCat = category === "All" || p.category === category;
      const matchSize = vialSize === "All" || parseVialSize(p.spec) === vialSize;
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.spec.toLowerCase().includes(q);
      return matchCat && matchSize && matchQ;
    });
  }, [category, vialSize, search]);

  const addToCart = (product: PeptideProduct) => {
    setCart(prev => prev.find(i => i.product.sku === product.sku)
      ? prev
      : [...prev, { product, packs: 1, sellPricePerVial: 0 }]);
    setShowCatalog(false);
  };

  const updateCart = (sku: string, field: "packs" | "sellPricePerVial", value: number) => {
    setCart(prev => prev.map(i => i.product.sku === sku ? { ...i, [field]: value } : i));
  };

  const removeFromCart = (sku: string) => setCart(prev => prev.filter(i => i.product.sku !== sku));

  const totals = useMemo(() => cart.reduce((acc, item) => {
    const totalVials = item.product.vials * item.packs;
    const costPerVial = item.product.supplierCostPer10 / item.product.vials;
    const totalCost = costPerVial * totalVials;
    const totalRevenue = item.sellPricePerVial * totalVials;
    return {
      cost: acc.cost + totalCost,
      revenue: acc.revenue + totalRevenue,
      profit: acc.profit + (totalRevenue - totalCost),
      vials: acc.vials + totalVials,
    };
  }, { cost: 0, revenue: 0, profit: 0, vials: 0 }), [cart]);

  const overallMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
  const roi = totals.cost > 0 ? (totals.profit / totals.cost) * 100 : 0;
  const inCart = (sku: string) => cart.some(i => i.product.sku === sku);

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Package size={18} />
          <span>Peptide Profit Calculator</span>
          <div className={styles.supplierToggle}>
            {PEPTIDE_SUPPLIERS.map(s => (
              <button
                key={s.id}
                className={`${styles.supplierBtn} ${supplierId === s.id ? styles.supplierBtnActive : ""}`}
                onClick={() => { setSupplierId(s.id); setCart([]); setCategory("All"); setVialSize("All"); }}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.headerActions}>
          {cart.length > 0 && (
            <button className={styles.orderBtn} onClick={() => setShowOrderModal(true)}>
              <ShoppingCart size={14} />
              Save as Order ({cart.length})
            </button>
          )}
          <button className={styles.toggleBtn} onClick={() => setShowCatalog(v => !v)}>
            {showCatalog ? <><ChevronUp size={14} /> Hide Catalog</> : <><ChevronDown size={14} /> Browse Catalog</>}
          </button>
        </div>
      </div>

      {/* Catalog */}
      {showCatalog && (
        <div className={styles.catalog}>
          <div className={styles.catalogControls}>
            {/* Search */}
            <div className={styles.searchBox}>
              <Search size={13} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or SKU..." className={styles.searchInput} />
              {search && <button onClick={() => setSearch("")} className={styles.clearBtn}><X size={12} /></button>}
            </div>

            {/* Category filter */}
            <div className={styles.filterRow}>
              <span className={styles.filterLabel}>Category:</span>
              <div className={styles.filterTabs}>
                {PEPTIDE_CATEGORIES.map(c => (
                  <button key={c} className={`${styles.filterTab} ${category === c ? styles.filterTabActive : ""}`} onClick={() => setCategory(c)}>{c}</button>
                ))}
              </div>
            </div>

            {/* Vial size filter */}
            <div className={styles.filterRow}>
              <span className={styles.filterLabel}>Vial Size:</span>
              <div className={styles.filterTabs}>
                {vialSizes.map(s => (
                  <button key={s} className={`${styles.filterTab} ${vialSize === s ? styles.filterTabSize : ""}`} onClick={() => setVialSize(s)}>{s}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Product grid */}
          <div className={styles.productGrid}>
            {filtered.map(p => {
              const costPerVial = p.supplierCostPer10 / p.vials;
              const added = inCart(p.sku);
              return (
                <div key={p.sku} className={`${styles.productCard} ${added ? styles.productCardAdded : ""}`}>
                  <div className={styles.productCardTop}>
                    <span className={styles.productSku}>{p.sku}</span>
                    <span className={styles.vialSizeBadge}>{parseVialSize(p.spec)}</span>
                  </div>
                  <div className={styles.productName}>{p.name}</div>
                  <div className={styles.productSpec}>{p.spec}</div>
                  <div className={styles.productPricing}>
                    <div className={styles.productCost}>
                      <span className={styles.costLabel}>Pack cost</span>
                      <span className={styles.costValue}>{fmt(p.supplierCostPer10)}</span>
                    </div>
                    <div className={styles.productCost}>
                      <span className={styles.costLabel}>Per vial</span>
                      <span className={styles.costValue}>{fmt(costPerVial)}</span>
                    </div>
                  </div>
                  <button className={`${styles.addBtn} ${added ? styles.addBtnAdded : ""}`} onClick={() => !added && addToCart(p)} disabled={added}>
                    {added ? <><Check size={11} /> Added</> : <><Plus size={11} /> Add to Calculator</>}
                  </button>
                </div>
              );
            })}
            {filtered.length === 0 && <div className={styles.noResults}>No peptides match your filters</div>}
          </div>
        </div>
      )}

      {/* Calculator table */}
      {cart.length === 0 ? (
        <div className={styles.emptyCart}>
          <Package size={32} style={{ opacity: 0.3 }} />
          <p>Add peptides from the catalog to calculate profit & place orders</p>
          <button className={styles.toggleBtn} onClick={() => setShowCatalog(true)}><Plus size={13} /> Browse Catalog</button>
        </div>
      ) : (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Spec</th>
                  <th className={styles.numCol}>Cost/Vial</th>
                  <th className={styles.numCol}>Packs</th>
                  <th className={styles.numCol}>Total Vials</th>
                  <th className={styles.numCol}>Your Price/Vial</th>
                  <th className={styles.numCol}>Revenue</th>
                  <th className={styles.numCol}>Total Cost</th>
                  <th className={styles.numCol}>Profit</th>
                  <th className={styles.numCol}>Margin</th>
                  <th className={styles.numCol}>ROI</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cart.map(item => {
                  const costPerVial = item.product.supplierCostPer10 / item.product.vials;
                  const totalVials = item.product.vials * item.packs;
                  const totalCost = costPerVial * totalVials;
                  const revenue = item.sellPricePerVial * totalVials;
                  const profit = revenue - totalCost;
                  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
                  const itemRoi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
                  const isProfit = profit >= 0;
                  return (
                    <tr key={item.product.sku} className={styles.tableRow}>
                      <td>
                        <div className={styles.cellName}>{item.product.name}</div>
                        <div className={styles.cellSku}>{item.product.sku}</div>
                      </td>
                      <td className={styles.cellSpec}>{item.product.spec}</td>
                      <td className={styles.numCol}>{fmt(costPerVial)}</td>
                      <td className={styles.numCol}>
                        <input type="number" min="1" value={item.packs}
                          onChange={e => updateCart(item.product.sku, "packs", Math.max(1, parseInt(e.target.value) || 1))}
                          className={styles.numInput} />
                      </td>
                      <td className={styles.numCol}>{totalVials}</td>
                      <td className={styles.numCol}>
                        <div className={styles.priceInputWrap}>
                          <span>$</span>
                          <input type="number" min="0" step="0.01" value={item.sellPricePerVial || ""}
                            onChange={e => updateCart(item.product.sku, "sellPricePerVial", parseFloat(e.target.value) || 0)}
                            className={styles.priceInput} placeholder="0.00" />
                        </div>
                      </td>
                      <td className={styles.numCol} style={{ color: "var(--accent-green)" }}>{item.sellPricePerVial > 0 ? fmt(revenue) : "—"}</td>
                      <td className={styles.numCol} style={{ color: "var(--accent-red)" }}>{fmt(totalCost)}</td>
                      <td className={styles.numCol}>
                        <span style={{ color: isProfit ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 700 }}>
                          {item.sellPricePerVial > 0 ? (isProfit ? "+" : "") + fmt(profit) : "—"}
                        </span>
                      </td>
                      <td className={styles.numCol}>
                        <span className={`${styles.badge} ${item.sellPricePerVial > 0 ? (isProfit ? styles.badgeGreen : styles.badgeRed) : styles.badgeGray}`}>
                          {item.sellPricePerVial > 0 ? pct(margin) : "—"}
                        </span>
                      </td>
                      <td className={styles.numCol}>
                        <span style={{ color: isProfit ? "var(--accent-green)" : "var(--accent-red)", fontSize: 12 }}>
                          {item.sellPricePerVial > 0 ? pct(itemRoi) : "—"}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => removeFromCart(item.product.sku)} className={styles.removeBtn}><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className={styles.summaryRow}>
            <SummaryCard icon={<Package size={18} />} label="Total Vials" value={String(totals.vials)} sub={`${cart.length} product${cart.length !== 1 ? "s" : ""}`} color="var(--accent-blue)" />
            <SummaryCard icon={<TrendingDown size={18} />} label="Total Investment" value={fmt(totals.cost)} sub="supplier cost" color="var(--accent-red)" />
            <SummaryCard icon={<DollarSign size={18} />} label="Total Revenue" value={totals.revenue > 0 ? fmt(totals.revenue) : "—"} sub="at your prices" color="var(--accent-blue)" />
            <SummaryCard icon={<TrendingUp size={18} />} label="Net Profit" value={totals.revenue > 0 ? (totals.profit >= 0 ? "+" : "") + fmt(totals.profit) : "—"} sub={totals.revenue > 0 ? `${pct(overallMargin)} margin` : "enter sell prices"} color={totals.profit >= 0 ? "var(--accent-green)" : "var(--accent-red)"} />
            <SummaryCard icon={<TrendingUp size={18} />} label="ROI" value={totals.revenue > 0 ? pct(roi) : "—"} sub="return on investment" color={roi >= 0 ? "var(--accent-green)" : "var(--accent-red)"} />
          </div>
        </>
      )}

      {/* Order Modal */}
      {showOrderModal && (
        <OrderModal
          cart={cart}
          totals={totals}
          onClose={() => setShowOrderModal(false)}
          onSaved={() => { setShowOrderModal(false); setCart([]); }}
        />
      )}
    </div>
  );
}

// ── Order Modal ───────────────────────────────────────────────────────────────

function OrderModal({ cart, totals, onClose, onSaved }: {
  cart: CartItem[];
  totals: { cost: number; revenue: number; profit: number; vials: number };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [shipping, setShipping] = useState("");
  const [orderRef, setOrderRef] = useState(`Peptide Order — ${format(new Date(), "MMM d, yyyy")}`);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const shippingCost = parseFloat(shipping) || 0;
  const totalWithShipping = totals.cost + shippingCost;

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const orderDate = new Date(date).toISOString();
      const itemsSummary = cart.map(i =>
        `${i.product.name} (${i.product.sku}) × ${i.packs} pack${i.packs > 1 ? "s" : ""} = ${i.product.vials * i.packs} vials`
      ).join("\n");

      // Save main order transaction
      await api.createTransaction({
        date: orderDate,
        description: orderRef,
        amount: -totals.cost,
        category: "Other",
        type: "expense",
        source: "manual",
        mode: "business",
        merchant: "Tianjin Hengyuanxing Trading Co.",
        notes: itemsSummary,
      });

      // Save shipping as separate transaction if provided
      if (shippingCost > 0) {
        await api.createTransaction({
          date: orderDate,
          description: `Shipping — ${orderRef}`,
          amount: -shippingCost,
          category: "Transportation",
          type: "expense",
          source: "manual",
          mode: "business",
          merchant: "Shipping",
          notes: `Shipping cost for: ${orderRef}`,
        });
      }

      setSaved(true);
      setTimeout(() => onSaved(), 1400);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.orderModal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <ShoppingCart size={18} />
            <span>Save as Business Order</span>
          </div>
          <button onClick={onClose} className={styles.modalClose}><X size={18} /></button>
        </div>

        {saved ? (
          <div className={styles.savedState}>
            <div className={styles.savedCheck}><Check size={32} /></div>
            <p>Order saved to Business Transactions!</p>
          </div>
        ) : (
          <>
            {/* Order items */}
            <div className={styles.orderItems}>
              <div className={styles.orderItemsHeader}>
                <span>Order Items ({cart.length})</span>
                <span>{cart.reduce((s, i) => s + i.product.vials * i.packs, 0)} total vials</span>
              </div>
              {cart.map(item => {
                const costPerVial = item.product.supplierCostPer10 / item.product.vials;
                const totalVials = item.product.vials * item.packs;
                const totalCost = costPerVial * totalVials;
                return (
                  <div key={item.product.sku} className={styles.orderItem}>
                    <div className={styles.orderItemLeft}>
                      <span className={styles.orderItemName}>{item.product.name}</span>
                      <span className={styles.orderItemDetail}>{item.product.spec} × {item.packs} pack{item.packs > 1 ? "s" : ""} → {totalVials} vials</span>
                    </div>
                    <span className={styles.orderItemCost}>{fmt(totalCost)}</span>
                  </div>
                );
              })}
            </div>

            {/* Order fields */}
            <div className={styles.orderFields}>
              <div className={styles.orderField}>
                <label>Order Reference</label>
                <input value={orderRef} onChange={e => setOrderRef(e.target.value)} className={styles.orderInput} />
              </div>
              <div className={styles.orderField}>
                <label>Order Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={styles.orderInput} />
              </div>
              <div className={styles.orderField}>
                <label>
                  <Truck size={13} style={{ display: "inline", marginRight: 5 }} />
                  Shipping Cost (optional)
                </label>
                <div className={styles.shippingInputWrap}>
                  <span>$</span>
                  <input type="number" min="0" step="0.01" value={shipping}
                    onChange={e => setShipping(e.target.value)}
                    className={styles.shippingInput} placeholder="0.00" />
                </div>
                {shippingCost > 0 && <span className={styles.shippingNote}>Will be saved as a separate Transportation expense</span>}
              </div>
            </div>

            {/* Totals */}
            <div className={styles.orderTotals}>
              <div className={styles.orderTotalRow}>
                <span>Supplier Cost</span>
                <span>{fmt(totals.cost)}</span>
              </div>
              {shippingCost > 0 && (
                <div className={styles.orderTotalRow}>
                  <span>Shipping</span>
                  <span>{fmt(shippingCost)}</span>
                </div>
              )}
              <div className={`${styles.orderTotalRow} ${styles.orderTotalHighlight}`}>
                <span>Total Order Cost</span>
                <span style={{ color: "var(--accent-red)" }}>{fmt(totalWithShipping)}</span>
              </div>
              {totals.revenue > 0 && (
                <div className={`${styles.orderTotalRow} ${styles.orderTotalHighlight}`}>
                  <span>Expected Profit (after shipping)</span>
                  <span style={{ color: "var(--accent-green)" }}>+{fmt(totals.profit - shippingCost)}</span>
                </div>
              )}
            </div>

            {error && <div className={styles.orderError}><X size={13} /> {error}</div>}

            <div className={styles.orderActions}>
              <button onClick={onClose} className={styles.cancelBtn}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className={styles.saveOrderBtn}>
                {saving ? "Saving..." : <><Check size={14} /> Save to Business Transactions</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string }) {
  return (
    <div className={styles.summaryCard}>
      <div className={styles.summaryIcon} style={{ color }}>{icon}</div>
      <div>
        <div className={styles.summaryLabel}>{label}</div>
        <div className={styles.summaryValue} style={{ color }}>{value}</div>
        <div className={styles.summarySub}>{sub}</div>
      </div>
    </div>
  );
}
