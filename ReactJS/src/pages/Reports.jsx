import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

function statusClass(status) {
  const s = String(status || '').toLowerCase();
  return `reports-status reports-status-${s.replace(/[^a-z0-9_-]/g, '_')}`;
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
  const location = useLocation();
  const navigate = useNavigate();

  const getTabFromQuery = useCallback(() => {
    const params = new URLSearchParams(location.search || '');
    const tab = String(params.get('tab') || '').toLowerCase();
    return tab === 'backjobs' ? 'backjobs' : 'issues';
  }, [location.search]);

  const [activeTab, setActiveTab] = useState('issues');
  const [issueRows, setIssueRows] = useState([]);
  const [backjobRows, setBackjobRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutatingId, setMutatingId] = useState(null);
  const [issueStatusFilter, setIssueStatusFilter] = useState('all');
  const [issueTypeFilter, setIssueTypeFilter] = useState('all');
  const [backjobStatusFilter, setBackjobStatusFilter] = useState('all');

  const role = useMemo(() => getRole(), []);
  const canResolve = role === 'owner' || role === 'clerk' || role === 'manager';

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [issues, backjobs] = await Promise.all([
        apiRequest('/issue-reports'),
        apiRequest('/backjobs'),
      ]);
      setIssueRows(Array.isArray(issues) ? issues : []);
      setBackjobRows(Array.isArray(backjobs) ? backjobs : []);
    } catch (e) {
      setError(e.message || 'Failed to load reports.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setActiveTab(getTabFromQuery());
  }, [getTabFromQuery]);

  const switchTab = (nextTab) => {
    setActiveTab(nextTab);
    navigate(`/Reports?tab=${nextTab}`, { replace: true });
  };

  const issueStatusOptions = useMemo(() => {
    const values = new Set(issueRows.map((row) => String(row.status || '').toLowerCase()).filter(Boolean));
    return ['all', ...Array.from(values).sort()];
  }, [issueRows]);

  const issueTypeOptions = useMemo(() => {
    const values = new Set(issueRows.map((row) => String(row.issue_type || '').toLowerCase()).filter(Boolean));
    return ['all', ...Array.from(values).sort()];
  }, [issueRows]);

  const backjobStatusOptions = useMemo(() => {
    const values = new Set(backjobRows.map((row) => String(row.status || '').toLowerCase()).filter(Boolean));
    return ['all', ...Array.from(values).sort()];
  }, [backjobRows]);

  const filteredIssueRows = useMemo(() => {
    return issueRows.filter((row) => {
      const byStatus = issueStatusFilter === 'all' || String(row.status || '').toLowerCase() === issueStatusFilter;
      const byType = issueTypeFilter === 'all' || String(row.issue_type || '').toLowerCase() === issueTypeFilter;
      return byStatus && byType;
    });
  }, [issueRows, issueStatusFilter, issueTypeFilter]);

  const filteredBackjobRows = useMemo(() => {
    return backjobRows.filter((row) => {
      return backjobStatusFilter === 'all' || String(row.status || '').toLowerCase() === backjobStatusFilter;
    });
  }, [backjobRows, backjobStatusFilter]);

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

      if (action === 'resolve_refund' || action === 'resolve_replacement') {
        const isRefund = action === 'resolve_refund';
        const noteResult = await Swal.fire({
          title: isRefund ? 'Resolve as refund' : 'Resolve as replacement',
          input: 'textarea',
          inputLabel: 'Optional note',
          showCancelButton: true,
          confirmButtonText: isRefund ? 'Resolve refund' : 'Resolve replacement',
          cancelButtonText: 'Cancel',
        });
        if (!noteResult.isConfirmed) return;

        await apiRequest(`/issue-reports/${row.id}/resolve`, {
          method: 'PUT',
          body: JSON.stringify({
            resolution_type: isRefund ? 'refund' : 'replacement',
            resolution_note: String(noteResult.value || '').trim() || null,
          }),
        });
      }

      await loadData();
    } catch (e) {
      await Swal.fire({ title: 'Action failed', text: e.message || 'Request failed.', icon: 'error' });
    } finally {
      setMutatingId(null);
    }
  };

  const updateBackjob = async (row, action) => {
    if (!canResolve) return;

    const actionMap = {
      approve: `/backjobs/${row.id}/approve`,
      start: `/backjobs/${row.id}/start`,
      complete: `/backjobs/${row.id}/complete`,
      cancel: `/backjobs/${row.id}/cancel`,
    };

    const url = actionMap[action];
    if (!url) return;

    try {
      setMutatingId(`backjob-${row.id}`);

      let reasonNote = null;
      if (action === 'cancel') {
        const noteResult = await Swal.fire({
          title: 'Cancel backjob',
          input: 'textarea',
          inputLabel: 'Optional note',
          showCancelButton: true,
          confirmButtonText: 'Cancel backjob',
          cancelButtonText: 'Keep it open',
        });
        if (!noteResult.isConfirmed) return;
        reasonNote = String(noteResult.value || '').trim() || null;
      }

      await apiRequest(url, {
        method: 'PUT',
        body: JSON.stringify({ reason_note: reasonNote }),
      });

      await loadData();
    } catch (e) {
      await Swal.fire({ title: 'Action failed', text: e.message || 'Request failed.', icon: 'error' });
    } finally {
      setMutatingId(null);
    }
  };

  const renderIssueActions = (row) => {
    if (!canResolve) return <span className="reports-muted">View only</span>;

    const isMutating = mutatingId === `issue-${row.id}`;
    const status = String(row.status || '').toLowerCase();

    if (status === 'resolved' || status === 'rejected') {
      return <span className="reports-muted">Closed</span>;
    }

    return (
      <div className="reports-actions">
        {status === 'pending' && (
          <button disabled={isMutating} onClick={() => updateIssue(row, 'under_review')}>Under review</button>
        )}
        <button disabled={isMutating} onClick={() => updateIssue(row, 'resolve_refund')}>Resolve refund</button>
        <button disabled={isMutating} onClick={() => updateIssue(row, 'resolve_replacement')}>Resolve replacement</button>
        <button disabled={isMutating} onClick={() => updateIssue(row, 'reject')}>Reject</button>
      </div>
    );
  };

  const renderBackjobActions = (row) => {
    if (!canResolve) return <span className="reports-muted">View only</span>;

    const isMutating = mutatingId === `backjob-${row.id}`;
    const status = String(row.status || '').toLowerCase();

    if (status === 'completed' || status === 'cancelled') {
      return <span className="reports-muted">Closed</span>;
    }

    return (
      <div className="reports-actions">
        {status === 'pending' && (
          <button disabled={isMutating} onClick={() => updateBackjob(row, 'approve')}>Approve</button>
        )}
        {status === 'approved' && (
          <button disabled={isMutating} onClick={() => updateBackjob(row, 'start')}>Start</button>
        )}
        {status === 'in_progress' && (
          <button disabled={isMutating} onClick={() => updateBackjob(row, 'complete')}>Complete</button>
        )}
        {(status === 'pending' || status === 'approved' || status === 'in_progress') && (
          <button disabled={isMutating} onClick={() => updateBackjob(row, 'cancel')}>Cancel</button>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="reports-page">
        <div className="reports-header">
          <div>
            <h2>Reports</h2>
            <p>Issue reports and backjobs linked to receipt transactions.</p>
          </div>
          <button className="reports-refresh" onClick={loadData} disabled={isLoading}>Refresh</button>
        </div>

        <div className="reports-tabs">
          <button
            className={activeTab === 'issues' ? 'active' : ''}
            onClick={() => switchTab('issues')}
          >
            Issue Reports
          </button>
          <button
            className={activeTab === 'backjobs' ? 'active' : ''}
            onClick={() => switchTab('backjobs')}
          >
            Backjobs
          </button>
        </div>

        <div className="reports-filterbar">
          {activeTab === 'issues' ? (
            <>
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
            </>
          ) : (
            <label>
              Status
              <select value={backjobStatusFilter} onChange={(e) => setBackjobStatusFilter(e.target.value)}>
                {backjobStatusOptions.map((v) => (
                  <option key={`backjob-status-${v}`} value={v}>{v === 'all' ? 'All' : v}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {error ? <div className="reports-error">{error}</div> : null}

        {isLoading ? (
          <div className="reports-loading">Loading reports...</div>
        ) : activeTab === 'issues' ? (
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Customer</th>
                  <th>Issue</th>
                  <th>Assigned</th>
                  <th>Reported By</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredIssueRows.length === 0 ? (
                  <tr><td colSpan={7} className="reports-empty">No issue reports yet.</td></tr>
                ) : filteredIssueRows.map((row) => (
                  <tr key={`issue-${row.id}`}>
                    <td>{row.transaction?.receipt || '—'}</td>
                    <td>{row.transaction?.customer_name || '—'}</td>
                    <td>
                      <div className="reports-cell-title">{String(row.issue_type || '').toUpperCase()}</div>
                      {row.issue_note ? <div className="reports-cell-sub">{row.issue_note}</div> : null}
                    </td>
                    <td>{row.assigned_employee_name || '—'}</td>
                    <td>{row.reported_by_name || '—'}</td>
                    <td>
                      <span className={statusClass(row.status)}>{row.status || '—'}</span>
                      {row.resolution_type ? (
                        <div className="reports-cell-sub">Resolution: {row.resolution_type}</div>
                      ) : null}
                    </td>
                    <td>{renderIssueActions(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Customer</th>
                  <th>Assigned</th>
                  <th>Created By</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBackjobRows.length === 0 ? (
                  <tr><td colSpan={7} className="reports-empty">No backjobs yet.</td></tr>
                ) : filteredBackjobRows.map((row) => (
                  <tr key={`backjob-${row.id}`}>
                    <td>{row.transaction?.receipt || '—'}</td>
                    <td>{row.transaction?.customer_name || '—'}</td>
                    <td>{row.assigned_employee_name || '—'}</td>
                    <td>{row.created_by_name || '—'}</td>
                    <td>
                      <span className={statusClass(row.status)}>{row.status || '—'}</span>
                    </td>
                    <td>{row.reason_note || '—'}</td>
                    <td>{renderBackjobActions(row)}</td>
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
