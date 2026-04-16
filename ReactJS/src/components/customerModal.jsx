import React, { useEffect, useState } from "react";
import "../componentstyle/smallcardModal.css";
import '../componentstyle/customerModalstylesheet.css';
import Swal from 'sweetalert2';
import { API_URL } from "../config/api";
import {
  findPsgcByName,
  loadPsgcBarangaysByCityCode,
  loadPsgcCities,
} from '../utils/psgc';

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

function buildFullName(first, middle, last) {
  return [first, middle, last]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .join(" ");
}

function customerNameMatchesRecord(c, targetNameNorm) {
  const byName = normalizeFullName(c.name);
  const byParts = normalizeFullName(
    [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ")
  );
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
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [street, setStreet] = useState("");
  const [barangay, setBarangay] = useState("");
  const [city, setCity] = useState("");

  const [psgcCities, setPsgcCities] = useState([]);
  const [psgcCitiesLoading, setPsgcCitiesLoading] = useState(false);
  const [psgcCitiesError, setPsgcCitiesError] = useState('');
  const [selectedCityCode, setSelectedCityCode] = useState('');

  const [psgcBarangays, setPsgcBarangays] = useState([]);
  const [psgcBarangaysLoading, setPsgcBarangaysLoading] = useState(false);
  const [psgcBarangaysError, setPsgcBarangaysError] = useState('');
  const [selectedBarangayCode, setSelectedBarangayCode] = useState('');

  useEffect(() => {
    if (isOpen) {
      // If initial data exists, we pre-fill (useful for editing)
      setFirstName(initial?.firstName || "");
      setMiddleName(initial?.middleName || "");
      setLastName(initial?.lastName || "");
      setStreet(initial?.street || "");
      setBarangay(initial?.barangay || "");
      setCity(initial?.city || "");
    }
  }, [isOpen, initial]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    (async () => {
      setPsgcCitiesLoading(true);
      setPsgcCitiesError('');
      try {
        const rows = await loadPsgcCities();
        if (!cancelled) setPsgcCities(rows);
      } catch {
        if (!cancelled) {
          setPsgcCities([]);
          setPsgcCitiesError('City list is unavailable right now. You may type manually.');
        }
      } finally {
        if (!cancelled) setPsgcCitiesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || psgcCitiesError || psgcCities.length === 0) return;

    const match = findPsgcByName(psgcCities, city);
    if (!match) {
      setSelectedCityCode('');
      setPsgcBarangays([]);
      setSelectedBarangayCode('');
      return;
    }

    setSelectedCityCode(match.code);
    if (city !== (match.display_name || match.name)) {
      setCity(match.display_name || match.name);
    }
  }, [isOpen, city, psgcCities, psgcCitiesError]);

  useEffect(() => {
    if (!isOpen || psgcCitiesError || !selectedCityCode) {
      setPsgcBarangays([]);
      setSelectedBarangayCode('');
      setPsgcBarangaysError('');
      return;
    }

    let cancelled = false;
    (async () => {
      setPsgcBarangaysLoading(true);
      setPsgcBarangaysError('');
      try {
        const rows = await loadPsgcBarangaysByCityCode(selectedCityCode);
        if (!cancelled) setPsgcBarangays(rows);
      } catch {
        if (!cancelled) {
          setPsgcBarangays([]);
          setSelectedBarangayCode('');
          setPsgcBarangaysError('Barangay list is unavailable right now. You may type manually.');
        }
      } finally {
        if (!cancelled) setPsgcBarangaysLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, psgcCitiesError, selectedCityCode]);

  useEffect(() => {
    if (
      !isOpen ||
      psgcCitiesError ||
      psgcBarangaysError ||
      !selectedCityCode ||
      psgcBarangays.length === 0
    ) {
      if (!selectedCityCode) setSelectedBarangayCode('');
      return;
    }

    const match = findPsgcByName(psgcBarangays, barangay);
    if (!match) {
      setSelectedBarangayCode('');
      return;
    }

    setSelectedBarangayCode(match.code);
    if (barangay !== match.name) {
      setBarangay(match.name);
    }
  }, [
    isOpen,
    barangay,
    psgcBarangays,
    psgcBarangaysError,
    psgcCitiesError,
    selectedCityCode,
  ]);

  if (!isOpen) return null;

  const allowManualCity = Boolean(psgcCitiesError);
  const allowManualBarangay =
    allowManualCity ||
    (selectedCityCode && (psgcBarangaysError || (!psgcBarangaysLoading && psgcBarangays.length === 0)));

  const handleCitySelectChange = (e) => {
    const nextCode = e.target.value;
    setSelectedCityCode(nextCode);

    if (!nextCode) {
      setCity('');
      setBarangay('');
      setSelectedBarangayCode('');
      setPsgcBarangays([]);
      setPsgcBarangaysError('');
      return;
    }

    const picked = psgcCities.find((row) => String(row.code) === String(nextCode));
    if (picked) {
      setCity(picked.display_name || picked.name);
    }
    setBarangay('');
    setSelectedBarangayCode('');
    setPsgcBarangays([]);
    setPsgcBarangaysError('');
  };

  const handleBarangaySelectChange = (e) => {
    const nextCode = e.target.value;
    setSelectedBarangayCode(nextCode);
    if (!nextCode) {
      setBarangay('');
      return;
    }
    const picked = psgcBarangays.find((row) => String(row.code) === String(nextCode));
    if (picked) {
      setBarangay(picked.name);
    }
  };

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

    if (!allowManualCity && !selectedCityCode) {
      Swal.fire({
        title: 'Select city',
        text: 'Please select a city from the PSGC dropdown.',
        icon: 'warning',
        width: 420,
      });
      return;
    }

    if (!allowManualBarangay && selectedCityCode && !selectedBarangayCode) {
      Swal.fire({
        title: 'Select barangay',
        text: 'Please select a barangay from the PSGC dropdown.',
        icon: 'warning',
        width: 420,
      });
      return;
    }

    const fullName = buildFullName(firstName, middleName, lastName);
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
      middleName,
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
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div className="modal-input-group" style={{ flex: '1 1 140px' }}>
              <label className="modal-label">First Name</label>
              <input
                type="text"
                className="modal-kilos-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
              />
            </div>
            <div className="modal-input-group" style={{ flex: '1 1 140px' }}>
              <label className="modal-label">Middle Name <span style={{ fontWeight: 400, color: '#64748b' }}>(optional)</span></label>
              <input
                type="text"
                className="modal-kilos-input"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="modal-input-group" style={{ flex: '1 1 140px' }}>
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
          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="modal-input-group" style={{ flex: 1 }}>
              <label className="modal-label">City</label>
              {allowManualCity ? (
                <input
                  type="text"
                  className="modal-kilos-input"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City Name"
                />
              ) : (
                <select
                  className="modal-kilos-input"
                  value={selectedCityCode}
                  onChange={handleCitySelectChange}
                  disabled={psgcCitiesLoading}
                >
                  <option value="">{psgcCitiesLoading ? 'Loading cities...' : 'Select city'}</option>
                  {psgcCities.map((row) => (
                    <option key={row.code} value={row.code}>
                      {row.display_name || row.name}
                    </option>
                  ))}
                </select>
              )}
              {psgcCitiesError && (
                <small style={{ color: '#b45309' }}>{psgcCitiesError}</small>
              )}
            </div>
            <div className="modal-input-group" style={{ flex: 1 }}>
              <label className="modal-label">Barangay</label>
              {allowManualBarangay ? (
                <input
                  type="text"
                  className="modal-kilos-input"
                  value={barangay}
                  onChange={(e) => setBarangay(e.target.value)}
                  placeholder="Brgy. 1"
                />
              ) : (
                <select
                  className="modal-kilos-input"
                  value={selectedBarangayCode}
                  onChange={handleBarangaySelectChange}
                  disabled={!selectedCityCode || psgcBarangaysLoading}
                >
                  <option value="">
                    {!selectedCityCode
                      ? 'Select city first'
                      : psgcBarangaysLoading
                        ? 'Loading barangays...'
                        : 'Select barangay'}
                  </option>
                  {psgcBarangays.map((row) => (
                    <option key={row.code} value={row.code}>
                      {row.name}
                    </option>
                  ))}
                </select>
              )}
              {psgcBarangaysError && selectedCityCode && (
                <small style={{ color: '#b45309' }}>{psgcBarangaysError}</small>
              )}
            </div>
          </div>

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


