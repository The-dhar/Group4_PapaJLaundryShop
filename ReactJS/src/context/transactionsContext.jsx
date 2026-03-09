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
          "Authorization": `Bearer ${token}`
        }
      });

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

    const token = localStorage.getItem("token");

    await fetch(`${API_URL}/transactions/${id}/mark-paid`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    fetchTransactions();
  };

  const updateTransactionPaidAmount = async (id, paidAmount, penalty, paymentMethod) => {

    const token = localStorage.getItem("token");

    await fetch(`${API_URL}/transactions/${id}/update-payment`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        paid_amount: paidAmount,
        penalty: penalty,
        payment_method: paymentMethod
      })
    });

    fetchTransactions();
  };

  const archiveTransaction = async (id) => {

    const token = localStorage.getItem("token");

    await fetch(`${API_URL}/transactions/${id}/archive`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    fetchTransactions();
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