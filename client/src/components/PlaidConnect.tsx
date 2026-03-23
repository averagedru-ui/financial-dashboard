import { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Link2, RefreshCw, Trash2, ChevronDown, ChevronUp, Landmark, CreditCard, Wallet } from "lucide-react";
import styles from "./PlaidConnect.module.css";

const BASE = import.meta.env.VITE_API_URL || "/api";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) { const e = await res.json().catch(() => ({ error: res.statusText })); throw new Error(e.error || "Request failed"); }
  return res.json();
}

interface PlaidAccount { id: string; name: string; type: string; subtype: string; balance: number | null; available: number | null; currency: string | null; }
interface PlaidItem { item_id: string; institution_name: string; connectedAt: string; accounts: PlaidAccount[]; error?: string; }

function fmt(n: number | null, currency = "USD") {
  if (n === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

function AccountIcon({ type }: { type: string }) {
  if (type === "credit") return <CreditCard size={14} />;
  if (type === "investment") return <Landmark size={14} />;
  return <Wallet size={14} />;
}

export default function PlaidConnect({ onSync }: { onSync?: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const data = await req<{ accounts: PlaidItem[] }>("/plaid/accounts");
      setItems(data.accounts);
    } catch { /* no accounts yet */ }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const createLinkToken = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await req<{ link_token: string }>("/plaid/link-token", { method: "POST" });
      setLinkToken(data.link_token);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onSuccess = useCallback(async (public_token: string, metadata: any) => {
    setLoading(true);
    try {
      await req("/plaid/exchange-token", {
        method: "POST",
        body: JSON.stringify({
          public_token,
          institution_name: metadata.institution?.name,
          institution_id: metadata.institution?.institution_id,
        }),
      });
      setLinkToken(null);
      await fetchAccounts();
      // Auto-sync after connecting
      handleSync();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fetchAccounts]);

  const { open, ready } = usePlaidLink({ token: linkToken || "", onSuccess });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const data = await req<{ synced: number }>("/plaid/sync", { method: "POST" });
      setSyncResult(`✓ Synced ${data.synced} new transaction${data.synced !== 1 ? "s" : ""}`);
      onSync?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async (item_id: string) => {
    if (!confirm("Disconnect this account?")) return;
    try {
      await req("/plaid/accounts", { method: "DELETE", body: JSON.stringify({ item_id }) });
      setItems(prev => prev.filter(i => i.item_id !== item_id));
    } catch (e: any) { setError(e.message); }
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Landmark size={16} />
          <span>Connected Accounts</span>
          {items.length > 0 && <span className={styles.badge}>{items.length}</span>}
        </div>
        <div className={styles.headerActions}>
          {items.length > 0 && (
            <button className={styles.syncBtn} onClick={handleSync} disabled={syncing}>
              <RefreshCw size={13} className={syncing ? styles.spinning : ""} />
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
          )}
          <button className={styles.connectBtn} onClick={createLinkToken} disabled={loading}>
            <Link2 size={13} />
            {loading ? "Opening..." : "Connect Account"}
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error} <button onClick={() => setError(null)}>✕</button></div>}
      {syncResult && <div className={styles.syncResult}>{syncResult}</div>}

      {items.length === 0 ? (
        <div className={styles.empty}>
          <Landmark size={28} style={{ opacity: 0.3 }} />
          <p>No accounts connected yet</p>
          <p className={styles.emptyHint}>Connect your bank account or Cash App to auto-import transactions</p>
          <button className={styles.connectBtn} onClick={createLinkToken} disabled={loading}>
            <Link2 size={13} /> Connect your first account
          </button>
        </div>
      ) : (
        <div className={styles.itemList}>
          {items.map(item => (
            <div key={item.item_id} className={styles.item}>
              <div className={styles.itemHeader} onClick={() => setExpanded(e => e === item.item_id ? null : item.item_id)}>
                <div className={styles.itemLeft}>
                  <Landmark size={16} className={styles.bankIcon} />
                  <div>
                    <div className={styles.itemName}>{item.institution_name}</div>
                    <div className={styles.itemSub}>{item.accounts.length} account{item.accounts.length !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                <div className={styles.itemRight}>
                  <button className={styles.disconnectBtn} onClick={e => { e.stopPropagation(); handleDisconnect(item.item_id); }}>
                    <Trash2 size={12} />
                  </button>
                  {expanded === item.item_id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>
              {expanded === item.item_id && (
                <div className={styles.accountList}>
                  {item.error && <div className={styles.itemError}>{item.error}</div>}
                  {item.accounts.map(acc => (
                    <div key={acc.id} className={styles.account}>
                      <div className={styles.accountLeft}>
                        <AccountIcon type={acc.type} />
                        <div>
                          <div className={styles.accountName}>{acc.name}</div>
                          <div className={styles.accountType}>{acc.subtype}</div>
                        </div>
                      </div>
                      <div className={styles.accountRight}>
                        <div className={styles.accountBalance}>{fmt(acc.balance)}</div>
                        {acc.available !== null && acc.available !== acc.balance && (
                          <div className={styles.accountAvailable}>avail. {fmt(acc.available)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
