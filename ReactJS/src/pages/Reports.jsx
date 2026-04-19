import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BsArrowClockwise } from 'react-icons/bs';
import Swal from 'sweetalert2';
import DashboardLayout from '../components/dashboardlayout';
import { API_URL } from '../config/api';
import '../styles/reportsstyle.css';

function getToken() {
  return localStorage.getItem('token') || '';
}

function getRole() {
  try {
    const raw = localStorage.getItem('user');
    const u = raw ? JSON.parse(raw) : null;
    return String(u?.role || '').toLowerCase();
  } catch {
    return '';
  }
}

function getUserId() {
  try {
    const raw = localStorage.getItem('user');
    const u = raw ? JSON.parse(raw) : null;
    const id = Number(u?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function statusClass(status) {
  const s = String(status || '').toLowerCase();
  return `reports-status reports-status-${s.replace(/[^a-z0-9_-]/g, '_')}`;
}

function normalizeIssueType(issueType) {
  return String(issueType || '').toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '');
}

function issueTypeLabel(issueType) {
  const t = normalizeIssueType(issueType);
  if (t === 'poor_quality_cleaning') return 'Poor Quality Cleaning';
  if (t === 'wrinkled_not_folded_well') return 'Wrinkled/ Not Folded Well';
  if (t === 'damaged') return 'Damaged';
  if (t === 'lost') return 'Lost';
  if (t === 'other') return 'Other';
  return String(issueType || '—');
}

function formatDateCell(value) {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

async function apiRequest(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  const contentType = String(res.headers.get('content-type') || '').toLowerCase();
  const payload = contentType.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    const msg = payload?.message || 'Request failed.';
    throw new Error(msg);
  }

  return payload;
}

export default function ReportsPage() {
  const [issueRows, setIssueRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutatingId, setMutatingId] = useState(null);
  const [issueStatusFilter, setIssueStatusFilter] = useState('all');
  const [issueTypeFilter, setIssueTypeFilter] = useState('all');

  const role = useMemo(() => getRole(), []);
  const currentUserId = useMemo(() => getUserId(), []);
  const isStaff = role === 'staff';
  const canResolve = role === 'owner' || role === 'clerk' || role === 'manager';

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const issues = await apiRequest('/issue-reports');
      setIssueRows(Array.isArray(issues) ? issues : []);
    } catch (e) {
      setError(e.message || 'Failed to load reports.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const issueStatusOptions = useMemo(() => {
    const values = new Set(issueRows.map((row) => String(row.status || '').toLowerCase()).filter(Boolean));
    return ['all', ...Array.from(values).sort()];
  }, [issueRows]);

  const issueTypeOptions = useMemo(() => {
    const values = new Set(issueRows.map((row) => String(row.issue_type || '').toLowerCase()).filter(Boolean));
    return ['all', ...Array.from(values).sort()];
  }, [issueRows]);

  const filteredIssueRows = useMemo(() => {
    return issueRows.filter((row) => {
      const byStatus = issueStatusFilter === 'all' || String(row.status || '').toLowerCase() === issueStatusFilter;
      const byType = issueTypeFilter === 'all' || String(row.issue_type || '').toLowerCase() === issueTypeFilter;
      return byStatus && byType;
    });
  }, [issueRows, issueStatusFilter, issueTypeFilter]);

  const pickClerkForEscalation = async (transactionId) => {
    const rows = await apiRequest(`/report-escalation-clerks?transaction_id=${encodeURIComponent(transactionId)}`);
    const clerks = Array.isArray(rows) ? rows : [];

    if (clerks.length === 0) {
      throw new Error('No active clerk available in this branch for escalation.');
    }

    if (clerks.length === 1) {
      const only = clerks[0];
      const confirmation = await Swal.fire({
        title: 'Escalate to clerk',
        text: `Assign this case to ${only.name}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Escalate',
        cancelButtonText: 'Cancel',
      });

      if (!confirmation.isConfirmed) return null;
      return Number(only.id);
    }

    const options = Object.fromEntries(
      clerks.map((clerk) => [String(clerk.id), `${clerk.name} (${clerk.role})`])
    );

    const selection = await Swal.fire({
      title: 'Escalate to clerk',
      input: 'select',
      inputOptions: options,
      inputPlaceholder: 'Select clerk',
      showCancelButton: true,
      confirmButtonText: 'Escalate',
      cancelButtonText: 'Cancel',
      inputValidator: (value) => (!value ? 'Please select a clerk.' : undefined),
    });

    if (!selection.isConfirmed) return null;
    return Number(selection.value);
  };

  const updateIssue = async (row, action) => {
    if (!canResolve) return;

    try {
      setMutatingId(`issue-${row.id}`);

      if (action === 'under_review') {
        await apiRequest(`/issue-reports/${row.id}/under-review`, { method: 'PUT' });
      }

      if (action === 'reject') {
        const noteResult = await Swal.fire({
          title: 'Reject issue report',
          input: 'textarea',
          inputLabel: 'Optional note',
          showCancelButton: true,
          confirmButtonText: 'Reject',
          cancelButtonText: 'Cancel',
        });
        if (!noteResult.isConfirmed) return;

        await apiRequest(`/issue-reports/${row.id}/reject`, {
          method: 'PUT',
          body: JSON.stringify({ resolution_note: String(noteResult.value || '').trim() || null }),
        });
      }

      if (action === 'resolve_refund' || action === 'resolve_backjob') {
        const isBackjob = action === 'resolve_backjob';
        if (isBackjob) {
          const noteResult = await Swal.fire({
            title: 'Resolve as backjob',
            input: 'textarea',
            inputLabel: 'Optional note',
            showCancelButton: true,
            confirmButtonText: 'Resolve backjob',
            cancelButtonText: 'Cancel',
          });
          if (!noteResult.isConfirmed) return;

          await apiRequest(`/issue-reports/${row.id}/resolve`, {
            method: 'PUT',
            body: JSON.stringify({
              resolution_type: 'replacement',
              resolution_note: String(noteResult.value || '').trim() || null,
            }),
          });
        } else {
          const maxRem =
            row.refundable_remaining != null && Number.isFinite(Number(row.refundable_remaining))
              ? Number(row.refundable_remaining)
              : null;
          const perPiece =
            row.suggested_refund_per_piece != null &&
            Number.isFinite(Number(row.suggested_refund_per_piece))
              ? Number(row.suggested_refund_per_piece)
              : null;
          const maxHtml =
            maxRem != null
              ? `<p style="margin:0 0 8px;text-align:left;">Maximum for this line: <strong>₱${maxRem.toFixed(2)}</strong></p>`
              : '';
          const hintHtml =
            perPiece != null
              ? `<p style="margin:0 0 12px;text-align:left;font-size:13px;color:#555;">Suggested per piece (line total ÷ piece count): <strong>₱${perPiece.toFixed(2)}</strong></p>`
              : '';

          const refundResult = await Swal.fire({
            title: 'Resolve as refund',
            html: `${maxHtml}${hintHtml}
              <label style="display:block;text-align:left;margin-bottom:6px;font-weight:600;">Refund amount (PHP)</label>
              <input id="swal-refund-amt" type="number" class="swal2-input" min="0.01" step="0.01" placeholder="0.00" style="margin-bottom:12px;" />
              <label style="display:block;text-align:left;margin-bottom:6px;font-weight:600;">Note (optional)</label>
              <textarea id="swal-refund-note" class="swal2-textarea" placeholder="Resolution note"></textarea>`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Resolve refund',
            cancelButtonText: 'Cancel',
            preConfirm: () => {
              const raw = document.getElementById('swal-refund-amt')?.value;
              const n = parseFloat(String(raw));
              if (!Number.isFinite(n) || n < 0.01) {
                Swal.showValidationMessage('Enter a valid refund amount (at least 0.01).');
                return false;
              }
              if (maxRem != null && n - 0.001 > maxRem) {
                Swal.showValidationMessage(`Amount cannot exceed ${maxRem.toFixed(2)}.`);
                return false;
              }
              const note = String(document.getElementById('swal-refund-note')?.value || '').trim();
              return { refund_amount: n, resolution_note: note || null };
            },
          });
          if (!refundResult.isConfirmed || !refundResult.value) return;

          await apiRequest(`/issue-reports/${row.id}/resolve`, {
            method: 'PUT',
            body: JSON.stringify({
              resolution_type: 'refund',
              refund_amount: refundResult.value.refund_amount,
              resolution_note: refundResult.value.resolution_note,
            }),
          });
        }
      }

      await loadData();
    } catch (e) {
      await Swal.fire({ title: 'Action failed', text: e.message || 'Request failed.', icon: 'error' });
    } finally {
      setMutatingId(null);
    }
  };

  const escalateIssue = async (row) => {
    if (!isStaff) return;

    const transactionId = Number(row.transaction_id || row.transaction?.id || 0);
    if (!transactionId) {
      await Swal.fire({ title: 'Escalation failed', text: 'Missing transaction reference.', icon: 'error' });
      return;
    }

    try {
      setMutatingId(`issue-${row.id}`);
      const clerkId = await pickClerkForEscalation(transactionId);
      if (!clerkId) return;

      await apiRequest(`/issue-reports/${row.id}/escalate`, {
        method: 'PUT',
        body: JSON.stringify({ clerk_user_id: clerkId }),
      });

      await loadData();
    } catch (e) {
      await Swal.fire({ title: 'Escalation failed', text: e.message || 'Request failed.', icon: 'error' });
    } finally {
      setMutatingId(null);
    }
  };

  const renderIssueActions = (row) => {
    const status = String(row.status || '').toLowerCase();
    const issueType = normalizeIssueType(row.issue_type);
    const isMutating = mutatingId === `issue-${row.id}`;
    const refundTypes = new Set(['damaged', 'lost']);
    const backjobTypes = new Set(['poor_quality_cleaning', 'wrinkled_not_folded_well']);

    if (!canResolve) {
      if (
        isStaff &&
        currentUserId !== null &&
        Number(row.assigned_employee_user_id) === currentUserId &&
        (status === 'pending' || status === 'under_review')
      ) {
        return (
          <div className="reports-actions">
            <button disabled={isMutating} onClick={() => escalateIssue(row)}>Escalate to clerk</button>
          </div>
        );
      }

      return <span className="reports-muted">View only</span>;
    }


    if (status === 'resolved' || status === 'rejected') {
      return <span className="reports-muted">Closed</span>;
    }

    return (
      <div className="reports-actions">
        {status === 'pending' && (
          <button disabled={isMutating} onClick={() => updateIssue(row, 'under_review')}>Under review</button>
        )}
        {status === 'under_review' && refundTypes.has(issueType) && (
          <>
            <button disabled={isMutating} onClick={() => updateIssue(row, 'resolve_refund')}>Resolve refund</button>
          </>
        )}
        {status === 'under_review' && backjobTypes.has(issueType) && (
          <button disabled={isMutating} onClick={() => updateIssue(row, 'resolve_backjob')}>Backjob</button>
        )}
        <button disabled={isMutating} onClick={() => updateIssue(row, 'reject')}>Reject</button>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="reports-page">
        <div className="reports-header">
          <div>
            <h2>Dispute</h2>
            <p>Issue reports linked to receipt transactions.</p>
          </div>
          <button
            className="reports-refresh reports-refresh-icon"
            onClick={loadData}
            disabled={isLoading}
            title="Refresh dispute list"
            aria-label="Refresh dispute list"
          >
            <BsArrowClockwise />
          </button>
        </div>

        <div className="reports-filterbar">
          <label>
            Status
            <select value={issueStatusFilter} onChange={(e) => setIssueStatusFilter(e.target.value)}>
              {issueStatusOptions.map((v) => (
                <option key={`issue-status-${v}`} value={v}>{v === 'all' ? 'All' : v}</option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select value={issueTypeFilter} onChange={(e) => setIssueTypeFilter(e.target.value)}>
              {issueTypeOptions.map((v) => (
                <option key={`issue-type-${v}`} value={v}>{v === 'all' ? 'All' : v}</option>
              ))}
            </select>
          </label>
        </div>

        {error ? <div className="reports-error">{error}</div> : null}

        {isLoading ? (
          <div className="reports-loading">Loading reports...</div>
        ) : (
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Customer</th>
                  <th>Issue</th>
                  <th>Assigned</th>
                  <th>Reported By</th>
                  <th>Date Reported</th>
                  <th>Date Solved</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredIssueRows.length === 0 ? (
                  <tr><td colSpan={9} className="reports-empty">No issue reports yet.</td></tr>
                ) : filteredIssueRows.map((row) => (
                  <tr key={`issue-${row.id}`}>
                    <td>{row.transaction?.receipt || '—'}</td>
                    <td>{row.transaction?.customer_name || '—'}</td>
                    <td>
                      <div className="reports-cell-title">{issueTypeLabel(row.issue_type)}</div>
                      {row.transaction_item?.service_name ? (
                        <div className="reports-cell-sub">
                          Line: {row.transaction_item.service_name} (₱
                          {Number(row.transaction_item.line_total ?? 0).toFixed(2)})
                          {row.transaction_item.piece_count ? ` · ${row.transaction_item.piece_count} pc` : ''}
                        </div>
                      ) : null}
                      {row.issue_note ? <div className="reports-cell-sub">{row.issue_note}</div> : null}
                    </td>
                    <td>{row.assigned_employee_name || '—'}</td>
                    <td>{row.reported_by_name || '—'}</td>
                    <td>{formatDateCell(row.created_at)}</td>
                    <td>{formatDateCell(row.resolved_at || row.closed_at)}</td>
                    <td>
                      <span className={statusClass(row.status)}>{row.status || '—'}</span>
                      {row.resolution_type ? (
                        <div className="reports-cell-sub">
                          Resolution: {row.resolution_type}
                          {row.resolution_type === 'refund' && row.refund_amount != null
                            ? ` · ₱${Number(row.refund_amount).toFixed(2)}`
                            : ''}
                        </div>
                      ) : null}
                    </td>
                    <td>{renderIssueActions(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
