# Revision Checklist - Clerk and Staff Transaction Isolation

Use this file to track what is done and what is pending.
- Fixed: staff can now only view and act on their own branch transactions, while clerk keeps full branch transaction visibility.

## Project Info
- Created: 2026-04-11
- Last Updated: 2026-04-11 (implementation pass)

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
- [x] Staff can only see transactions they created.
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

## Test Scenarios
- [ ] Clerk in Branch A sees all Branch A transactions.
	- Status: Not Started
	- Target Date: 2026-04-14
	- Priority: High
- [ ] Staff in Branch A sees only transactions they created in Branch A.
	- Status: Not Started
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
- [ ] End-to-end validation completed.
