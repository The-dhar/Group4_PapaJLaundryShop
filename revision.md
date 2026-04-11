# Revision Checklist - Clerk and Staff Transaction Isolation

Use this file to track what is done and what is pending.
Features that are already fixed:
- Staff can view and act on staff-created transactions in their assigned branch, while clerk keeps full branch transaction visibility.
- Newly assigned staff accounts can see existing staff-created transactions in their assigned branch.
- Clerk web pages auto-refresh transaction lists without hard refresh.
- POS customer input fields no longer reset while staff is typing.
- Mobile Create staff Step 2 now locks verified email, hides verification code entry after success, and supports Change email reset.
- Mobile Branch and Employees tabs now show a centered loading spinner during initial data fetch, consistent with Employee Settings and Price loading behavior.

## Project Info
- Created: 2026-04-11
- Last Updated: 2026-04-11 (implementation + validation + mobile verification UX + loading consistency)

## Revision Process
- Rule: Every new revision must be recorded in this file in the same day it is implemented.

## Legend
- [x] Done
- [ ] Pending

## Status Labels
- Not Started
- In Progress
- Blocked
- Done
- Verified

## Finalized Policy (Locked)
- [x] Staff can do the same actions as clerk, but only on transactions they are allowed to access.
- [x] Staff can only see staff-created transactions in their assigned branch (not clerk-created transactions).
- [x] Clerk can see all transactions in their current assigned branch.
- [x] Owner behavior stays unchanged.
- [x] After reassignment, employee access is based on the current assigned branch only.
- [x] Legacy transactions with no creator are hidden from staff, but visible to clerk and owner.

## Workboard

### Backend (Laravel)
- [x] Restrict transaction list for staff to current branch plus created_by_user_id = current staff user.
	- Status: Done
	- Target Date: 2026-04-13
	- Priority: High
	- Dependency: None
- [x] Keep clerk transaction list as current branch scope (all branch transactions).
	- Status: Done
	- Target Date: 2026-04-13
	- Priority: High
	- Dependency: None
- [x] Update transactionForUser access checks so staff can modify only their own transactions.
	- Status: Done
	- Target Date: 2026-04-13
	- Priority: High
	- Dependency: Backend list visibility rule
- [x] Keep owner access behavior unchanged.
	- Status: Done
	- Target Date: 2026-04-13
	- Priority: High
	- Dependency: None
- [x] Add creator fields in transactions API response for accurate UI labels.
	- Status: Done
	- Target Date: 2026-04-14
	- Priority: Medium
	- Dependency: Access rules complete

### Frontend (ReactJS)
- [x] Display actual transaction creator label from API (not branch clerk username fallback).
	- Status: Done
	- Target Date: 2026-04-14
	- Priority: Medium
	- Dependency: Backend creator fields available
- [x] Notes: ReactJS transaction pages currently do not display branch clerk_username labels, so no ReactJS label replacement was required.
- [ ] Verify all transaction pages still function with backend role isolation.
	- Status: In Progress
	- Target Date: 2026-04-14
	- Priority: High
	- Dependency: Backend access checks complete

### Optional Frontend (ReactNative owner screens)
- [x] Validate owner mobile screens still load transaction data correctly after backend changes.
	- Status: Done
	- Target Date: 2026-04-14
	- Priority: Low
	- Dependency: Backend access checks complete
- [x] Notes: Updated mobile transaction screens to show Created By from API creator fields.

### Mobile (ReactNative create staff verification)
- [x] After email verification, lock email input and hide verification code field/actions.
	- Status: Done
	- Target Date: 2026-04-14
	- Priority: Medium
	- Dependency: Verification send/check endpoints
- [x] Add Change email action that resets verification state safely.
	- Status: Done
	- Target Date: 2026-04-14
	- Priority: Medium
	- Dependency: Verification send/check endpoints

### Mobile (ReactNative loading UX consistency)
- [x] Remove owner-only notice text in Employee Settings and show spinner while access state is loading.
	- Status: Done
	- Target Date: 2026-04-14
	- Priority: Low
	- Dependency: None
- [x] Add initial centered loading spinner in Branch and Employees tabs while first payload is loading.
	- Status: Done
	- Target Date: 2026-04-14
	- Priority: Low
	- Dependency: None

## Test Scenarios
- [x] Clerk in Branch A sees all Branch A transactions.
	- Status: Done
	- Target Date: 2026-04-14
	- Priority: High
- [x] Staff in Branch A sees staff-created transactions in Branch A and does not see clerk-created transactions.
	- Status: Done
	- Target Date: 2026-04-14
	- Priority: High
- [ ] Staff cannot access or modify clerk-created transactions via API endpoints.
	- Status: Not Started
	- Target Date: 2026-04-14
	- Priority: High
- [ ] Reassigned employee sees transactions only from the newly assigned branch and based on role visibility.
	- Status: Not Started
	- Target Date: 2026-04-14
	- Priority: High
- [x] Newly assigned staff account in a branch can view existing staff-created branch transactions.
	- Status: Done
	- Target Date: 2026-04-14
	- Priority: High
- [x] In Create staff Step 2 on mobile, verified email locks and verification code input is removed until Change email is tapped.
	- Status: Done
	- Target Date: 2026-04-14
	- Priority: Medium
- [ ] Owner still sees expected transaction data by selected branch and date filters.
	- Status: Not Started
	- Target Date: 2026-04-14
	- Priority: Medium

## Definition of Done

### Backend Done Criteria
- [x] All related endpoints enforce the finalized policy.
- [x] No behavior regression for owner and clerk.
- [ ] Manual API verification completed for staff, clerk, owner accounts.

### Frontend Done Criteria
- [x] Transaction labels and lists match backend visibility.
- [ ] No broken transaction pages after API changes.

### Validation Done Criteria
- [ ] All test scenarios in this file are checked as Done.
- [ ] Final retest performed after reassignment scenario.

## Progress Log
- [x] Requirements discussion and policy finalized (2026-04-11).
- [x] Revision tracker expanded with dates and priorities (2026-04-11).
- [x] Implementation started (2026-04-11).
- [x] Backend revision completed (2026-04-11).
- [x] Frontend revision completed for ReactNative creator labels (2026-04-11).
- [x] Clerk live auto-fetch now shows new staff transactions without hard refresh (2026-04-11).
- [x] POS input fields no longer reset while staff is typing (2026-04-11).
- [x] Staff-to-staff branch transaction visibility confirmed (2026-04-11).
- [x] Mobile Create staff Step 2 now locks verified email and hides verification code flow after success (2026-04-11).
- [x] Mobile tabs loading UX aligned: Settings, Branches, Employees, and Price show loading states consistently on initial load (2026-04-11).
- [ ] End-to-end validation completed.
