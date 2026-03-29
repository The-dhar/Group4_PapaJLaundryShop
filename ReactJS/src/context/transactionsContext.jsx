import React, { createContext, useContext, useEffect, useState } from "react";
import { API_URL } from "../config/api";

const TransactionsContext = createContext();

export const TransactionsProvider = ({ children }) => {

  const [transactions, setTransactions] = useState([]);
  const [archivedTransactions, setArchivedTransactions] = useState([]);

  const fetchTransactions = async () => {

    try {

      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API_URL}/transactions`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error("Failed to fetch transactions");
      }

      const data = await res.json();

      console.log("Fetched transactions:", data);

      setTransactions(data);

    } catch (error) {

      console.error("Error fetching transactions:", error);

    }

  };

  const fetchArchivedTransactions = async () => {

    try {

      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API_URL}/transactions?include_archived=1`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error("Failed to fetch archived transactions");
      }

      const data = await res.json();

      setArchivedTransactions(data.filter((row) => row.archived === true));

    } catch (error) {

      console.error("Error fetching archived transactions:", error);

    }

  };

  useEffect(() => {
    fetchTransactions();
    fetchArchivedTransactions();
  }, []);

  const markTransactionPaid = async (id) => {

    try {

      const token = localStorage.getItem("token");

      const res = await fetch(`${API_URL}/transactions/${id}/mark-paid`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error("Failed to mark transaction as paid");
      }

      await Promise.all([fetchTransactions(), fetchArchivedTransactions()]);

    } catch (error) {

      console.error("Error marking paid:", error);

    }

  };

  const updateTransactionPaidAmount = async (
    id,
    paidAmount,
    penalty,
    paymentMethod
  ) => {

    try {

      const token = localStorage.getItem("token");

      const res = await fetch(`${API_URL}/transactions/${id}/update-payment`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          paid_amount: paidAmount,
          penalty: penalty,
          payment_method: paymentMethod
        })
      });

      if (!res.ok) {
        throw new Error("Failed to update payment");
      }

      await Promise.all([fetchTransactions(), fetchArchivedTransactions()]);

    } catch (error) {

      console.error("Error updating payment:", error);

    }

  };

  const archiveTransaction = async (id) => {

    try {

      const token = localStorage.getItem("token");

      const res = await fetch(`${API_URL}/transactions/${id}/archive`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error("Failed to archive transaction");
      }

      await Promise.all([fetchTransactions(), fetchArchivedTransactions()]);

    } catch (error) {

      console.error("Error archiving transaction:", error);

    }

  };

  const restoreTransaction = async (id) => {

    try {

      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API_URL}/transactions/${id}/restore`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error("Failed to restore transaction");
      }

      await Promise.all([fetchTransactions(), fetchArchivedTransactions()]);

    } catch (error) {

      console.error("Error restoring transaction:", error);

    }

  };

  const updateTransaction = async (id, payload) => {

    try {

      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API_URL}/transactions/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error("Failed to update transaction");
      }

      await Promise.all([fetchTransactions(), fetchArchivedTransactions()]);

    } catch (error) {

      console.error("Error updating transaction:", error);

    }

  };

  return (

    <TransactionsContext.Provider
      value={{
        transactions,
        archivedTransactions,
        fetchTransactions,
        fetchArchivedTransactions,
        markTransactionPaid,
        updateTransactionPaidAmount,
        archiveTransaction,
        restoreTransaction,
        updateTransaction
      }}
    >

      {children}

    </TransactionsContext.Provider>

  );

};

export const useTransactions = () => useContext(TransactionsContext);