import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BsArrowClockwise } from 'react-icons/bs';
import Swal from 'sweetalert2';
import Card from '../components/card';
import IssueStatusChart from '../components/IssueStatusChart';
import DashboardLayout from '../components/dashboardlayout';
import { API_URL } from '../config/api';
import { buildIssueStatusSummarySeries } from '../utils/issueStatusSeries';
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

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Lines for refund UI + display; falls back to primary transaction_item when API omits affected_lines. */
function resolveAffectedLinesForRow(row) {
  if (Array.isArray(row.affected_lines) && row.affected_lines.length > 0) {
    return row.affected_lines;
  }
  if (row.transaction_item?.service_name) {
    return [
      {
        transaction_item_id: row.transaction_item.id,
        service_name: row.transaction_item.service_name,
        line_total: row.transaction_item.line_total,
        piece_count: row.transaction_item.piece_count,
        refundable_remaining: row.refundable_remaining,
        suggested_refund_per_piece: row.suggested_refund_per_piece,
      },
    ];
  }
  return [];
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
  const [mutatingAction, setMutatingAction] = useState(null);
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

  const issueStatusSummaryData = useMemo(() => buildIssueStatusSummarySeries(filteredIssueRows), [filteredIssueRows]);
  const issueStatusSummary = issueStatusSummaryData[0] || { resolved: 0, unresolved: 0 };

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
      if (action === 'under_review') {
        setMutatingId(`issue-${row.id}`);
        setMutatingAction(action);
        await apiRequest(`/issue-reports/${row.id}/under-review`, { method: 'PUT' });
      }

      if (action === 'reject') {
        const noteResult = await Swal.fire({
          title: 'Reject issue report',
          input: 'textarea',
          inputLabel: 'Resolution note (required)',
          inputPlaceholder: 'Explain why this report is being rejected...',
          showCancelButton: true,
          confirmButtonText: 'Reject',
          cancelButtonText: 'Cancel',
          inputValidator: (value) => {
            if (!value || !value.trim()) return 'Please provide a resolution note.';
          },
        });
        if (!noteResult.isConfirmed) return;

        setMutatingId(`issue-${row.id}`);
        setMutatingAction(action);
        await apiRequest(`/issue-reports/${row.id}/reject`, {
          method: 'PUT',
          body: JSON.stringify({ resolution_note: String(noteResult.value || '').trim() }),
        });
      }

      if (action === 'resolve_refund' || action === 'resolve_backjob') {
        const isBackjob = action === 'resolve_backjob';
        if (isBackjob) {
          const noteResult = await Swal.fire({
            title: 'Resolve as backjob',
            input: 'textarea',
            inputLabel: 'Resolution note (required)',
            inputPlaceholder: 'Describe what needs to be redone...',
            showCancelButton: true,
            confirmButtonText: 'Resolve backjob',
            cancelButtonText: 'Cancel',
            inputValidator: (value) => {
              if (!value || !value.trim()) return 'Please provide a resolution note.';
            },
          });
          if (!noteResult.isConfirmed) return;

          await apiRequest(`/issue-reports/${row.id}/resolve`, {
            method: 'PUT',
            body: JSON.stringify({
              resolution_type: 'replacement',
              resolution_note: String(noteResult.value || '').trim(),
            }),
          });
        } else {
          const lines = resolveAffectedLinesForRow(row);
          if (lines.length === 0) {
            await Swal.fire({
              title: 'Cannot resolve refund',
              text: 'This report has no linked service lines.',
              icon: 'warning',
            });
            return;
          }

          const lineBlocks = lines
            .map((line) => {
              const maxRem =
                line.refundable_remaining != null && Number.isFinite(Number(line.refundable_remaining))
                  ? Number(line.refundable_remaining)
                  : null;
              const perPiece =
                line.suggested_refund_per_piece != null &&
                Number.isFinite(Number(line.suggested_refund_per_piece))
                  ? Number(line.suggested_refund_per_piece)
                  : null;
              const maxStr = maxRem != null ? maxRem.toFixed(2) : '—';
              const hint =
                perPiece != null
                  ? `<span style="font-size:12px;color:#64748b;">Suggested per piece: <strong>₱${perPiece.toFixed(2)}</strong></span>`
                  : '';
              const id = line.transaction_item_id;
              return `<div style="margin-bottom:12px;text-align:left;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;background:#f8fafc;">
                <div style="font-weight:600;margin-bottom:4px;color:#0f172a;">${escapeHtml(line.service_name || 'Service line')}</div>
                <p style="margin:0 0 6px;font-size:12px;color:#475569;">Max for this line: <strong>₱${maxStr}</strong>${hint ? ` · ${hint}` : ''}</p>
                <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;">Refund (PHP)</label>
                <input id="swal-refund-line-${id}" type="number" class="swal2-input" min="0" step="0.01" placeholder="0.00" style="margin-bottom:0;" />
              </div>`;
            })
            .join('');

          const refundResult = await Swal.fire({
            title: 'Resolve as refund',
            html: `${lineBlocks}
              <label style="display:block;text-align:left;margin-bottom:6px;font-weight:600;">Note (required)</label>
              <textarea id="swal-refund-note" class="swal2-textarea" placeholder="Describe the resolution details..."></textarea>`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Resolve refund',
            cancelButtonText: 'Cancel',
            preConfirm: () => {
              const allocations = [];
              let total = 0;
              for (const line of lines) {
                const id = line.transaction_item_id;
                const raw = document.getElementById(`swal-refund-line-${id}`)?.value;
                const n = parseFloat(String(raw));
                if (!Number.isFinite(n) || n < 0) {
                  Swal.showValidationMessage('Enter a valid refund amount for each line (0 or more).');
                  return false;
                }
                const maxRem =
                  line.refundable_remaining != null && Number.isFinite(Number(line.refundable_remaining))
                    ? Number(line.refundable_remaining)
                    : null;
                if (maxRem != null && n - 0.001 > maxRem) {
                  Swal.showValidationMessage(
                    `Refund for "${line.service_name || 'line'}" cannot exceed ₱${maxRem.toFixed(2)}.`
                  );
                  return false;
                }
                allocations.push({ transaction_item_id: id, amount: Math.round(n * 100) / 100 });
                total += n;
              }
              if (total < 0.01) {
                Swal.showValidationMessage('Total refund must be at least 0.01.');
                return false;
              }
              const note = String(document.getElementById('swal-refund-note')?.value || '').trim();
              if (!note) {
                Swal.showValidationMessage('Please provide a resolution note.');
                return false;
              }
              return { refund_allocations: allocations, resolution_note: note };
            },
          });
          if (!refundResult.isConfirmed || !refundResult.value) return;

          setMutatingId(`issue-${row.id}`);
          setMutatingAction(action);
          await apiRequest(`/issue-reports/${row.id}/resolve`, {
            method: 'PUT',
            body: JSON.stringify({
              resolution_type: 'refund',
              refund_allocations: refundResult.value.refund_allocations,
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
      setMutatingAction(null);
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
      setMutatingAction('escalate');
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
      setMutatingAction(null);
    }
  };

  const renderIssueActions = (row) => {
    const status = String(row.status || '').toLowerCase();
    const issueType = normalizeIssueType(row.issue_type);
    const preferredResolutionType = String(row.resolution_type || '').toLowerCase();
    const isMutating = mutatingId === `issue-${row.id}`;
    const refundTypes = new Set(['damaged', 'lost']);
    const backjobTypes = new Set(['poor_quality_cleaning', 'wrinkled_not_folded_well']);
    const isOtherType = issueType === 'other';
    const showRefundAction = refundTypes.has(issueType) || (isOtherType && (!preferredResolutionType || preferredResolutionType === 'refund'));
    const showBackjobAction = backjobTypes.has(issueType) || (isOtherType && (!preferredResolutionType || preferredResolutionType === 'replacement'));

    const actionLabel = (label, actionKey) => (
      <>
        {isMutating && mutatingAction === actionKey ? (
          <>
            <span className="reports-action-spinner" aria-hidden="true" />
            Working...
          </>
        ) : (
          label
        )}
      </>
    );

    if (!canResolve) {
      if (
        isStaff &&
        currentUserId !== null &&
        Number(row.assigned_employee_user_id) === currentUserId &&
        (status === 'pending' || status === 'under_review')
      ) {
        return (
          <div className="reports-actions">
            <button disabled={isMutating} onClick={() => escalateIssue(row)}>
              {actionLabel('Escalate to clerk', 'escalate')}
            </button>
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
          <button disabled={isMutating} onClick={() => updateIssue(row, 'under_review')}>
            {actionLabel('Under review', 'under_review')}
          </button>
        )}
        {status === 'under_review' && showRefundAction && (
          <>
            <button disabled={isMutating} onClick={() => updateIssue(row, 'resolve_refund')}>
              {actionLabel('Resolve refund', 'resolve_refund')}
            </button>
          </>
        )}
        {status === 'under_review' && showBackjobAction && (
          <button disabled={isMutating} onClick={() => updateIssue(row, 'resolve_backjob')}>
            {actionLabel('Backjob', 'resolve_backjob')}
          </button>
        )}
        <button disabled={isMutating} onClick={() => updateIssue(row, 'reject')}>
          {actionLabel('Reject', 'reject')}
        </button>
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

        <Card title="Resolved vs unresolved cases">
          <p className="reports-summary-sub">Current totals follow the filters below.</p>
          <div className="reports-summary-metrics">
            <div className="reports-summary-metric">
              <span className="reports-summary-label">Resolved</span>
              <span className="reports-summary-value">{issueStatusSummary.resolved}</span>
            </div>
            <div className="reports-summary-metric">
              <span className="reports-summary-label">Unresolved</span>
              <span className="reports-summary-value">{issueStatusSummary.unresolved}</span>
            </div>
          </div>
          <div className="reports-summary-chart">
            <IssueStatusChart data={issueStatusSummaryData} height={200} emptyMessage="No issue reports yet." />
          </div>
        </Card>

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
                      {String(row.issue_type || '').toLowerCase() === 'other' && row.resolution_type ? (
                        <div className="reports-cell-sub">
                          Classified as: {String(row.resolution_type).toLowerCase() === 'refund' ? 'Refund' : 'Backjob'}
                        </div>
                      ) : null}
                      {Array.isArray(row.affected_lines) && row.affected_lines.length > 0 ? (
                        row.affected_lines.map((line) => (
                          <div key={`aff-${row.id}-${line.transaction_item_id}`} className="reports-cell-sub">
                            Line: {line.service_name} (₱{Number(line.line_total ?? 0).toFixed(2)})
                            {line.piece_count ? ` · ${line.piece_count} pc` : ''}
                          </div>
                        ))
                      ) : row.transaction_item?.service_name ? (
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
                            ? ` · Total ₱${Number(row.refund_amount).toFixed(2)}`
                            : ''}
                          {row.resolution_type === 'refund' &&
                          Array.isArray(row.refund_allocations) &&
                          row.refund_allocations.length > 1
                            ? row.refund_allocations.map((a) => {
                                const name =
                                  (row.affected_lines || []).find(
                                    (l) => Number(l.transaction_item_id) === Number(a.transaction_item_id)
                                  )?.service_name || `Line ${a.transaction_item_id}`;
                                return (
                                  <div key={`refalloc-${row.id}-${a.transaction_item_id}`}>
                                    {name}: ₱{Number(a.amount).toFixed(2)}
                                  </div>
                                );
                              })
                            : null}
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
