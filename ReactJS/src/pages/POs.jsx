import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { BsSearch } from 'react-icons/bs';
import DashboardLayout from '../components/dashboardlayout';
import SmallCard from '../components/smallCard';
import SmallcardModal from '../components/smallcardModal';
import CustomerModal from '../components/customerModal';
import { useTransactions } from '../context/transactionsContext';
import { API_URL, resolvePublicFileUrl } from '../config/api';
import {
  findPsgcByName,
  loadPsgcBarangaysByCityCode,
  loadPsgcCities,
} from '../utils/psgc';
import '../styles/posstyle.css';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import { BsPencilSquare, BsTrash } from 'react-icons/bs';

/** Dispatched after branch VAT settings change (e.g. mobile app) so POS can refresh totals. */
const BRANCH_VAT_CHANGED_EVENT = 'papaj-branch-vat-changed';

/** Split full name into first, optional middle, last (last token = surname). */
function splitFullName(fullName) {
  const t = String(fullName || '').trim();
  if (!t) return { first: '', middle: '', last: '' };
  const parts = t.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], middle: '', last: '' };
  if (parts.length === 2) return { first: parts[0], middle: '', last: parts[1] };
  return {
    first: parts[0],
    middle: parts.slice(1, -1).join(' '),
    last: parts[parts.length - 1],
  };
}

function buildFullName(first, middle, last) {
  return [first, middle, last]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(' ');
}

/** Normalize for comparing first/last name (case-insensitive, trim, collapse spaces). */
function normalizePersonNamePart(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function transactionOutstandingBalance(t) {
  if (t.archived) return 0;
  if (String(t.payment_status || '').toLowerCase() === 'paid') return 0;
  const amt = Number(t.amount) || 0;
  const paid = Number(t.paid_amount) || 0;
  return Math.max(0, amt - paid);
}

function transactionNameFirstLastForMatch(t) {
  const cf = t.customer_first_name;
  const cl = t.customer_last_name;
  if (
    cf != null &&
    String(cf).trim() !== '' &&
    cl != null &&
    String(cl).trim() !== ''
  ) {
    return {
      first: normalizePersonNamePart(cf),
      last: normalizePersonNamePart(cl),
    };
  }
  const sp = splitFullName(t.customer_name);
  return {
    first: normalizePersonNamePart(sp.first),
    last: normalizePersonNamePart(sp.last),
  };
}

/**
 * Block new POS orders if the same customer (first + last name) already has an unpaid balance at this branch.
 */
function findBlockingUnpaidTransaction(transactionsList, firstName, lastName, branchId) {
  const nf = normalizePersonNamePart(firstName);
  const nl = normalizePersonNamePart(lastName);
  if (!nf || !nl) return null;
  if (branchId == null || branchId === '') return null;

  for (const t of transactionsList || []) {
    if (t.archived) continue;
    if (transactionOutstandingBalance(t) <= 0.005) continue;
    if (String(t.branch_id ?? '') !== String(branchId)) continue;

    const { first, last } = transactionNameFirstLastForMatch(t);
    if (first === nf && last === nl) {
      return t;
    }
  }
  return null;
}

/** Split POS address string "street, barangay, city" */
function splitAddressLine(address) {
  const raw = String(address || '').trim();
  if (!raw) return { street: '', barangay: '', city: '' };
  const parts = raw.split(',').map((p) => p.trim());
  return {
    street: parts[0] || '',
    barangay: parts[1] || '',
    city: parts[2] || '',
  };
}

function normalizeAddressKey(street, barangay, city) {
  return [street, barangay, city]
    .map((x) => String(x || '').trim().toLowerCase().replace(/\s+/g, ' '))
    .join('|');
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
  return '';
}

function addressDisplayFromApiCustomer(c) {
  if (c.street || c.barangay || c.city) {
    return [c.street, c.barangay, c.city].filter(Boolean).join(', ');
  }
  return String(c.address || '').trim();
}

function transactionCustomerMatches(query, transactions) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const list = (transactions || []).filter(
    (t) => !t.archived && String(t.customer_name || '').toLowerCase().includes(q)
  );
  list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  const seen = new Set();
  const out = [];
  for (const t of list) {
    const name = String(t.customer_name || '').trim();
    if (!name) continue;
    const addrKey = addressKeyFromTransaction(t);
    const dedupeKey = `${name.toLowerCase()}::${addrKey}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const addressLine = String(t.customer_address || '').trim();
    out.push({
      displayName: name,
      addressLine,
      customer_name: t.customer_name,
      customer_address: t.customer_address,
    });
    if (out.length >= 20) break;
  }
  return out;
}

async function fetchCustomersFromApi(query, branchIdForOwner) {
  const token = localStorage.getItem('token');
  if (!token) return [];
  let url = `${API_URL}/customers/search/${encodeURIComponent(query)}`;
  if (branchIdForOwner != null && branchIdForOwner !== '') {
    url += `?branch_id=${encodeURIComponent(branchIdForOwner)}`;
  }
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function getUserFromStorage() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const DEFAULT_SERVICE_ICONS = {
  'regular clothes': '/pictures/clean-clothes.png',
  'white clothes': '/pictures/pants.png',
  'blankets/bed sheet': '/pictures/blanket.png',
  'curtains/big towels': '/pictures/curtain.png',
  comforters: '/pictures/towel.png',
  drying: '/pictures/male-clothes.png',
};

const RUSH_FEE = 100;

function readStoredVatEnabled() {
  return true;
}

function readStoredVatRate() {
  return 12;
}

function isRushExtraName(name) {
  const raw = String(name || '').trim().toLowerCase();
  return raw.includes('rush') || raw.includes('express');
}

function todayInputDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseChargeTypeFromDescription(raw) {
  const text = String(raw || '').trim();
  const m = text.match(/^\[(?:charge_)?type:(fixed|incremental)\]\s*/i);
  if (!m) return { type: 'fixed', description: text };
  return {
    type: m[1].toLowerCase() === 'incremental' ? 'incremental' : 'fixed',
    description: text.replace(m[0], '').trim(),
  };
}

function withImageVersion(url, version) {
  if (!url) return null;
  const v = encodeURIComponent(String(version ?? ''));
  if (!v) return url;
  return url.includes('?') ? `${url}&v=${v}` : `${url}?v=${v}`;
}

function openAndAutoPrintPdf(doc) {
  if (!doc) return;

  try {
    if (typeof doc.autoPrint === 'function') {
      doc.autoPrint();
    }
  } catch {
    // continue with manual print trigger fallback
  }

  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);

  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.setAttribute('aria-hidden', 'true');

  let loaded = false;
  let printed = false;

  const printFromFrame = () => {
    if (printed) return;
    printed = true;
    try {
      const target = frame.contentWindow;
      target?.focus();
      target?.print();
    } catch {
      // ignore print errors; fallback is handled below
    }
  };

  const cleanup = () => {
    setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        // ignore
      }
      if (frame.parentNode) {
        frame.parentNode.removeChild(frame);
      }
    }, 4000);
  };

  frame.onload = () => {
    loaded = true;
    setTimeout(printFromFrame, 220);
    setTimeout(cleanup, 5000);
  };

  document.body.appendChild(frame);
  frame.src = blobUrl;

  // If embedded PDF never loads in the hidden iframe, fallback to a visible tab.
  setTimeout(() => {
    if (loaded || printed) return;
    const popup = window.open(blobUrl, '_blank');
    if (!popup) {
      Swal.fire({
        title: 'Print preview blocked',
        text: 'Please allow popups, then try printing again.',
        icon: 'info',
        width: 420,
      });
    }
    cleanup();
  }, 2600);
}

const POs = () => {
  const { createTransaction, transactions, fetchTransactions } = useTransactions();

  const [sessionUser, setSessionUser] = useState(() => getUserFromStorage());
  const [branches, setBranches] = useState([]);
  const [ownerBranchId, setOwnerBranchId] = useState(null);
  const [laundryItems, setLaundryItems] = useState([]);
  /** True until API returns (no hardcoded placeholder cards on refresh). */
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesRefreshNonce, setServicesRefreshNonce] = useState(0);

  // --- States ---
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null); // Tracks if we are editing an item

  const [activeExtras, setActiveExtras] = useState({ discount: false, express: false });
  const [discountAmount, setDiscountAmount] = useState(0);
  const [dynamicExtras, setDynamicExtras] = useState([]);
  const [selectedDynamicExtras, setSelectedDynamicExtras] = useState({});
  
  // Customer States
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [street, setStreet] = useState('');
  const [barangay, setBarangay] = useState('');
  const [city, setCity] = useState('');
  const [psgcCities, setPsgcCities] = useState([]);
  const [psgcCitiesLoading, setPsgcCitiesLoading] = useState(false);
  const [psgcCitiesError, setPsgcCitiesError] = useState('');
  const [selectedCityCode, setSelectedCityCode] = useState('');

  const [psgcBarangays, setPsgcBarangays] = useState([]);
  const [psgcBarangaysLoading, setPsgcBarangaysLoading] = useState(false);
  const [psgcBarangaysError, setPsgcBarangaysError] = useState('');
  const [selectedBarangayCode, setSelectedBarangayCode] = useState('');
  /** When true, resolve barangay text to PSGC code once (e.g. after loading a saved customer). */
  const [shouldMatchBarangayFromText, setShouldMatchBarangayFromText] = useState(false);

  const [dueDate, setDueDate] = useState('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [lastSavedReceipt, setLastSavedReceipt] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('later');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pastSearches, setPastSearches] = useState([]);

  const [vatEnabled, setVatEnabled] = useState(readStoredVatEnabled);
  const [vatRatePercent, setVatRatePercent] = useState(() => String(readStoredVatRate()));

  const [customerSearchInput, setCustomerSearchInput] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const searchWrapRef = useRef(null);
  const todayDate = useMemo(() => todayInputDate(), []);

  useEffect(() => {
    setPastSearches(JSON.parse(localStorage.getItem('pastSearches') || '[]'));
  }, []);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (psgcCitiesError || psgcCities.length === 0) return;

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
  }, [city, psgcCities, psgcCitiesError]);

  useEffect(() => {
    if (psgcCitiesError || !selectedCityCode) {
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
  }, [psgcCitiesError, selectedCityCode]);

  useEffect(() => {
    if (!shouldMatchBarangayFromText) return;
    if (!String(barangay || '').trim()) {
      setShouldMatchBarangayFromText(false);
      return;
    }
    if (psgcCitiesError || psgcBarangaysError) {
      setShouldMatchBarangayFromText(false);
      return;
    }
    if (!selectedCityCode) {
      if (!psgcCitiesLoading && psgcCities.length > 0) {
        setSelectedBarangayCode('');
        setShouldMatchBarangayFromText(false);
      }
      return;
    }
    if (psgcBarangaysLoading) return;
    if (psgcBarangays.length === 0) {
      setSelectedBarangayCode('');
      setShouldMatchBarangayFromText(false);
      return;
    }
    const match = findPsgcByName(psgcBarangays, barangay);
    if (!match) {
      setSelectedBarangayCode('');
    } else {
      setSelectedBarangayCode(match.code);
      if (barangay !== match.name) setBarangay(match.name);
    }
    setShouldMatchBarangayFromText(false);
  }, [
    shouldMatchBarangayFromText,
    barangay,
    psgcBarangays,
    psgcBarangaysLoading,
    psgcBarangaysError,
    psgcCitiesError,
    psgcCities,
    psgcCitiesLoading,
    selectedCityCode,
  ]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setDynamicExtras([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/service-prices`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const miscRows = data
          .filter((s) => String(s?.category || '').toLowerCase() === 'misc')
          .map((s) => {
            const t0 = Array.isArray(s?.tiers) ? s.tiers[0] : null;
            const parsed = parseChargeTypeFromDescription(String(t0?.description || ''));
            return {
              id: Number(s.id),
              name: String(s?.name || '').trim(),
              price: Number(t0?.price || 0),
              description: parsed.description,
              type: parsed.type,
            };
          })
          .filter((row) => row.name && !isRushExtraName(row.name));
        if (!cancelled) setDynamicExtras(miscRows);
      } catch {
        if (!cancelled) setDynamicExtras([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !sessionUser) return;
    let cancelled = false;

    const applyVatFromBranchList = (data, userObj, ownerBid) => {
      let bid = null;
      if (userObj.role === 'owner') {
        const stored = localStorage.getItem('ownerSelectedBranchId');
        const pick =
          ownerBid ??
          (stored && data.some((b) => String(b.id) === String(stored))
            ? Number(stored)
            : null);
        bid = Number.isFinite(Number(pick)) ? Number(pick) : null;
      } else {
        bid = Number(userObj.branch_id ?? userObj.branch?.id) || null;
      }
      if (!bid) return;
      const br = data.find((b) => Number(b.id) === bid);
      if (!br) return;
      const ve = br.vat_enabled !== false && br.vat_enabled !== 0;
      const vr = br.vat_rate != null && br.vat_rate !== '' ? Number(br.vat_rate) : 12;
      setVatEnabled(ve);
      setVatRatePercent(String(Number.isFinite(vr) ? vr : 12));
    };

    (async () => {
      const res = await fetch(`${API_URL}/branches`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0 || cancelled) return;

      if (sessionUser.role === 'owner') {
        setBranches(data);
        const stored = localStorage.getItem('ownerSelectedBranchId');
        const pick =
          stored && data.some((b) => String(b.id) === String(stored))
            ? Number(stored)
            : null;
        setOwnerBranchId(pick);
        if (pick != null) {
          localStorage.setItem('ownerSelectedBranchId', String(pick));
          applyVatFromBranchList(data, sessionUser, pick);
        } else {
          localStorage.removeItem('ownerSelectedBranchId');
          setVatEnabled(readStoredVatEnabled());
          setVatRatePercent(String(readStoredVatRate()));
        }
        return;
      }

      if (!sessionUser.branch?.id) {
        const first = data[0];
        if (first) {
          const merged = { ...sessionUser, branch: first };
          if (!cancelled) {
            setSessionUser(merged);
            localStorage.setItem('user', JSON.stringify(merged));
          }
          applyVatFromBranchList(data, merged, null);
          return;
        }
      }

      applyVatFromBranchList(data, sessionUser, null);
    })();

    const onVatChanged = () => {
      if (cancelled) return;
      const u = getUserFromStorage() || sessionUser;
      fetch(`${API_URL}/branches`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!Array.isArray(data) || cancelled) return;
          const ownerBid =
            u?.role === 'owner'
              ? Number(localStorage.getItem('ownerSelectedBranchId')) || ownerBranchId
              : null;
          applyVatFromBranchList(data, u, ownerBid);
        })
        .catch(() => {});
    };
    window.addEventListener(BRANCH_VAT_CHANGED_EVENT, onVatChanged);

    return () => {
      cancelled = true;
      window.removeEventListener(BRANCH_VAT_CHANGED_EVENT, onVatChanged);
    };
  }, [sessionUser, ownerBranchId]);

  useEffect(() => {
    const triggerRefresh = () => setServicesRefreshNonce((n) => n + 1);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        triggerRefresh();
      }
    };

    window.addEventListener('focus', triggerRefresh);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('focus', triggerRefresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setServicesLoading(false);
      setLaundryItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setServicesLoading(true);
      try {
        const res = await fetch(`${API_URL}/service-prices`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) {
          if (!cancelled) setLaundryItems([]);
          return;
        }
        const data = await res.json();
        if (!Array.isArray(data)) {
          if (!cancelled) setLaundryItems([]);
          return;
        }
        const mapped = data
          .filter((s) => String(s?.category || '').toLowerCase() !== 'misc')
          .map((s) => {
            const name = String(s?.name || '').trim();
            const key = name.toLowerCase();
            const tiers = Array.isArray(s?.tiers)
              ? s.tiers.map((t) => ({
                  weight: String(t?.range || ''),
                  price: Number(t?.price || 0),
                  description: String(t?.description || ''),
                }))
              : [];
            return {
              id: Number(s.id),
              icon:
                withImageVersion(
                  resolvePublicFileUrl(s.image_url),
                  s.updated_at ?? s.effective_date ?? s.id
                ) ||
                DEFAULT_SERVICE_ICONS[key] ||
                '/pictures/clean-clothes.png',
              name,
              pricing: tiers,
            };
          });
        if (!cancelled) setLaundryItems(mapped);
      } catch {
        if (!cancelled) setLaundryItems([]);
      } finally {
        if (!cancelled) setServicesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [servicesRefreshNonce]);

  const mergeCustomerSources = useCallback((apiRows, txRows) => {
    const map = new Map();
    for (const c of apiRows) {
      const name = String(c.name || '').trim();
      if (!name) continue;
      const addrKey = addressKeyFromApiCustomer(c);
      const k = `${name.toLowerCase()}::${addrKey}`;
      const addressLine = addressDisplayFromApiCustomer(c);
      map.set(k, {
        kind: 'api',
        displayName: name,
        addressLine,
        suggestionKey: k,
        record: c,
      });
    }
    for (const t of txRows) {
      const name = String(t.displayName || '').trim();
      if (!name) continue;
      const addrKey = addressKeyFromTransaction(t);
      const k = `${name.toLowerCase()}::${addrKey}`;
      if (map.has(k)) continue;
      map.set(k, {
        kind: 'tx',
        displayName: name,
        addressLine: t.addressLine || '',
        suggestionKey: k,
        record: t,
      });
    }
    return Array.from(map.values());
  }, []);

  const applyCustomerSuggestion = useCallback((item) => {
    let nextBarangay = '';
    if (item.kind === 'api') {
      const c = item.record;
      const fromName = splitFullName(c.name);
      setFirstName(String(c.first_name || fromName.first || '').trim());
      setMiddleName(String(c.middle_name || fromName.middle || '').trim());
      setLastName(String(c.last_name || fromName.last || '').trim());
      const hasParts = c.street || c.barangay || c.city;
      if (hasParts) {
        setStreet(c.street || '');
        setBarangay(c.barangay || '');
        setCity(c.city || '');
        nextBarangay = String(c.barangay || '').trim();
      } else if (c.address) {
        const p = splitAddressLine(c.address);
        setStreet(p.street);
        setBarangay(p.barangay);
        setCity(p.city);
        nextBarangay = String(p.barangay || '').trim();
      } else {
        setStreet('');
        setBarangay('');
        setCity('');
      }
    } else {
      const t = item.record;
      const nm = splitFullName(t.customer_name);
      setFirstName(nm.first);
      setMiddleName(String(t.customer_middle_name || nm.middle || '').trim());
      setLastName(nm.last);
      const p = splitAddressLine(t.customer_address);
      setStreet(p.street);
      setBarangay(p.barangay);
      setCity(p.city);
      nextBarangay = String(p.barangay || '').trim();
    }
    setShouldMatchBarangayFromText(Boolean(nextBarangay));
    setCustomerSearchInput(item.displayName);
    setCustomerSuggestions([]);
    setSuggestionOpen(false);
    const val = item.displayName.trim();
    if (val) {
      setPastSearches((prev) => {
        if (prev.includes(val)) return prev;
        const next = [val, ...prev].slice(0, 10);
        localStorage.setItem('pastSearches', JSON.stringify(next));
        return next;
      });
    }
  }, []);

  useEffect(() => {
    const q = customerSearchInput.trim();
    if (q.length < 2) {
      setCustomerSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSuggestionLoading(true);
      setCustomerSuggestions([]);
      try {
        const branchForSearch =
          sessionUser?.role === 'owner' ? ownerBranchId : undefined;
        const [apiRows, txRows] = await Promise.all([
          fetchCustomersFromApi(q, branchForSearch),
          Promise.resolve(transactionCustomerMatches(q, transactions)),
        ]);
        if (cancelled) return;
        setCustomerSuggestions(mergeCustomerSources(apiRows, txRows));
      } finally {
        if (!cancelled) setSuggestionLoading(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customerSearchInput, transactions, mergeCustomerSources, sessionUser, ownerBranchId]);

  useEffect(() => {
    const onDoc = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setSuggestionOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (paymentStatus === 'full') setPaymentMethod('Cash');
    else setPaymentMethod('');
  }, [paymentStatus]);

  useEffect(() => {
    const shouldRush = dueDate === todayDate;
    setActiveExtras((prev) => {
      if (prev.express === shouldRush) return prev;
      return { ...prev, express: shouldRush };
    });
  }, [dueDate, todayDate]);

  // --- Handlers ---

  const handleCustomerSearchKeyDown = (e) => {
    if (e.key === 'Enter' && customerSuggestions.length > 0) {
      e.preventDefault();
      applyCustomerSuggestion(customerSuggestions[0]);
    }
  };

  const handleCitySelectChange = (e) => {
    const nextCode = e.target.value;
    setSelectedCityCode(nextCode);
    setShouldMatchBarangayFromText(false);

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
    setShouldMatchBarangayFromText(false);
    if (!nextCode) {
      setBarangay('');
      return;
    }
    const picked = psgcBarangays.find((row) => String(row.code) === String(nextCode));
    if (picked) {
      setBarangay(picked.name);
    }
  };

  const handleOwnerBranchChange = (e) => {
    const v = e.target.value;
    if (!v) {
      setOwnerBranchId(null);
      localStorage.removeItem('ownerSelectedBranchId');
      setVatEnabled(readStoredVatEnabled());
      setVatRatePercent(String(readStoredVatRate()));
      return;
    }
    const id = Number(v);
    if (!Number.isFinite(id)) return;
    setOwnerBranchId(id);
    localStorage.setItem('ownerSelectedBranchId', String(id));
    const br = branches.find((b) => Number(b.id) === id);
    if (br) {
      const ve = br.vat_enabled !== false && br.vat_enabled !== 0;
      const vr = br.vat_rate != null && br.vat_rate !== '' ? Number(br.vat_rate) : 12;
      setVatEnabled(ve);
      setVatRatePercent(String(Number.isFinite(vr) ? vr : 12));
    }
  };

  const handleAddServiceFromModal = (laundryItem, selectedTier, kilos, laundryType, extra, notes, pieceCountOptional) => {
    const serviceData = {
      serviceName: laundryItem.name,
      rate: extra.computedTotal,
      kilos: kilos || 1,
      laundryType: laundryType === 'dry-only' ? 'Dry Only' : 'Wash and Fold',
      total: extra.computedTotal,
      unit: extra.unit,
      label: extra.label,
      notes: notes || '',
      piece_count:
        pieceCountOptional != null &&
        Number.isFinite(Number(pieceCountOptional)) &&
        Number(pieceCountOptional) > 0
          ? Math.floor(Number(pieceCountOptional))
          : null,
    };

    if (editingServiceId) {
      // UPDATE existing item
      setSelectedServices(prev => prev.map(svc => 
        svc.id === editingServiceId ? { ...svc, ...serviceData } : svc
      ));
      setEditingServiceId(null);
    } else {
      // ADD new item
      setSelectedServices(prev => [
        ...prev,
        { id: `${laundryItem.id}-${Date.now()}`, sourceServiceId: laundryItem.id, ...serviceData },
      ]);
    }
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  const handleEditService = (service) => {
    const originalItem =
      laundryItems.find(item => item.id === service.sourceServiceId) ||
      laundryItems.find(item => item.name === service.serviceName);
    setSelectedItem({
      ...originalItem,
      initialKilos: service.kilos,
      initialType: service.laundryType === 'Dry Only' ? 'dry-only' : 'wash-fold',
      initialNotes: service.notes,
      initialPieceCount: service.piece_count,
    });
    setEditingServiceId(service.id);
    setIsModalOpen(true);
  };

  const handleCardClick = (item) => {
    setEditingServiceId(null); // Ensure we aren't in edit mode
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
    setEditingServiceId(null);
  };

  const removeService = (id) => {
    setSelectedServices(prev => prev.filter(svc => svc.id !== id));
  };

  // --- Calculations ---
  const subtotal = useMemo(() => selectedServices.reduce((sum, s) => sum + (s.total || 0), 0), [selectedServices]);
  const totalWeight = useMemo(() => selectedServices.reduce((sum, s) => sum + Number(s.kilos || 0), 0), [selectedServices]);

  const dynamicExtrasTotal = useMemo(
    () =>
      dynamicExtras.reduce((sum, extra) => {
        const qty = Number(selectedDynamicExtras[extra.id] || 0);
        return sum + qty * Number(extra.price || 0);
      }, 0),
    [dynamicExtras, selectedDynamicExtras]
  );

  const extrasTotal = useMemo(() => {
    let total = dynamicExtrasTotal;
    if (activeExtras.express) total += RUSH_FEE;
    if (activeExtras.discount) total -= Number(discountAmount || 0);
    return total;
  }, [dynamicExtrasTotal, activeExtras.express, activeExtras.discount, discountAmount]);

  const preTaxTotal = useMemo(() => subtotal + extrasTotal, [subtotal, extrasTotal]);

  const vatRateNum = useMemo(() => {
    const n = parseFloat(vatRatePercent);
    if (!Number.isFinite(n) || String(vatRatePercent).trim() === '') return 12;
    return Math.min(100, Math.max(0, n));
  }, [vatRatePercent]);

  const vatAmount = useMemo(() => {
    if (!vatEnabled) return 0;
    return Math.round(preTaxTotal * (vatRateNum / 100) * 100) / 100;
  }, [vatEnabled, preTaxTotal, vatRateNum]);

  const totalPayment = useMemo(() => preTaxTotal + vatAmount, [preTaxTotal, vatAmount]);

  const amountPaidNum = Number(amountPaid) || 0;
  const changeDue =
    paymentStatus === 'full' ? Math.max(0, Math.round((amountPaidNum - totalPayment) * 100) / 100) : 0;

  const resetForm = () => {
    setSelectedServices([]);
    setFirstName(''); setMiddleName(''); setLastName(''); setStreet(''); setBarangay(''); setCity('');
    setSelectedCityCode('');
    setSelectedBarangayCode('');
    setPsgcBarangays([]);
    setPsgcBarangaysError('');
    setCustomerSearchInput('');
    setCustomerSuggestions([]);
    setSuggestionOpen(false);
    setDueDate('');
    setActiveExtras({ discount: false, express: false });
    setDiscountAmount(0);
    setPaymentStatus('later');
    setAmountPaid('');
    setSelectedDynamicExtras({});
    setShouldMatchBarangayFromText(false);
  };

  const printThermalReceipt = (txn) => {
    if (!txn) return;
    
    if (txn.payment_status === 'unpaid') {
      const vatAmt = Number(txn.vat_amount) || 0;
      const discountAmt = Number(txn.discount_amount) || 0;
      const stubH = 90 + (vatAmt > 0 ? 8 : 0) + (discountAmt > 0 ? 8 : 0);
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [58, stubH] });
      let y = 8;
      const centerText = (text, yPos, size = 8) => {
        doc.setFontSize(size);
        doc.text(text, 29, yPos, { align: 'center' });
      };

      doc.setFont('courier', 'bold');
      centerText("PAPA J'S LAUNDRY SHOP", y, 10);
      y += 4;
      doc.setLineDash([1, 1]); doc.line(2, y, 56, y); doc.setLineDash([]); y += 5;
      
      centerText("CLAIM STUB", y, 10);
      y += 6;

      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.text(`RCPT#: ${txn.receipt || 'RCPT-100001'}`, 2, y); y += 4;
      doc.text(`DATE: ${new Date(txn.created_at || Date.now()).toLocaleDateString()}`, 2, y); y += 4;
      doc.text(`DUE: ${txn.due_date}`, 2, y); y += 6;
      
      doc.text(`NAME: ${txn.customer_name}`, 2, y); y += 4;
      doc.text(`QTY: ${txn.weight}kg`, 2, y); y += 6;

      if (vatAmt > 0) {
        const vr = txn.vat_rate != null && txn.vat_rate !== '' ? Number(txn.vat_rate) : null;
        doc.setFont('courier', 'normal');
        doc.text(
          `VAT${vr != null && Number.isFinite(vr) ? ` (${vr}%)` : ''}: P${vatAmt.toFixed(2)}`,
          2,
          y
        );
        y += 4;
      }

      if (discountAmt > 0) {
        doc.setFont('courier', 'normal');
        doc.text(`DISCOUNT: -P${discountAmt.toFixed(2)}`, 2, y);
        y += 4;
      }

      doc.setFont('courier', 'bold');
      doc.text(`TOTAL DUE: P${(txn.amount || 0).toFixed(2)}`, 2, y); y += 4;
      doc.text(`STATUS: ${String(txn.payment_status || 'unpaid').toUpperCase()}`, 2, y); y += 6;

      doc.setLineDash([1, 1]); doc.line(2, y, 56, y); doc.setLineDash([]); y += 5;
      
      doc.setFont('courier', 'normal');
      centerText("Present this upon payment", y, 8);

      openAndAutoPrintPdf(doc);
      return;
    }

    
    const extrasActive = txn.active_extras || {};
    const slist = txn.sub_extras || {};
    const hasRush =
      txn.is_rush === true ||
      txn.is_rush === 1 ||
      extrasActive.express ||
      (txn.extra_charge_type && txn.extra_charge_type.includes('express'));
    
    let extraHeight = 0;
    if (hasRush) extraHeight += 4;
    if (slist.extra_detergent) extraHeight += 4;
    if (slist.extra_softener) extraHeight += 4;
    if (slist.stain_removal) extraHeight += 4;
    if (txn.additional_amount > 0) extraHeight += 4;
    if (txn.discount_amount > 0) extraHeight += 4;
    if (Number(txn.vat_amount) > 0) extraHeight += 4;

    const baseHeight = 130; 
    const itemHeight = txn.services.length * 12; 
    const dynamicHeight = baseHeight + itemHeight + extraHeight;
    
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [58, dynamicHeight] });
    let y = 8;
    
    const centerText = (text, yPos, size = 8) => {
      doc.setFontSize(size);
      doc.text(text, 29, yPos, { align: 'center' });
    };

    // Header
    doc.setFont('courier', 'bold');
    centerText("PAPA J'S LAUNDRY SHOP", y, 10);
    y += 4;
  
    
    y += 6;
    doc.setLineDash([1, 1]);
    doc.line(2, y, 56, y);
    doc.setLineDash([]);
    
    y += 5;
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.text(`RCPT NO : ${txn.receipt || 'RCPT-100001'}`, 2, y);
    y += 4;
    doc.setFont('courier', 'normal');
    doc.text(`DATE    : ${new Date().toLocaleDateString()}`, 2, y);
    y += 4;
    doc.text(`DUE DATE: ${txn.due_date}`, 2, y);
    
    y += 4;
    doc.text(`NAME    : ${txn.customer_name}`, 2, y);
    y += 4;
    
    const splitAddress = doc.splitTextToSize(`ADDRESS : ${txn.customer_address}`, 54);
    doc.text(splitAddress, 2, y);
    y += (splitAddress.length * 4);

    y += 2;
    doc.setLineDash([1, 1]);
    doc.line(2, y, 56, y);
    doc.setLineDash([]);
    y += 5;

    // Items
    doc.setFont('courier', 'bold');
    doc.text("QTY/KG", 2, y);
    doc.text("ITEM", 16, y);
    doc.text("TOTAL", 56, y, { align: 'right' });
    y += 2;
    doc.line(2, y, 56, y);
    doc.setLineDash([]);
    y += 4;

    doc.setFont('courier', 'normal');
    let computedSubtotal = 0;
    txn.services.forEach(svc => {
      doc.setFontSize(8);
      doc.text(`${svc.kilos}kg`, 2, y);
      
      const itemName = doc.splitTextToSize(`${svc.serviceName}`, 28);
      doc.text(itemName, 16, y);
      
      doc.text(`P${svc.rate.toFixed(2)}`, 56, y, { align: 'right' });
      computedSubtotal += svc.rate;
      y += (itemName.length * 4);
      
      if (svc.notes) {
        doc.setFontSize(7);
        const notes = doc.splitTextToSize(`Note: ${svc.notes}`, 40);
        doc.text(notes, 16, y);
        y += (notes.length * 3.5);
      }
    });

    y += 2;
    doc.setLineDash([1, 1]);
    doc.line(2, y, 56, y);
    doc.setLineDash([]);
    y += 5;

    // Totals and Extras
    doc.setFontSize(8);
    doc.text("Subtotal:", 2, y);
    doc.text(`P${computedSubtotal.toFixed(2)}`, 56, y, { align: 'right' });
    y += 4;

    if (hasRush) {
      doc.text("Rush Charge:", 2, y);
      doc.text("P100.00", 56, y, { align: 'right' });
      y += 4;
    }

    if (slist.extra_detergent > 0) {
      doc.text(`Extra Detergent (x${slist.extra_detergent}):`, 2, y);
      doc.text(`P${(20 * slist.extra_detergent).toFixed(2)}`, 56, y, { align: 'right' });
      y += 4;
    } else if (slist.extra_detergent === true) {
      doc.text("Extra Detergent:", 2, y);
      doc.text("P20.00", 56, y, { align: 'right' });
      y += 4;
    }

    if (slist.extra_softener > 0) {
      doc.text(`Extra Softener (x${slist.extra_softener}):`, 2, y);
      doc.text(`P${(20 * slist.extra_softener).toFixed(2)}`, 56, y, { align: 'right' });
      y += 4;
    } else if (slist.extra_softener === true) {
      doc.text("Extra Softener:", 2, y);
      doc.text("P20.00", 56, y, { align: 'right' });
      y += 4;
    }

    if (slist.stain_removal) {
      doc.text("Stain Removal:", 2, y);
      doc.text("P50.00", 56, y, { align: 'right' });
      y += 4;
    }

    if (txn.additional_amount > 0) {
      doc.text("Other Additional:", 2, y);
      doc.text(`P${txn.additional_amount.toFixed(2)}`, 56, y, { align: 'right' });
      y += 4;
    }

    if (txn.discount_amount > 0) {
      doc.text("Discount:", 2, y);
      doc.text(`-P${txn.discount_amount.toFixed(2)}`, 56, y, { align: 'right' });
      y += 4;
    }

    const vatAmtPaid = Number(txn.vat_amount) || 0;
    if (vatAmtPaid > 0) {
      const vr = txn.vat_rate != null && txn.vat_rate !== '' ? Number(txn.vat_rate) : 12;
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.text(`VAT (${Number.isFinite(vr) ? vr : 12}%):`, 2, y);
      doc.text(`P${vatAmtPaid.toFixed(2)}`, 56, y, { align: 'right' });
      y += 4;
    }

    y += 2;
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.text("TOTAL PAYMENT:", 2, y);
    doc.text(`P${txn.amount.toFixed(2)}`, 56, y, { align: 'right' });
    
    y += 6;
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    
    // Payment Status Information
    doc.text("PAYMENT STATUS:", 2, y);
    doc.setFont('courier', 'bold');
    doc.text(String(txn.payment_status || 'unpaid').toUpperCase(), 56, y, { align: 'right' });
    y += 4;
    
    if (txn.payment_status === 'paid') {
      doc.setFont('courier', 'normal');
      doc.text("Amount Paid:", 2, y);
      doc.text(`P${txn.paid_amount.toFixed(2)}`, 56, y, { align: 'right' });
      y += 4;
      
      const change = txn.paid_amount - txn.amount;
      if (change > 0) {
        doc.text("Change:", 2, y);
        doc.text(`P${change.toFixed(2)}`, 56, y, { align: 'right' });
        y += 4;
      }
    } else {
      doc.setFont('courier', 'bold');
      doc.text("BALANCE DUE:", 2, y);
      doc.text(`P${txn.amount.toFixed(2)}`, 56, y, { align: 'right' });
      y += 4;
    }

    y += 4;
    doc.setLineDash([1, 1]);
    doc.line(2, y, 56, y);
    doc.setLineDash([]);
    y += 6;

    // Footer
    centerText("Thank you for choosing", y, 7);
    y += 4;
    centerText("Papa J's Laundry Shop!", y, 7);
    y += 6;
    
    doc.setFont('courier', 'italic');
    doc.setFontSize(6);
    centerText("This is not an official receipt.", y, 6);

    openAndAutoPrintPdf(doc);
  };

  const selectedDynamicExtraNames = useMemo(
    () =>
      dynamicExtras
        .filter((extra) => Number(selectedDynamicExtras[extra.id] || 0) > 0)
        .map((extra) => extra.name),
    [dynamicExtras, selectedDynamicExtras]
  );

  const handleCompleteTransaction = async () => {
    setSaveError('');
    if (!firstName.trim() || !lastName.trim() || !street.trim() || !barangay.trim() || !city.trim()) {
      Swal.fire({ title: "Missing Information", text: "Please complete all customer details.", icon: "warning", width: 350 });
      return;
    }

    if (!allowManualCity && !selectedCityCode) {
      Swal.fire({
        title: 'Select city',
        text: 'Please select a city from the PSGC dropdown.',
        icon: 'warning',
        width: 380,
      });
      return;
    }

    if (selectedCityCode && !allowManualBarangay && !selectedBarangayCode) {
      Swal.fire({
        title: 'Select barangay',
        text: 'Please select a barangay from the PSGC dropdown.',
        icon: 'warning',
        width: 380,
      });
      return;
    }

    if (!dueDate) {
      Swal.fire({ title: "Missing Information", text: "Due date is required.", icon: "warning", width: 350 });
      return;
    }
    if (dueDate < todayDate) {
      Swal.fire({
        title: 'Invalid due date',
        text: 'Past dates are not allowed for due date.',
        icon: 'warning',
        width: 360,
      });
      return;
    }
    if (selectedServices.length === 0) {
      Swal.fire({ title: "Missing Information", text: "Add at least one laundry service.", icon: "warning", width: 350 });
      return;
    }

    const fullName = buildFullName(firstName, middleName, lastName);
    const fullAddress = `${street.trim()}, ${barangay.trim()}, ${city.trim()}`;
    const normalizedExtras = {
      ...activeExtras,
      express: dueDate === todayDate || activeExtras.express,
    };

    try {
      setIsSaving(true);
      if (sessionUser?.role === 'owner' && (ownerBranchId == null || Number.isNaN(ownerBranchId))) {
        Swal.fire({
          title: 'Select branch',
          text: 'Choose which branch this sale belongs to.',
          icon: 'warning',
          width: 350,
        });
        setIsSaving(false);
        return;
      }

      const posBranchId =
        sessionUser?.role === 'owner' ? ownerBranchId : sessionUser?.branch?.id ?? null;
      const freshList = await fetchTransactions();
      const listForCheck = Array.isArray(freshList) ? freshList : transactions;
      const blocking = findBlockingUnpaidTransaction(listForCheck, firstName, lastName, posBranchId);
      if (blocking) {
        const receiptLabel = blocking.receipt || `TXN-${blocking.id}`;
        const bal = transactionOutstandingBalance(blocking);
        Swal.fire({
          title: 'Unpaid previous order',
          html: `This customer still has an unpaid balance of <strong>P${bal.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}</strong> on receipt <strong>${receiptLabel}</strong>. Please settle that transaction before creating a new one.`,
          icon: 'warning',
          width: 440,
        });
        setIsSaving(false);
        return;
      }

      const newTransaction = await createTransaction({
        customer_name: fullName,
        customer_first_name: firstName.trim(),
        customer_last_name: lastName.trim(),
        customer_middle_name: middleName.trim() || undefined,
        customer_address: fullAddress,
        services: selectedServices,
        weight: totalWeight,
        subtotal,
        extras_line: extrasTotal,
        amount: Number(totalPayment.toFixed(2)),
        vat_amount: vatAmount,
        vat_rate: vatEnabled ? vatRateNum : null,
        due_date: dueDate,
        extra_charge_type:
          [
            ...Object.keys(normalizedExtras).filter((k) => normalizedExtras[k]),
            ...selectedDynamicExtraNames,
          ].join(', ') || 'none',
        discount_amount: normalizedExtras.discount ? Number(discountAmount) : 0,
        additional_amount: dynamicExtrasTotal,
        active_extras: normalizedExtras,
        sub_extras: {},
        payment_status: paymentStatus === 'full' ? 'paid' : 'unpaid',
        payment_method: paymentMethod,
        paid_amount: Number(amountPaid) || 0,
        branch_id: sessionUser?.role === 'owner' ? ownerBranchId : undefined,
      });

      printThermalReceipt(newTransaction);
      Swal.fire({
        title: "Transaction Saved!",
        text: "Print dialog should open automatically.",
        icon: "success",
        width: 400,
      });
      resetForm();
    } catch (error) {
      Swal.fire({
        title: "Save failed",
        text: error?.message || "Unable to save transaction. Please check backend CORS/deploy status and try again.",
        icon: "error",
        width: 420
      });
    } finally {
      setIsSaving(false);
    }
  };

  const allowManualCity = Boolean(psgcCitiesError);
  const allowManualBarangay =
    allowManualCity ||
    (selectedCityCode && (psgcBarangaysError || (!psgcBarangaysLoading && psgcBarangays.length === 0)));

  return (
    <DashboardLayout>
      <div className="pos-wrapper">
        {sessionUser?.role === 'owner' && branches.length > 0 && (
          <div style={{ marginBottom: 14, maxWidth: 420 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e3a5f', marginBottom: 6 }}>
              Branch
              <select
                className="for-receipt-customerinput"
                style={{ marginTop: 6, width: '100%' }}
                value={ownerBranchId != null && !Number.isNaN(ownerBranchId) ? String(ownerBranchId) : ''}
                onChange={handleOwnerBranchChange}
              >
                <option value="">Select branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name?.trim() || `Branch ${b.id}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="pos-grid">
          {/* Service Items Section */}
          <section className="Service-item">
            <div className="Service-item-title">Service Items</div>
            <div className="content-wrapper">
              <div className="laundry-grid">
                {servicesLoading ? (
                  <div className="pos-services-loading" role="status" aria-live="polite">
                    <span className="pos-services-loading-spinner" />
                    <span className="pos-services-loading-text">Loading services…</span>
                  </div>
                ) : (
                  laundryItems.map((item) => (
                    <SmallCard key={item.id} {...item} onCardClick={() => handleCardClick(item)} />
                  ))
                )}
              </div>
            </div>
            <SmallcardModal 
              isOpen={isModalOpen} 
              onClose={handleCloseModal} 
              item={selectedItem} 
              onAdd={handleAddServiceFromModal} 
            />
          </section>

          {/* Receipt Section */}
          <section className="receipt-section">
            <div className="for-receipt-information">
              <div className="for-receipt">
                <div className="for-receipt-top">
                  <div className="for-receipt-search-wrap" ref={searchWrapRef}>
                    <div className="for-receipt-searchbar">
                      <BsSearch className="for-receipt-searchicon" />
                      <input
                        type="text"
                        placeholder="Search Names..."
                        className="for-receipt-searchinput"
                        value={customerSearchInput}
                        onChange={(e) => {
                          setCustomerSearchInput(e.target.value);
                          setSuggestionOpen(true);
                        }}
                        onFocus={() => setSuggestionOpen(true)}
                        onKeyDown={handleCustomerSearchKeyDown}
                        autoComplete="off"
                        aria-autocomplete="list"
                        aria-expanded={suggestionOpen && customerSuggestions.length > 0}
                      />
                    </div>
                    {suggestionOpen && customerSearchInput.trim().length >= 2 && (
                      <ul className="pos-customer-suggestions" role="listbox">
                        {suggestionLoading && (
                          <li style={{ padding: '10px 14px', fontSize: 13, color: '#666' }}>Searching…</li>
                        )}
                        {!suggestionLoading &&
                          customerSuggestions.map((item, idx) => (
                            <li key={item.suggestionKey || `${item.kind}-${item.displayName}-${idx}`} role="option">
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => applyCustomerSuggestion(item)}
                              >
                                <span>{item.displayName}</span>
                                <span className="pos-suggestion-meta">
                                  {item.addressLine
                                    ? `${item.addressLine} · ${item.kind === 'api' ? 'Saved' : 'Past order'}`
                                    : item.kind === 'api'
                                      ? 'Saved customer'
                                      : 'Past transaction'}
                                </span>
                              </button>
                            </li>
                          ))}
                        {!suggestionLoading && customerSuggestions.length === 0 && (
                          <li style={{ padding: '10px 14px', fontSize: 13, color: '#666' }}>
                            No matches. Try another name or use Add Customer.
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                  <button className="for-receipt-add-customer" onClick={() => setIsCustomerModalOpen(true)}>Add Customer</button>
                </div>
                
                <CustomerModal
                  isOpen={isCustomerModalOpen}
                  onClose={() => setIsCustomerModalOpen(false)}
                  initial={{ firstName, middleName, lastName, street, barangay, city }}
                  transactions={transactions}
                  onSave={(data) => {
                    setFirstName(data.firstName);
                    setMiddleName(data.middleName || '');
                    setLastName(data.lastName);
                    setStreet(data.street); setBarangay(data.barangay); setCity(data.city);
                    setShouldMatchBarangayFromText(Boolean(String(data.barangay || '').trim()));
                  }}
                />

                <div className="for-receipt-bottom">
                  <div className="for-receipt-calendar">
                    <span style={{ fontSize: 12, color: '#666' }}>Laundry to be claimed on:</span> <br />
                    <input
                      type="date"
                      className="for-receipt-date"
                      value={dueDate}
                      min={todayDate}
                      onChange={e => setDueDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Inputs */}
            <div className="for-receipt-output-customername">
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <label style={{ flex: '1 1 120px' }}>First Name:
                  <input type="text" className="for-receipt-customerinput" value={firstName} onChange={e => setFirstName(e.target.value)} />
                </label>
                <label style={{ flex: '1 1 120px' }}>Middle Name <span style={{ fontWeight: 400, color: '#64748b' }}>(optional)</span>:
                  <input type="text" className="for-receipt-customerinput" value={middleName} onChange={e => setMiddleName(e.target.value)} placeholder="Optional" />
                </label>
                <label style={{ flex: '1 1 120px' }}>Last Name:
                  <input type="text" className="for-receipt-customerinput" value={lastName} onChange={e => setLastName(e.target.value)} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <label style={{ flex: 1 }}>City:
                  {allowManualCity ? (
                    <input
                      type="text"
                      className="for-receipt-customerinput"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                    />
                  ) : (
                    <select
                      className="for-receipt-customerinput"
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
                    <small style={{ display: 'block', marginTop: 4, color: '#b45309', fontWeight: 500 }}>
                      {psgcCitiesError}
                    </small>
                  )}
                </label>
                <label style={{ flex: 1 }}>Barangay:
                  {allowManualBarangay ? (
                    <input
                      type="text"
                      className="for-receipt-customerinput"
                      value={barangay}
                      onChange={e => setBarangay(e.target.value)}
                    />
                  ) : (
                    <select
                      className="for-receipt-customerinput"
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
                    <small style={{ display: 'block', marginTop: 4, color: '#b45309', fontWeight: 500 }}>
                      {psgcBarangaysError}
                    </small>
                  )}
                </label>
              </div>
              <label style={{ marginTop: '10px' }}>Street / Drive:
                <input type="text" className="for-receipt-customerinput" value={street} onChange={e => setStreet(e.target.value)} />
              </label>
            </div>

            {/* Payment & Extras Section */}
            <div className="payment-extras-row">
              <div className="payment-box">
                <h3>Select Payment Information</h3>
                <div className="payment-options">
                  <label className="payment-option">
                    <input type="radio" checked={paymentStatus === 'full'} onChange={() => setPaymentStatus('full')} />
                    <span>Full Payment Now</span>
                  </label>
                  <label className="payment-option">
                    <input type="radio" checked={paymentStatus === 'later'} onChange={() => setPaymentStatus('later')} />
                    <span>Pay Later</span>
                  </label>
                </div>
                {paymentStatus === 'full' && (
                  <div className="payment-amount-section">
                    <label>Amount Paid</label>
                    <input type="number" className="for-receipt-customerinput" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
                  </div>
                )}
                <div className="payment-amount-section" style={{ marginTop: 10 }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                    {vatEnabled ? (
                      <>
                        VAT <strong>({vatRateNum}%)</strong> applies to this sale per{' '}
                        <strong>branch settings</strong>. VAT is configured in the{' '}
                        <strong>mobile app</strong> (Profile → VAT); it cannot be changed on this web POS.
                      </>
                    ) : (
                      <>
                        VAT is turned off for this branch. Enable it in the <strong>mobile app</strong>{' '}
                        under Profile → VAT.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="extras-box">
                <h3>Extra Charges</h3>
                <div className="payment-options">
                  <label className="payment-option">
                    <input
                      type="checkbox"
                      checked={activeExtras.express}
                      disabled={dueDate === todayDate && activeExtras.express}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setDueDate(todayDate);
                          setActiveExtras((prev) => ({ ...prev, express: true }));
                          return;
                        }
                        setActiveExtras((prev) => ({ ...prev, express: false }));
                      }}
                    />
                    <span>Rush (Express) + P{RUSH_FEE.toFixed(2)}</span>
                  </label>
                  <label className="payment-option">
                    <input 
                      type="checkbox" 
                      checked={activeExtras.discount} 
                      onChange={() => setActiveExtras(prev => ({ ...prev, discount: !prev.discount }))} 
                    />
                    <span>Discount</span>
                  </label>
                  {dueDate === todayDate && (
                    <small style={{ marginLeft: '10px', color: '#64748b', fontWeight: 500 }}>
                      Rush is automatically enabled when due date is today.
                    </small>
                  )}
                  {dynamicExtras.map((extra) => {
                    const qty = Number(selectedDynamicExtras[extra.id] || 0);
                    const isIncremental = extra.type === 'incremental';
                    return (
                      <div key={extra.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <label className="payment-option" style={{ margin: 0, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={qty > 0}
                            onChange={(e) =>
                              setSelectedDynamicExtras((prev) => ({
                                ...prev,
                                [extra.id]: e.target.checked ? Math.max(1, Number(prev[extra.id] || 0)) : 0,
                              }))
                            }
                          />
                          <span>
                            {extra.name} ({isIncremental ? 'Incremental' : 'Fixed'} · P{Number(extra.price || 0).toFixed(2)})
                          </span>
                        </label>
                        {isIncremental ? (
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedDynamicExtras((prev) => ({
                                  ...prev,
                                  [extra.id]: Math.max(0, Number(prev[extra.id] || 0) - 1),
                                }))
                              }
                              style={{ background: '#6c757d', color: '#fff', border: 'none', width: '22px', height: '22px', cursor: 'pointer', fontSize: '12px', borderRadius: '4px 0 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >-</button>
                            <input
                              type="text"
                              value={qty}
                              readOnly
                              style={{ width: '30px', height: '22px', textAlign: 'center', border: '1px solid #ccc', borderLeft: 'none', borderRight: 'none', boxSizing: 'border-box', fontSize: '12px', margin: 0, outline: 'none' }}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedDynamicExtras((prev) => ({
                                  ...prev,
                                  [extra.id]: Number(prev[extra.id] || 0) + 1,
                                }))
                              }
                              style={{ background: '#6c757d', color: '#fff', border: 'none', width: '22px', height: '22px', cursor: 'pointer', fontSize: '12px', borderRadius: '0 4px 4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >+</button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {activeExtras.discount && (
                  <div className="payment-amount-section" style={{ marginLeft: '10px', marginTop: '10px' }}>
                    <label>Amount to Discount</label>
                    <input type="number" className="for-receipt-customerinput" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Total Section */}
          <section className="total-section">
            <div className="for-receipt-totalitems">
              <div className="mini-item-row mini-item-header">
                <span className="mini-item-name">Service</span>
                <span className="mini-item-laundryType">Laundry Type</span>
                <span className="mini-item-rate">Rate</span>
                <span className="mini-item-kilos">Kilos</span>
                <span className="mini-item-notes">Notes</span>
                <span className="mini-item-actions">Actions</span>
              </div>
              {selectedServices.length === 0 && (
                <div className="pos-empty-services">No service items added yet.</div>
              )}
              {selectedServices.map(service => (
                <div key={service.id} className="mini-item-row">
                  <span className="mini-item-name">{service.serviceName}</span>
                  <span className="mini-item-laundryType">{service.laundryType}</span>
                  <span className="mini-item-rate">P{service.rate.toFixed(2)}</span>
                  <span className="mini-item-kilos">
                    {service.kilos} kg
                    {service.piece_count ? ` · ${service.piece_count} pc` : ''}
                  </span>
                  <span className="mini-item-notes" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={service.notes || ''}>{service.notes || '-'}</span>
                  <div className="mini-item-actions">
                    <button className="mini-item-edit" onClick={() => handleEditService(service)} title="Edit"><BsPencilSquare /></button>
                    <button className="mini-item-remove" onClick={() => removeService(service.id)} title="Remove"><BsTrash /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="container-information">
              <div className="for-receipt-totals">
                <div className="total-row"><span>Subtotal:</span><span>P{subtotal.toFixed(2)}</span></div>

                {activeExtras.express && (
                  <div className="total-row" style={{ color: '#555', fontSize: '13px', margin: '2px 0' }}>
                    <span>Rush (Express):</span>
                    <span>P{RUSH_FEE.toFixed(2)}</span>
                  </div>
                )}
                
                {dynamicExtras
                  .filter((extra) => Number(selectedDynamicExtras[extra.id] || 0) > 0)
                  .map((extra) => {
                    const qty = Number(selectedDynamicExtras[extra.id] || 0);
                    const isIncremental = extra.type === 'incremental';
                    return (
                      <div key={`summary-${extra.id}`} className="total-row" style={{ color: '#555', fontSize: '13px', margin: '2px 0' }}>
                        <span>{isIncremental ? `${extra.name} (x${qty})` : extra.name}:</span>
                        <span>P{(qty * Number(extra.price || 0)).toFixed(2)}</span>
                      </div>
                    );
                  })}

                {activeExtras.discount && discountAmount > 0 && (
                  <div className="total-row" style={{ color: '#e53935', fontSize: '13px', margin: '2px 0' }}><span>Discount:</span><span>-P{Number(discountAmount).toFixed(2)}</span></div>
                )}

                {vatEnabled && (
                  <>
                    <div className="total-row" style={{ color: '#555', fontSize: '13px', margin: '2px 0' }}>
                      <span>Amount (excl. VAT):</span>
                      <span>P{preTaxTotal.toFixed(2)}</span>
                    </div>
                    <div className="total-row" style={{ color: '#555', fontSize: '13px', margin: '2px 0' }}>
                      <span>VAT ({vatRateNum}%):</span>
                      <span>P{vatAmount.toFixed(2)}</span>
                    </div>
                  </>
                )}

                <div className="total-row"><span>Total Payment:</span><strong>P{totalPayment.toFixed(2)}</strong></div>

                {paymentStatus === 'full' && (
                  <>
                    <div className="total-row" style={{ marginTop: 4, fontSize: '13px' }}>
                      <span>Amount received:</span>
                      <span>P{amountPaidNum.toFixed(2)}</span>
                    </div>
                    <div className="total-row" style={{ fontSize: '13px', color: amountPaidNum < totalPayment + 0.005 ? '#b45309' : '#333' }}>
                      <span>Change:</span>
                      <span>P{changeDue.toFixed(2)}</span>
                    </div>
                    {amountPaidNum + 0.005 < totalPayment && (
                      <div style={{ fontSize: 12, color: '#b45309', marginTop: 4 }}>
                        Received amount is less than the total due.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="for-receipt-button">
              <button className="for-receipt-clear" onClick={resetForm}>Clear</button>
              <button onClick={handleCompleteTransaction} className="for-receipt-savebtn" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Complete and Save'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default POs;