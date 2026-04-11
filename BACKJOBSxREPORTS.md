# BACKJOBS x REPORTS Revision Notes

Date: 2026-04-11
Scope: Web + API + Database + Workflow policy updates for Issue Reports and Backjobs

## 1) Executive Summary

This revision introduces a complete reporting workflow connected to receipt transactions:

- Users can file Issue Reports from Receipt Management.
- Users can create Backjobs (free redo jobs) from Receipt Management.
- Reports can be tracked in a dedicated Reports page.
- Status transitions are role-controlled.
- Activity is logged for traceability.
- Assignee handling was refined to match operational workflow.

In short, this revision turns report handling from ad-hoc communication into a structured branch-level workflow with accountability.

## 2) Business Problem Solved

Before this revision, there was no formal in-system pipeline for:

- Reporting paid-transaction issues (damaged, lost, etc.).
- Tracking who is handling an issue.
- Recording final resolution decisions and notes.
- Managing free redo jobs as trackable operational tasks.

This caused gaps in visibility and handoff between staff and clerk.

This revision solves that by introducing standardized records, statuses, permissions, and role-aware actions.

## 3) Major Features Added

### 3.1 Receipt Management -> Create Report Modal

From a selected receipt, users can open a Create Report modal and submit:

- Issue Report
- Backjob

For Issue Report:

- Issue type: damaged, lost, other
- Optional/required notes depending on issue type
- Assigned employee selection

For Backjob:

- Optional reason note
- Assigned employee selection

### 3.2 Dedicated Reports Page

A new Reports page includes two tabs:

- Issue Reports tab
- Backjobs tab

Capabilities include:

- List view with key fields (receipt, customer, assignee, reporter/creator, status)
- Status and type filtering
- Role-aware action buttons

### 3.3 Status Transition Workflows

Issue Reports:

- pending -> under_review
- pending/under_review -> resolved (refund or replacement)
- pending/under_review -> rejected

Backjobs:

- pending -> approved
- approved -> in_progress
- in_progress -> completed
- pending/approved/in_progress -> cancelled

### 3.4 Auto Backjob Creation on Replacement Resolution

If an Issue Report is resolved as replacement, the system can auto-create a related Backjob if there is no existing open Backjob for that transaction.

### 3.5 Activity Logging

Significant actions are written to report activity logs, including status transitions and escalation actions.

## 4) Database and API Additions

### 4.1 New Data Entities

Added schema and models for:

- Issue Reports
- Backjobs
- Report Activity Logs

### 4.2 Core API Endpoints

Read/Create:

- GET issue reports
- POST issue report
- GET backjobs
- POST backjob
- GET report assignees

Issue transitions:

- PUT issue under review
- PUT issue resolve
- PUT issue reject

Backjob transitions:

- PUT backjob approve
- PUT backjob start
- PUT backjob complete
- PUT backjob cancel

Escalation endpoints:

- GET report escalation clerks
- PUT issue escalate to clerk
- PUT backjob escalate to clerk

## 5) Roles and Permissions

### 5.1 Creation Permissions

Creation of Issue Reports and Backjobs is allowed for:

- Owner
- Manager
- Clerk
- Staff

### 5.2 Resolution/Approval Permissions

Resolution and workflow transitions are allowed for:

- Owner
- Manager
- Clerk

Staff is intentionally restricted from final resolution actions.

### 5.3 Visibility Rules (Staff)

Staff visibility includes items where at least one is true:

- The item was created/reported by that staff user.
- The item is assigned to that staff user.

This is important so assigned work remains visible to staff even when created by higher roles.

## 6) Assignment Policy (Updated)

This revision includes assignment-policy refinement:

- Staff creator: can assign only to staff in the same branch.
- Clerk/Owner/Manager creator: can assign to clerk or staff in the same branch.

Validation enforces:

- Assignee exists.
- Assignee is active.
- Assignee role is allowed for the current creator context.
- Assignee belongs to the same branch as the transaction.

## 7) Clarification: Purpose of Assign Employee

The Assign employee field exists for operational accountability.

It answers: Who owns this case right now?

### 7.1 Why it matters

- Creates clear ownership immediately at report creation.
- Prevents unassigned reports from entering the queue.
- Makes workload and accountability visible on the Reports page.
- Supports proper handoff between execution role and decision role.

### 7.2 What Assign employee does not do

- It does not automatically grant resolution permissions.
- It does not bypass role restrictions.

Resolution authority is still controlled by role (owner/manager/clerk).

### 7.3 Practical branch example

In a branch with one clerk and one staff:

- Staff-created report defaults to staff-operational handling.
- If staff needs higher-level decision, staff can escalate to clerk.
- Clerk can then perform final workflow transitions.

This keeps operational execution and final approval responsibilities separated.

## 8) Staff Escalation Workflow

To support real branch operations, a staff-only escalation flow was added.

### 8.1 Staff can escalate when

- The item is open.
- The item is currently assigned to the same staff user.

### 8.2 Escalation target

- Escalation targets active clerks in the same branch.

### 8.3 Escalation result

- Assignee changes from staff to clerk.
- Action is logged in activity logs.
- Clerk can then take approval/resolution actions.

## 9) Data Integrity and Validation Guardrails

Guardrails implemented in backend include:

- Only paid transactions can be used for report creation/backjob creation.
- Backjob creation blocks duplicates when an open backjob already exists.
- Issue type other requires detail note.
- Cross-transaction linkage validation for optional issue_report_id in backjob creation.
- Invalid status transitions are blocked with 422 responses.

## 10) Web UX Enhancements Included in This Revision

- Reports page tab and filter behavior improvements.
- Post-submit path from Receipt Management to Reports.
- Clear feedback and error handling for loading assignees and submission failures.
- Role-aware action controls on reports table.

## 11) QA and Verification Summary

Completed checks include:

- Route registration verification for all report/backjob endpoints.
- Frontend production build verification (successful).
- Backend test suite verification (passing).
- Local migration application and status verification.

## 12) Operational Notes

- Assignment policy is currently enforced at report workflow level.
- If branch staffing policy should be hard-limited to exactly one active clerk and one active staff, that should be implemented in employee/assignment management validation as a separate policy enforcement change.

## 13) Quick Reference: Current Expected Behavior

- Staff can create report/backjob.
- Staff assignee list is staff-only.
- Staff cannot resolve/approve workflow states.
- Staff can escalate own assigned open items to clerk.
- Clerk/Owner/Manager can assign to staff or clerk.
- Clerk/Owner/Manager can perform resolve/approve transitions.

## 14) Why This Revision Is Significant

This is a major operational quality upgrade because it introduces:

- Structured incident tracking
- Explicit ownership
- Controlled escalation
- Auditability
- Consistent branch workflow behavior

The result is faster handling, fewer lost issues, and clearer accountability from report creation to closure.
