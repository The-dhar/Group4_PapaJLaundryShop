import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BsPersonCircle } from 'react-icons/bs';
import Swal from 'sweetalert2';
import DashboardLayout from '../components/dashboardlayout';
import { API_URL } from '../config/api';
import { BRANCH_VAT_CHANGED_EVENT } from '../constants/branchEvents';
import '../componentstyle/profilestyle.css';

function getUserFromStorage() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function displayName(user) {
  if (!user) return '—';
  const first = String(user.first_name ?? '').trim();
  const last = String(user.last_name ?? '').trim();
  if (first || last) return [first, last].filter(Boolean).join(' ');
  const n = String(user.name ?? '').trim();
  return n || '—';
}

export default function ProfilePage() {
  const [user, setUser] = useState(() => getUserFromStorage());
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRate, setVatRate] = useState('12');

  const role = String(user?.role ?? '').toLowerCase();
  const isClerk = role === 'clerk';
  const isStaff = role === 'staff';
  const canEditVat = isClerk;

  const myBranchId = useMemo(() => {
    const id = user?.branch_id ?? user?.branch?.id;
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [user]);

  const myBranch = useMemo(() => {
    if (!myBranchId) return null;
    return branches.find((b) => Number(b.id) === myBranchId) ?? null;
  }, [branches, myBranchId]);

  const loadBranches = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const res = await fetch(`${API_URL}/branches`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data)) return;
    setBranches(data);
    const br = myBranchId ? data.find((b) => Number(b.id) === myBranchId) : data[0];
    if (br) {
      setVatEnabled(br.vat_enabled !== false && br.vat_enabled !== 0);
      const vr = br.vat_rate != null && br.vat_rate !== '' ? Number(br.vat_rate) : 12;
      setVatRate(String(Number.isFinite(vr) ? vr : 12));
    }
  }, [myBranchId]);

  useEffect(() => {
    setUser(getUserFromStorage());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadBranches();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadBranches]);

  const handleSaveVat = async () => {
    if (!canEditVat || !myBranchId) return;
    const rateNum = parseFloat(String(vatRate).replace(',', '.'));
    if (vatEnabled) {
      if (!Number.isFinite(rateNum) || rateNum < 0 || rateNum > 100) {
        await Swal.fire({ title: 'Invalid VAT rate', text: 'Enter a percentage between 0 and 100.', icon: 'warning' });
        return;
      }
    }
    const token = localStorage.getItem('token');
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/branches/${myBranchId}/vat-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vat_enabled: vatEnabled,
          vat_rate: vatEnabled ? rateNum : Number.isFinite(rateNum) ? rateNum : 12,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || 'Could not save VAT settings.');
      }
      await loadBranches();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(BRANCH_VAT_CHANGED_EVENT));
      }
      await Swal.fire({ title: 'Saved', text: 'VAT settings updated for this branch.', icon: 'success', timer: 1800, showConfirmButton: false });
    } catch (e) {
      await Swal.fire({ title: 'Save failed', text: e.message || 'Request failed.', icon: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="profile-page">
        <div className="profile-page-header">
          <h1>Profile</h1>
          <p className="profile-page-lead">Account and branch settings for {displayName(user)}.</p>
        </div>

        <div className="profile-card">
          <div className="profile-card-icon">
            <BsPersonCircle aria-hidden />
          </div>
          <h2>Account</h2>
          <dl className="profile-dl">
            <div>
              <dt>Name</dt>
              <dd>{displayName(user)}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd style={{ textTransform: 'capitalize' }}>{role || '—'}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user?.email || '—'}</dd>
            </div>
            <div>
              <dt>Branch</dt>
              <dd>{myBranch?.name || user?.branch?.name || '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="profile-card profile-card-vat">
          <h2>VAT (sales tax)</h2>
          <p className="profile-card-hint">
            Applies to POS totals for this branch. Stored on the server so all terminals use the same settings.
          </p>

          {loading ? (
            <p className="profile-muted">Loading branch settings…</p>
          ) : !myBranchId ? (
            <p className="profile-muted">No branch assigned to this account.</p>
          ) : (
            <>
              <label className="profile-toggle">
                <input
                  type="checkbox"
                  checked={vatEnabled}
                  disabled={!canEditVat}
                  onChange={(e) => setVatEnabled(e.target.checked)}
                />
                <span>Apply VAT on new sales</span>
              </label>

              {vatEnabled && (
                <div className="profile-field">
                  <label htmlFor="profile-vat-rate">VAT rate (%)</label>
                  <input
                    id="profile-vat-rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    disabled={!canEditVat}
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                  />
                </div>
              )}

              {isStaff && (
                <p className="profile-muted" style={{ marginTop: 12 }}>
                  Only a <strong>clerk</strong> can change VAT settings. Ask your branch clerk if you need a different rate.
                </p>
              )}

              {canEditVat && (
                <button type="button" className="profile-save-btn" disabled={saving} onClick={handleSaveVat}>
                  {saving ? 'Saving…' : 'Save VAT settings'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
