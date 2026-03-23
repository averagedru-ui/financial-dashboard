import { useState, useMemo } from "react";
import { Search, Plus, Trash2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, DollarSign, Package } from "lucide-react";
import { PEPTIDE_DB, PEPTIDE_CATEGORIES, type PeptideProduct } from "../data/peptides";
import styles from "./PeptideCalculator.module.css";

interface CartItem {
  product: PeptideProduct;
  packs: number;       // how many 10-vial packs to order
  sellPricePerVial: number; // your sell price per vial
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}
function pct(n: number) {
  return isFinite(n) ? n.toFixed(1) + "%" : "—";
}

export default function PeptideCalculator() {
  const [category, setCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCatalog, setShowCatalog] = useState(true);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return PEPTIDE_DB.filter(p => {
      const matchCat = category === "All" || p.category === category;
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.spec.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [category, search]);

  const addToCart = (product: PeptideProduct) => {
    setCart(prev => {
      const exists = prev.find(i => i.product.sku === product.sku);
      if (exists) return prev;
      return [...prev, { product, packs: 1, sellPricePerVial: 0 }];
    });
    setShowCatalog(false);
  };

  const updateCart = (sku: string, field: "packs" | "sellPricePerVial", value: number) => {
    setCart(prev => prev.map(i => i.product.sku === sku ? { ...i, [field]: value } : i));
  };

  const removeFromCart = (sku: string) => {
    setCart(prev => prev.filter(i => i.product.sku !== sku));
  };

  // Totals
  const totals = useMemo(() => {
    return cart.reduce((acc, item) => {
      const totalVials = item.product.vials * item.packs;
      const costPerVial = item.product.supplierCostPer10 / item.product.vials;
      const totalCost = costPerVial * totalVials;
      const totalRevenue = item.sellPricePerVial * totalVials;
      const profit = totalRevenue - totalCost;
      return {
        cost: acc.cost + totalCost,
        revenue: acc.revenue + totalRevenue,
        profit: acc.profit + profit,
        vials: acc.vials + totalVials,
      };
    }, { cost: 0, revenue: 0, profit: 0, vials: 0 });
  }, [cart]);

  const overallMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
  const roi = totals.cost > 0 ? (totals.profit / totals.cost) * 100 : 0;

  const inCart = (sku: string) => cart.some(i => i.product.sku === sku);

  return (
    <div className={styles.root}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Package size={18} />
          <span>Peptide Profit Calculator</span>
          <span className={styles.headerSub}>— Tianjin Hengyuanxing supplier pricing</span>
        </div>
        <button className={styles.toggleBtn} onClick={() => setShowCatalog(v => !v)}>
          {showCatalog ? <><ChevronUp size={14} /> Hide Catalog</> : <><ChevronDown size={14} /> Browse Catalog</>}
        </button>
      </div>

      {/* ── Catalog ── */}
      {showCatalog && (
        <div className={styles.catalog}>
          {/* Search + Category */}
          <div className={styles.catalogControls}>
            <div className={styles.searchBox}>
              <Search size={13} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search peptides..."
                className={styles.searchInput}
              />
            </div>
            <div className={styles.catTabs}>
              {PEPTIDE_CATEGORIES.map(c => (
                <button
                  key={c}
                  className={`${styles.catTab} ${category === c ? styles.catTabActive : ""}`}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
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
                    <span className={styles.productCat}>{p.category}</span>
                  </div>
                  <div className={styles.productName}>{p.name}</div>
                  <div className={styles.productSpec}>{p.spec}</div>
                  <div className={styles.productPricing}>
                    <div className={styles.productCost}>
                      <span className={styles.costLabel}>Cost/pack</span>
                      <span className={styles.costValue}>{fmt(p.supplierCostPer10)}</span>
                    </div>
                    <div className={styles.productCost}>
                      <span className={styles.costLabel}>Cost/vial</span>
                      <span className={styles.costValue}>{fmt(costPerVial)}</span>
                    </div>
                  </div>
                  <button
                    className={`${styles.addBtn} ${added ? styles.addBtnAdded : ""}`}
                    onClick={() => !added && addToCart(p)}
                    disabled={added}
                  >
                    {added ? "✓ Added" : <><Plus size={12} /> Add to Calculator</>}
                  </button>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className={styles.noResults}>No peptides match your search</div>
            )}
          </div>
        </div>
      )}

      {/* ── Calculator Table ── */}
      {cart.length === 0 ? (
        <div className={styles.emptyCart}>
          <Package size={32} style={{ opacity: 0.3 }} />
          <p>Add peptides from the catalog above to calculate profit</p>
          <button className={styles.toggleBtn} onClick={() => setShowCatalog(true)}>
            <Plus size={13} /> Browse Catalog
          </button>
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
                        <input
                          type="number"
                          min="1"
                          value={item.packs}
                          onChange={e => updateCart(item.product.sku, "packs", Math.max(1, parseInt(e.target.value) || 1))}
                          className={styles.numInput}
                        />
                      </td>
                      <td className={styles.numCol}>{totalVials}</td>
                      <td className={styles.numCol}>
                        <div className={styles.priceInputWrap}>
                          <span>$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.sellPricePerVial || ""}
                            onChange={e => updateCart(item.product.sku, "sellPricePerVial", parseFloat(e.target.value) || 0)}
                            className={styles.priceInput}
                            placeholder="0.00"
                          />
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
                        <button onClick={() => removeFromCart(item.product.sku)} className={styles.removeBtn}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Summary Cards ── */}
          <div className={styles.summaryRow}>
            <SummaryCard
              icon={<Package size={18} />}
              label="Total Vials"
              value={String(totals.vials)}
              sub={`${cart.length} product${cart.length !== 1 ? "s" : ""}`}
              color="var(--accent-blue)"
            />
            <SummaryCard
              icon={<TrendingDown size={18} />}
              label="Total Investment"
              value={fmt(totals.cost)}
              sub="supplier cost"
              color="var(--accent-red)"
            />
            <SummaryCard
              icon={<DollarSign size={18} />}
              label="Total Revenue"
              value={totals.revenue > 0 ? fmt(totals.revenue) : "—"}
              sub="at your prices"
              color="var(--accent-blue)"
            />
            <SummaryCard
              icon={<TrendingUp size={18} />}
              label="Net Profit"
              value={totals.revenue > 0 ? (totals.profit >= 0 ? "+" : "") + fmt(totals.profit) : "—"}
              sub={totals.revenue > 0 ? `${pct(overallMargin)} margin` : "enter sell prices"}
              color={totals.profit >= 0 ? "var(--accent-green)" : "var(--accent-red)"}
            />
            <SummaryCard
              icon={<TrendingUp size={18} />}
              label="ROI"
              value={totals.revenue > 0 ? pct(roi) : "—"}
              sub="return on investment"
              color={roi >= 0 ? "var(--accent-green)" : "var(--accent-red)"}
            />
          </div>
        </>
      )}
    </div>
  );
}

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
