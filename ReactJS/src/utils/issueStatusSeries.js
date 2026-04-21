function getViewDateBounds(viewType, referenceDate = new Date()) {
  const now = new Date(referenceDate);
  const start = new Date(now);
  const end = new Date(now);

  if (viewType === 'today') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (viewType === 'week') {
    const dow = now.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    start.setDate(now.getDate() + mondayOffset);
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (viewType === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(11, 31);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

function getIssueCreatedDate(row) {
  return new Date(row?.created_at || row?.updated_at || 0);
}

function getIssueResolvedDate(row) {
  return new Date(row?.resolved_at || row?.updated_at || 0);
}

export function buildResolvedUnresolvedSeries(viewType, reports, referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  const { start, end } = getViewDateBounds(viewType, ref);

  if (viewType === 'today') {
    const labels = ['8AM', '10AM', '12PM', '2PM', '4PM', '6PM'];
    const rows = labels.map((name) => ({ name, resolved: 0, unresolved: 0 }));

    reports.forEach((report) => {
      const status = String(report?.status || '').toLowerCase();
      const isResolved = status === 'resolved';
      const dt = isResolved ? getIssueResolvedDate(report) : getIssueCreatedDate(report);
      if (Number.isNaN(dt.getTime()) || dt < start || dt > end) return;

      const hour = dt.getHours();
      if (hour < 8 || hour > 18) return;
      const idx = Math.min(labels.length - 1, Math.floor((hour - 8) / 2));
      rows[idx][isResolved ? 'resolved' : 'unresolved'] += 1;
    });

    return rows;
  }

  if (viewType === 'week') {
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dow = ref.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    const weekEnd = new Date(monday);
    weekEnd.setDate(monday.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const rows = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      return { name: dayLabels[idx], key: d.toDateString(), resolved: 0, unresolved: 0 };
    });

    reports.forEach((report) => {
      const status = String(report?.status || '').toLowerCase();
      const isResolved = status === 'resolved';
      const dt = isResolved ? getIssueResolvedDate(report) : getIssueCreatedDate(report);
      if (Number.isNaN(dt.getTime()) || dt < monday || dt > weekEnd) return;
      const row = rows.find((item) => item.key === dt.toDateString());
      if (row) row[isResolved ? 'resolved' : 'unresolved'] += 1;
    });

    return rows.map(({ name, resolved, unresolved }) => ({ name, resolved, unresolved }));
  }

  if (viewType === 'month') {
    const currentYear = ref.getFullYear();
    const currentMonth = ref.getMonth();
    const rows = [
      { name: 'Week 1', resolved: 0, unresolved: 0 },
      { name: 'Week 2', resolved: 0, unresolved: 0 },
      { name: 'Week 3', resolved: 0, unresolved: 0 },
      { name: 'Week 4', resolved: 0, unresolved: 0 },
    ];

    reports.forEach((report) => {
      const status = String(report?.status || '').toLowerCase();
      const isResolved = status === 'resolved';
      const dt = isResolved ? getIssueResolvedDate(report) : getIssueCreatedDate(report);
      if (Number.isNaN(dt.getTime()) || dt.getFullYear() !== currentYear || dt.getMonth() !== currentMonth) {
        return;
      }
      const idx = Math.min(3, Math.floor((dt.getDate() - 1) / 7));
      rows[idx][isResolved ? 'resolved' : 'unresolved'] += 1;
    });

    return rows;
  }

  const yearRows = [
    { name: 'Jan', resolved: 0, unresolved: 0 },
    { name: 'Feb', resolved: 0, unresolved: 0 },
    { name: 'Mar', resolved: 0, unresolved: 0 },
    { name: 'Apr', resolved: 0, unresolved: 0 },
    { name: 'May', resolved: 0, unresolved: 0 },
    { name: 'Jun', resolved: 0, unresolved: 0 },
    { name: 'Jul', resolved: 0, unresolved: 0 },
    { name: 'Aug', resolved: 0, unresolved: 0 },
    { name: 'Sep', resolved: 0, unresolved: 0 },
    { name: 'Oct', resolved: 0, unresolved: 0 },
    { name: 'Nov', resolved: 0, unresolved: 0 },
    { name: 'Dec', resolved: 0, unresolved: 0 },
  ];

  reports.forEach((report) => {
    const status = String(report?.status || '').toLowerCase();
    const isResolved = status === 'resolved';
    const dt = isResolved ? getIssueResolvedDate(report) : getIssueCreatedDate(report);
    if (Number.isNaN(dt.getTime()) || dt.getFullYear() !== ref.getFullYear()) return;
    yearRows[dt.getMonth()][isResolved ? 'resolved' : 'unresolved'] += 1;
  });

  return yearRows;
}

export function buildIssueStatusSummarySeries(reports) {
  const summary = reports.reduce(
    (acc, report) => {
      const status = String(report?.status || '').toLowerCase();
      if (status === 'resolved') acc.resolved += 1;
      else acc.unresolved += 1;
      return acc;
    },
    { name: 'Reports', resolved: 0, unresolved: 0 }
  );

  return [summary];
}