import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const TransactionsContext = createContext(null);

const seedTransactions = [
  {
    id: 'txn-seed-1',
    receipt: 'RCPT-10001',
    customer_name: 'Ana Dela Cruz',
    customer_address: '123 Main St',
    services: [
      {
        id: 'svc-1',
        serviceName: 'Clothes',
        rate: 25.0,
        kilos: 4,
        laundryType: 'wash-and-fold',
        total: 100,
      },
    ],
    weight: 4,
    amount: 100,
    payment_status: 'unpaid',
    inventory_status: 'in_shop',
    due_date: '2025-12-20',
    extra_charge_type: 'none',
    discount_amount: 0,
    created_at: new Date().toISOString(),
    // structured receipt_items for UI table (matches requested columns)
    receipt_items: [
      {
        receiptId: 'RCPT-10001',
        name: 'Ana Dela Cruz',
        item: 'Clothes',
        laundryType: 'wash-and-fold',
        quantity: 4,
        price: 100,
        paymentStatus: 'unpaid',
        laundryStatus: 'in_shop',
        penaltyFee: 0,
        duedate: '2025-12-20',
      },
    ],
  },
  {
    id: 'txn-seed-2',
    receipt: 'RCPT-10002',
    customer_name: 'Johnny Reyes',
    customer_address: '456 Oak Ave',
    services: [
      {
        id: 'svc-2',
        serviceName: 'Blankets',
        rate: 40.0,
        kilos: 2,
        laundryType: 'standard',
        total: 80,
      },
    ],
    weight: 2,
    amount: 80,
    payment_status: 'paid',
    inventory_status: 'picked_up',
    due_date: '2025-12-18',
    extra_charge_type: 'none',
    discount_amount: 0,
    created_at: new Date().toISOString(),
    receipt_items: [
      {
        receiptId: 'RCPT-10002',
        name: 'Johnny Reyes',
        item: 'Blankets',
        laundryType: 'Dry only',
        quantity: 2,
        price: 80,
        paymentStatus: 'paid',
        laundryStatus: 'picked_up',
        penaltyFee: 0,
        duedate: '2025-12-18',
      },
    ],
  },
];

export const TransactionsProvider = ({ children }) => {
  // persist key
  const STORAGE_KEY = 'systemadmin_transactions_v1';

  // Helper: build receipt_items from services if missing
  const ensureReceiptItems = (txn) => {
    if (txn.receipt_items && Array.isArray(txn.receipt_items) && txn.receipt_items.length > 0) {
      return txn;
    }
    // Reconstruct receipt_items from services
    const items = Array.isArray(txn.services)
      ? txn.services.map((s) => ({
          receiptId: txn.receipt,
          name: txn.customer_name,
          item: s.serviceName,
          laundryType: s.laundryType ?? s.laundry_type ?? '',
          quantity: s.kilos ?? 0,
          price: s.total ?? 0,
          paymentStatus: txn.payment_status,
          laundryStatus: txn.inventory_status,
          penaltyFee: 0,
          duedate: txn.due_date,
        }))
      : [];
    return { ...txn, receipt_items: items };
  };

  // initialize from localStorage if available, otherwise seeds
  const [transactions, setTransactions] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Ensure all transactions have receipt_items
          return parsed.map(ensureReceiptItems);
        }
      }
    } catch (e) {
      // ignore parse errors and fall back to seed
    }
    return seedTransactions;
  });

  // persist whenever transactions change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (e) {
      // storage write failed (quota?) — still keep in memory
      // you can log if needed: console.error(e)
    }
  }, [transactions]);

  // Generate unique receipt ID — safely handle missing or invalid receipts
  const generateReceiptId = () => {
    let max = 10000;

    transactions.forEach((t) => {
      if (t && t.receipt && typeof t.receipt === 'string') {
        const parts = t.receipt.split('-');
        if (parts.length >= 2) {
          const num = parseInt(parts[1], 10);
          if (!isNaN(num) && num > max) {
            max = num;
          }
        }
      }
    });

    return `RCPT-${max + 1}`;
  };

  // Create transaction from POs payload
  const createTransaction = ({
    customer_name,
    customer_address,
    services,
    weight,
    amount,
    due_date,
    extra_charge_type = 'none',
    discount_amount = 0,
    // optional payment fields from POs
    payment_status = 'unpaid',
    payment_method = '',
    paid_amount = 0,
  }) => {
    const receipt = generateReceiptId();
    const now = new Date().toISOString();

    // clone services to avoid future mutations from UI affecting stored transaction
    const servicesCopy = Array.isArray(services)
      ? services.map((s) => ({ ...s }))
      : [];

    // Build structured receipt items for each service so UI can render columns directly
    const receiptItems = servicesCopy.map((s) => ({
      receiptId: receipt,
      name: customer_name,
      item: s.serviceName,
      laundryType: s.laundryType ?? s.laundry_type ?? '',
      quantity: s.kilos ?? s.quantity ?? 0,
      price: s.total ?? s.price ?? (s.rate && (s.kilos ?? 0) * s.rate) ?? 0,
      paymentStatus: payment_status,
      laundryStatus: 'in_shop',
      penaltyFee: extra_charge_type === 'none' ? 0 : 0, // adjust if you have an actual penalty amount
      duedate: due_date,
    }));

    const newTxn = {
      id: `RCPT-${Date.now()}`,
      receipt,
      customer_name,
      customer_address,
      services: servicesCopy,
      weight,
      amount,
      payment_status, // set from POs (paid/unpaid)
      payment_method,
      paid_amount,
      inventory_status: 'in_shop',
      due_date,
      extra_charge_type,
      discount_amount,
      created_at: now,
      // attach structured receipt_items for table display / inventory
      receipt_items: receiptItems,
    };
    setTransactions((prev) => [newTxn, ...prev]);
    return newTxn;
  };

  // Mark as paid
  const markTransactionPaid = (txnId) => {
    setTransactions((prev) =>
      prev.map((txn) =>
        txn.id === txnId
          ? {
              ...txn,
              payment_status: 'paid',
              receipt_items: Array.isArray(txn.receipt_items)
                ? txn.receipt_items.map((it) => ({ ...it, paymentStatus: 'paid' }))
                : txn.receipt_items,
            }
          : txn
      )
    );
  };

  // Mark as picked up
  const markTransactionPickedUp = (txnId) => {
    setTransactions((prev) =>
      prev.map((txn) =>
        txn.id === txnId
          ? {
              ...txn,
              inventory_status: 'picked_up',
              receipt_items: Array.isArray(txn.receipt_items)
                ? txn.receipt_items.map((it) => ({ ...it, laundryStatus: 'picked_up' }))
                : txn.receipt_items,
            }
          : txn
      )
    );
  };

  // Delete transaction
  const deleteTransaction = (txnId) => {
    setTransactions((prev) => prev.filter((txn) => txn.id !== txnId));
  };

 // Update paid amount + penalty + balance for a transaction
const updateTransactionPaidAmount = (txnId, paidAmount, penalty) => {
  setTransactions((prev) =>
    prev.map((txn) => {
      if (txn.id === txnId) {
        const totalWithPenalty = txn.amount + (penalty || 0);
        const balance = totalWithPenalty - paidAmount;

        return {
          ...txn,
          paid_amount: paidAmount,
          penalty: penalty,
          total_payment: totalWithPenalty,
          balance: balance < 0 ? 0 : balance,
        };
      }
      return txn;
    })
  );
};

  const value = useMemo(
    () => ({
      transactions,
      createTransaction,
      markTransactionPaid,
      markTransactionPickedUp,
      deleteTransaction,
      updateTransactionPaidAmount,
    }),
    [transactions]
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
    throw new Error('useTransactions must be used within TransactionsProvider');
  }
  return context;
};


