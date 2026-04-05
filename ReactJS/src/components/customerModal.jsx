import React, { useEffect, useState } from "react";
import "../componentstyle/smallcardModal.css";
import '../componentstyle/customerModalstylesheet.css';
import Swal from 'sweetalert2';
import { API_URL } from "../config/api";

function normalizeFullName(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Same key as POS: street|barangay|city normalized for comparison. */
function normalizeAddressKey(street, barangay, city) {
  return [street, barangay, city]
    .map((x) => String(x || "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

function splitAddressLine(address) {
  const raw = String(address || "").trim();
  if (!raw) return { street: "", barangay: "", city: "" };
  const parts = raw.split(",").map((p) => p.trim());
  return {
    street: parts[0] || "",
    barangay: parts[1] || "",
    city: parts[2] || "",
  };
}

function addressKeyFromTransaction(t) {
  const p = splitAddressLine(t.customer_address);
  return normalizeAddressKey(p.street, p.barangay, p.city);
}

function addressKeyFromApiCustomer(c) {
  if (c.street || c.barangay || c.city) {
    return normalizeAddressKey(c.street, c.barangay, c.city);
  }
  if (c.address) {
    const p = splitAddressLine(c.address);
    return normalizeAddressKey(p.street, p.barangay, p.city);
  }
  return "";
}

function customerNameMatchesRecord(c, targetNameNorm) {
  const byName = normalizeFullName(c.name);
  const byParts = normalizeFullName(`${c.first_name || ""} ${c.last_name || ""}`);
  return byName === targetNameNorm || (byParts === targetNameNorm && byParts.length > 0);
}

async function fetchCustomerNameMatches(query) {
  const token = localStorage.getItem("token");
  if (!token || query.trim().length < 2) return [];
  const res = await fetch(`${API_URL}/customers/search/${encodeURIComponent(query.trim())}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Same person = same normalized name AND same normalized address (not name alone). */
function hasDuplicateNameAndAddress(fullName, street, barangay, city, transactions) {
  const targetName = normalizeFullName(fullName);
  const targetAddr = normalizeAddressKey(street, barangay, city);
  if (!targetName || !targetAddr) return false;

  return (transactions || []).some(
    (t) =>
      !t.archived &&
      normalizeFullName(t.customer_name) === targetName &&
      addressKeyFromTransaction(t) === targetAddr
  );
}

const CustomerModal = ({ isOpen, onClose, onSave, initial, transactions = [] }) => {
  // Chopped States
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [street, setStreet] = useState("");
  const [barangay, setBarangay] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    if (isOpen) {
      // If initial data exists, we pre-fill (useful for editing)
      setFirstName(initial?.firstName || "");
      setLastName(initial?.lastName || "");
      setStreet(initial?.street || "");
      setBarangay(initial?.barangay || "");
      setCity(initial?.city || "");
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleSave = async () => {
    // Validation: Check if required fields are filled
    if (!firstName || !lastName || !street || !barangay || !city) {
      Swal.fire({
        title: 'Missing customer details',
        text: 'Please fill in all customer information fields.',
        icon: 'warning',
        width: 420,
      });
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const targetName = normalizeFullName(fullName);
    const targetAddr = normalizeAddressKey(street, barangay, city);

    let duplicateInApi = false;
    try {
      const rows = await fetchCustomerNameMatches(fullName);
      duplicateInApi = rows.some(
        (c) =>
          customerNameMatchesRecord(c, targetName) && addressKeyFromApiCustomer(c) === targetAddr
      );
    } catch {
      /* ignore network errors; still allow save */
    }

    const duplicateInTx = hasDuplicateNameAndAddress(
      fullName,
      street,
      barangay,
      city,
      transactions
    );

    if (duplicateInApi || duplicateInTx) {
      const result = await Swal.fire({
        title: "Customer may already exist",
        text:
          `The same name and address "${fullName}" / "${[street, barangay, city].filter(Boolean).join(", ")}" ` +
          `matches someone already on file. Use Search Names on the POS to load them, or continue only if you are sure this is not a duplicate entry.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Continue anyway",
        cancelButtonText: "Go back",
        width: 460,
      });
      if (!result.isConfirmed) return;
    }

    onSave({
      firstName,
      lastName,
      street,
      barangay,
      city,
    });

    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Customer</h2>
        </div>
        
        <div className="modal-body">
          {/* Name Section */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="modal-input-group" style={{ flex: 1 }}>
              <label className="modal-label">First Name</label>
              <input
                type="text"
                className="modal-kilos-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
              />
            </div>
            <div className="modal-input-group" style={{ flex: 1 }}>
              <label className="modal-label">Last Name</label>
              <input
                type="text"
                className="modal-kilos-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
              />
            </div>
          </div>

          {/* Address Section */}
          <div className="modal-input-group">
            <label className="modal-label">Street / Drive</label>
            <input
              type="text"
              className="modal-kilos-input"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="123 Apple St."
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="modal-input-group" style={{ flex: 1 }}>
              <label className="modal-label">Barangay</label>
              <input
                type="text"
                className="modal-kilos-input"
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                placeholder="Brgy. 1"
              />
            </div>
            <div className="modal-input-group" style={{ flex: 1 }}>
              <label className="modal-label">City</label>
              <input
                type="text"
                className="modal-kilos-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City Name"
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-btn cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-btn add-btn" onClick={handleSave}>
            Save Customer
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerModal;


