import React, { createContext, useContext, useEffect, useState } from "react";
import { API_URL } from "../config/api";

const TransactionsContext = createContext();

export const TransactionsProvider = ({ children }) => {

  const [transactions, setTransactions] = useState([]);

  const fetchTransactions = async () => {

    try {

      const token = localStorage.getItem("token");

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

  useEffect(() => {
    fetchTransactions();
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

      await fetchTransactions();

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

      await fetchTransactions();

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

      await fetchTransactions();

    } catch (error) {

      console.error("Error archiving transaction:", error);

    }

  };

  return (

    <TransactionsContext.Provider
      value={{
        transactions,
        fetchTransactions,
        markTransactionPaid,
        updateTransactionPaidAmount,
        archiveTransaction
      }}
    >

      {children}

    </TransactionsContext.Provider>

  );

};

export const useTransactions = () => useContext(TransactionsContext);