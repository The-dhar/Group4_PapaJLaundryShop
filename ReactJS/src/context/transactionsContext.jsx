import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_URL } from "../config/api";

const TransactionsContext = createContext(null);
const LIVE_POLL_MS = 10000;
const RUSH_FEE = 100;

function shouldPollTransactions() {
  if (typeof window === "undefined") return true;
  const path = String(window.location.pathname || "").toLowerCase();
  // Polling while encoding a POS transaction can cause disruptive re-renders.
  return !path.startsWith("/pos");
}

function isTodayInputDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;

  return raw === today;
}

function sanitizeDateOnly(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const ymd = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return ymd;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sanitizeDateTime(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}

const normalizeTransaction = (txn) => {
  const services = Array.isArray(txn.receipt_items)
    ? txn.receipt_items.map((item) => ({
        id: item.id,
        serviceName: item.serviceName,
        laundryType: item.laundryType,
        rate: Number(item.rate) || 0,
        kilos: Number(item.kilos) || 0,
        total: Number(item.total) || 0,
      }))
    : [];

  const penaltyAmount = Number(txn.penalty_amount ?? txn.penalty ?? 0) || 0;
  const penaltySuggestedAmount = Number(txn.penalty_suggested_amount) || 0;

  return {
    ...txn,
    amount: Number(txn.amount) || 0,
    subtotal: Number(txn.subtotal) || 0,
    extras: Number(txn.extras) || 0,
    vat_amount: Number(txn.vat_amount ?? 0) || 0,
    vat_rate: txn.vat_rate != null && txn.vat_rate !== '' ? Number(txn.vat_rate) : null,
    paid_amount: Number(txn.paid_amount) || 0,
    penalty_amount: penaltyAmount,
    penalty: penaltyAmount,
    penalty_suggested_amount: penaltySuggestedAmount,
    penalty_override_reason: txn.penalty_override_reason || "",
    due_date: sanitizeDateOnly(txn.due_date),
    created_at:
      sanitizeDateTime(txn.created_at) ||
      sanitizeDateTime(txn.updated_at) ||
      '',
    weight: txn.total_weight ?? txn.weight ?? 0,
    services,
  };
};

export const TransactionsProvider = ({ children }) => {
  const [transactions, setTransactions] = useState([]);

  const archivedTransactions = useMemo(
    () => transactions.filter((t) => t.archived === true),
    [transactions]
  );

  const fetchTransactions = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return [];

      const res = await fetch(`${API_URL}/transactions?include_archived=1`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        setTransactions([]);
        return [];
      }

      if (!res.ok) {
        return [];
      }

      const contentType = String(res.headers.get("content-type") || "").toLowerCase();
      if (!contentType.includes("application/json")) {
        return [];
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data.map(normalizeTransaction) : [];
      setTransactions(list);
      return list;
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return [];
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (shouldPollTransactions()) {
        fetchTransactions();
      }
    }, LIVE_POLL_MS);

    const handleVisible = () => {
      if (document.visibilityState === "visible" && shouldPollTransactions()) {
        fetchTransactions();
      }
    };

    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleVisible);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
    };
  }, [fetchTransactions]);

  const createTransaction = async ({
    customer_name,
    customer_first_name,
    customer_last_name,
    customer_middle_name,
    customer_address,
    services,
    weight,
    amount,
    due_date,
    extra_charge_type = "none",
    discount_amount = 0,
    additional_amount = 0,
    active_extras = null,
    sub_extras = null,
    payment_status = "unpaid",
    payment_method = "",
    paid_amount = 0,
    subtotal = 0,
    /** When set, used as the extras line (rush/discount/misc) instead of legacy recomputation. */
    extras_line,
    vat_amount = 0,
    vat_rate = null,
    /** Required for owner (branches.id); clerk/staff omit — API uses their assigned branch. */
    branch_id,
  }) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Not authenticated");

      let effectiveBranchId = branch_id;
      if (effectiveBranchId == null || effectiveBranchId === "") {
        try {
          const raw = localStorage.getItem("user");
          const u = raw ? JSON.parse(raw) : null;
          if (u?.role === "owner") {
            const stored = localStorage.getItem("ownerSelectedBranchId");
            if (stored != null && stored !== "") {
              effectiveBranchId = Number(stored);
            }
          }
        } catch {
          // ignore
        }
      }

      const isRush = Boolean(active_extras?.express) || isTodayInputDate(due_date);
      const extras =
        extras_line !== undefined && extras_line !== null
          ? Number(extras_line)
          : (isRush ? RUSH_FEE : 0) +
            ((sub_extras?.extra_detergent || 0) * 20) +
            ((sub_extras?.extra_softener || 0) * 20) +
            (sub_extras?.stain_removal ? 50 : 0) +
            Number(additional_amount || 0) -
            (discount_amount || 0);

      const payload = {
        customer_name,
        ...(customer_first_name != null && String(customer_first_name).trim() !== ''
          ? { customer_first_name: String(customer_first_name).trim() }
          : {}),
        ...(customer_last_name != null && String(customer_last_name).trim() !== ''
          ? { customer_last_name: String(customer_last_name).trim() }
          : {}),
        ...(customer_middle_name != null && String(customer_middle_name).trim() !== ''
          ? { customer_middle_name: String(customer_middle_name).trim() }
          : {}),
        customer_address,
        services: (services || []).map((s) => ({
          serviceName: s.serviceName,
          laundryType: s.laundryType,
          rate: s.rate,
          kilos: s.kilos,
          total: s.total,
        })),
        weight: weight || 0,
        subtotal: subtotal || amount,
        extras,
        amount,
        payment_status,
        payment_method,
        paid_amount: paid_amount || 0,
        due_date,
        is_rush: isRush,
        vat_amount: Number(vat_amount) || 0,
        ...(vat_rate != null && vat_rate !== '' && Number(vat_amount) > 0
          ? { vat_rate: Number(vat_rate) }
          : {}),
      };

      if (effectiveBranchId != null && effectiveBranchId !== "") {
        payload.branch_id = Number(effectiveBranchId);
      }

      const res = await fetch(`${API_URL}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create transaction");
      }

      const result = await res.json();
      const createdTxn = normalizeTransaction({
        id: result.id ?? `local-${Date.now()}`,
        receipt: result.receipt,
        customer_name,
        customer_middle_name: result.customer_middle_name ?? customer_middle_name ?? null,
        customer_address,
        amount: Number(result.amount ?? amount) || 0,
        vat_amount: Number(result.vat_amount ?? vat_amount ?? 0) || 0,
        vat_rate:
          result.vat_rate != null && result.vat_rate !== ''
            ? Number(result.vat_rate)
            : vat_rate != null && vat_rate !== ''
              ? Number(vat_rate)
              : null,
        total_weight: Number(result.total_weight ?? weight) || 0,
        paid_amount: Number(result.paid_amount ?? paid_amount) || 0,
        penalty_amount: Number(result.penalty_amount ?? 0) || 0,
        penalty_suggested_amount: Number(result.penalty_suggested_amount ?? 0) || 0,
        penalty_override_reason: result.penalty_override_reason || "",
        is_rush: Boolean(result.is_rush ?? isRush),
        payment_status: result.payment_status ?? payment_status ?? "unpaid",
        payment_method: result.payment_method ?? payment_method ?? "",
        inventory_status: result.inventory_status ?? "in_shop",
        due_date: sanitizeDateOnly(result.due_date ?? due_date),
        archived: false,
        created_at: sanitizeDateTime(result.created_at) || new Date().toISOString(),
        receipt_items: Array.isArray(result.receipt_items) && result.receipt_items.length > 0
          ? result.receipt_items
          : (services || []).map((s, idx) => ({
              id: s.id ?? `${Date.now()}-${idx}`,
              serviceName: s.serviceName,
              laundryType: s.laundryType,
              rate: Number(s.rate) || 0,
              kilos: Number(s.kilos) || 0,
              total: Number(s.total) || 0,
            })),
        active_extras,
        sub_extras,
        extra_charge_type,
        discount_amount,
        additional_amount,
      });
      await fetchTransactions();
      return createdTxn;
    } catch (error) {
      console.error("Error creating transaction:", error);
      throw error;
    }
  };

  const markTransactionPaid = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/transactions/${id}/mark-paid`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to mark transaction as paid");
      await fetchTransactions();
    } catch (error) {
      console.error("Error marking paid:", error);
    }
  };

  const markTransactionPickedUp = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/transactions/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ inventory_status: "picked_up" }),
      });
      if (!res.ok) throw new Error("Failed to mark as picked up");
      await fetchTransactions();
    } catch (error) {
      console.error("Error marking picked up:", error);
    }
  };

  const updateTransactionPaidAmount = async (
    id,
    paidAmount,
    penaltyAmount,
    paymentMethod,
    penaltyOverrideReason = ""
  ) => {
    try {
      const token = localStorage.getItem("token");
      const trimmedReason = String(penaltyOverrideReason || "").trim();
      const res = await fetch(`${API_URL}/transactions/${id}/update-payment`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paid_amount: paidAmount,
          penalty_amount: penaltyAmount,
          payment_method: paymentMethod,
          ...(trimmedReason ? { penalty_override_reason: trimmedReason } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update payment");
      }

      await fetchTransactions();
    } catch (error) {
      console.error("Error updating payment:", error);
      throw error;
    }
  };

  const archiveTransaction = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/transactions/${id}/archive`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to archive transaction");
      await fetchTransactions();
    } catch (error) {
      console.error("Error archiving transaction:", error);
    }
  };

  const restoreTransaction = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/transactions/${id}/restore`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to restore transaction");
      await fetchTransactions();
    } catch (error) {
      console.error("Error restoring transaction:", error);
    }
  };

  const updateTransaction = async (id, payload) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/transactions/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update transaction");
      await fetchTransactions();
    } catch (error) {
      console.error("Error updating transaction:", error);
    }
  };

  const deleteTransaction = async (id) => {
    await archiveTransaction(id);
  };

  const value = useMemo(
    () => ({
      transactions,
      archivedTransactions,
      fetchTransactions,
      createTransaction,
      markTransactionPaid,
      markTransactionPickedUp,
      deleteTransaction,
      archiveTransaction,
      restoreTransaction,
      updateTransactionPaidAmount,
      updateTransaction,
    }),
    [transactions, archivedTransactions, fetchTransactions]
  );

  return (
    <TransactionsContext.Provider value={value}>
      {children}
    </TransactionsContext.Provider>
  );
};

export const useTransactions = () => {
  const context = useContext(TransactionsContext);
  if (!context) {
    throw new Error("useTransactions must be used within TransactionsProvider");
  }
  return context;
};
