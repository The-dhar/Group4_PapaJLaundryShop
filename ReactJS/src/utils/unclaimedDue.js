/**
 * Shared "unclaimed overdue" rules for Unclaimed Items + Transaction Log (Inventory).
 * Calendar days after due date; YYYY-MM-DD and ISO datetimes use the calendar date portion.
 */

export function getDaysPastDue(dueDate) {
  if (!dueDate) return -Infinity;
  const s = String(dueDate).trim();
  const ymd = s.slice(0, 10);
  let due;
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const [y, m, d] = ymd.split('-').map(Number);
    due = new Date(y, m - 1, d);
  } else {
    due = new Date(s);
  }
  if (Number.isNaN(due.getTime())) return -Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.floor((today - due) / 86400000);
}

export function isThreeOrMoreDaysPastDueDate(dueDate) {
  // Kept export name for compatibility; policy is now warning at 7+ days.
  return getDaysPastDue(dueDate) >= 7;
}

export function isThirtyOrMoreDaysPastDueDate(dueDate) {
  return getDaysPastDue(dueDate) >= 30;
}

/** Same condition as rows on the Unclaimed Items page (in shop + 7+ days past due). */
export function isUnclaimedOverdueHighlight(row) {
  if (!row || row.archived) return false;
  if (String(row.inventory_status || '').toLowerCase() !== 'in_shop') return false;
  return isThreeOrMoreDaysPastDueDate(row.due_date);
}
