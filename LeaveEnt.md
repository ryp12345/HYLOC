# Leave Entitlement Management Documentation

## Overview

The Leave Entitlement feature allows Admin to assign, manage, and track annual leave entitlements for users(of Role Manager and Employee). It supports both individual and bulk assignments, editing, and deletion, with a clear view of leave balances.

**URL:** http://localhost:3000/leave-entitlement (in my )
**Access:** Users (via Dashboard Sidebar)

---

## UI Elements (Verified)

- **Search textbox**: Search staff by name, email, or employee ID
- **Year dropdown**: Filter entitlements by year (current + next 2 years)
- **Bulk Assign button**: Assigns leaves to multiple users at once
- **Assign Leave button**: Opens a modal for single assignment

### Assign Leave Modal

- **Staff Member**: Dropdown (prevents typos, ensures valid selection)
- **Year**: Dropdown
- **Leave Entitled**: Textbox (number input)
- **Leaves Accumulated**: Textbox (number input)
- **Assign Leave**: Submit button
- **Cancel**: Closes modal

---

## Workflow

### 1. Page Load

- Loads entitlements and staff for the selected year
- Parallel API calls for entitlements and staff list

### 2. Search & Filter

- Search filters entitlements client-side (name, email, emp ID)
- Year dropdown reloads data for selected year

### 3. Assign Leave (Single)

- Opens modal
- User selects staff, year, entitled, accumulated
- Submits form → API call to assign leave
- Closes modal and reloads data

### 4. Bulk Assign

- Opens modal
- User selects year, entitled, accumulated, and users (checkboxes)
- Submits form → API call to bulk assign
- Closes modal and reloads data

### 5. Edit/Delete

- Edit: Opens modal to update entitlement fields
- Delete: Confirms and removes entitlement

---

## API Endpoints

- `GET /api/leave-entitlements?year=YYYY` - List entitlements
- `GET /api/leave-entitlements/staff?year=YYYY` - List staff with assignment status
- `POST /api/leave-entitlements/assign` - Assign to single user
- `POST /api/leave-entitlements/bulk-assign` - Assign to multiple users
- `PUT /api/leave-entitlements/:id` - Update entitlement
- `DELETE /api/leave-entitlements/:id` - Delete entitlement


The above route maybe different when you are implementing. Adjust the route accordingly

---

## Data Model

- **Table:** leaves_entitlement
- **Fields:**
  - id (PK, auto-increment)
  - user_id (UUID, FK)
  - year (int)
  - leave_entitled (decimal, default 12.0)
  - leaves_accumulated (decimal, default 0.0)
  - leaves_availed (decimal, default 0.0)
- **Unique:** (user_id, year)

---

## Error Handling & Security

- All routes require authentication (JWT)
- Only users with Admin role can access
- Form validation for required fields
- Error messages shown in UI and API responses

---

## File References

- `client/src/pages/Admin/leaves/LeaveEntitlementPage.jsx` (main UI)
- `client/src/api/leaveEntitlementApi.js` (API service)
- `server/src/controllers/leaveEntitlement.controller.js` (backend logic)
- `server/src/models/leave_entitlement.model.js` (data model)
- `server/src/routes/leaveEntitlement.routes.js` (API routes)

The above routes may slightly change in your implmentation. Adjust accordingly

---

## Summary

The Leave Entitlement feature is robust, user-friendly, and secure, supporting all required workflows for leave management as described above.