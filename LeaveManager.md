# Leave Management - Manager Role Documentation

## Role Definition

**Manager Role**: Managerial role with the ability to apply for, view, and manage their own leave requests, and approve/reject Employee's leave requests based on duration.

---

## Overview

The Manager role **can apply for leave** in the system. Users can:

1. Apply for new leave requests
2. View their own pending and approved leaves
3. View their leave balance for the current year
4. Modify (update) their own pending leave requests
5. Cancel (delete) their own pending leave requests
6. Access calendar view integrated with their leave information
7. **Manager role can only approve/reject Employees' leaves (NOT other Managers' leaves)**
8. Cannot view other employees' leave information (except to approve/reject as required)

---

## Business Rules

### Rule 1: Users Can Apply for Leave

**Condition**: Users with the current active role of `'Manager'` can apply for leave.

**Rationale**: Leave applications are individual benefit claims tied to employment status.

**Implementation**:

- `evaluateApplyEligibility()` function checks: `req.user.role === 'Manager'`
- If user's current role is Manager → Allowed to proceed
- If user's current role is NOT Manager → Cannot apply

---

### Rule 2: Leave Duration Types

**Condition**: User can specify leave duration as one of the predefined types.

**Valid Duration Types**:

- `'Full Day'` (default)
- `'Morning Half'` (half-day morning)
- `'Afternoon Half'` (half-day afternoon)

**Implementation**:

- Client receives dropdown with these 3 options
- Server enforces: If duration is "Half Day", then `from_date === to_date` (same day)
- Server calculates: Half-day leaves always credit 0.5 days

**Code Logic**:

```javascript
if (duration === "Morning Half" || duration === "Afternoon Half") {
  normalizedTo = normalizedFrom; // Force same day
  computedCredited = 0.5;
} else {
  // Full Day: calculate difference
  computedCredited = Math.round(((toD - fromD) / MS_PER_DAY + 1) * 10) / 10;
}
```

---

### Rule 3: Date Validation

**Condition**: Leave dates must follow specific validation rules.

**Sub-Rules**:

- **3A**: `from_date` is REQUIRED
- **3B**: `to_date` is optional (defaults to `from_date` if not provided)
- **3C**: `to_date` cannot be earlier than `from_date`
- **3D**: Both dates must be in valid `YYYY-MM-DD` format
- **3E**: Dates must be in the future (no retroactive leaves except already-approved ones)

**Error Responses**:

```json
{
  "message": "Invalid date format. Expect YYYY-MM-DD"
}
```

---

### Rule 4: Leave Entitlement Tracking

**Condition**: Manager's leave balance is tracked in `leaves_entitlement` table and updated automatically.

**Sub-Rules**:

**4A: Deduction on Apply**

- When user submits leave application
- System finds/creates `leaves_entitlement` record for current year
- System increases: `leaves_availed += credited_days`
- Effect: Reduces available balance immediately
- Purpose: Prevents over-application

**4B: Balance Calculation**

- Formula: `leave_balance = (leave_entitled + leaves_accumulated) - leaves_availed`
- `leave_entitled`: Annual allocation (typically 12 days)
  - But if user has joined in the middle of the year leave_entitled = 12 - month_number + 1
  - Example if current month is October leave_entitled = 12 - 10 + 1 = 3 (since October is 10th month)
- `leaves_accumulated`: Rollover from previous years (if any)
- `leaves_availed`: Total days applied for (approved + pending + rejected)

**4C: Restoration on Cancel**

- When user of role Manager cancels a pending leave application
- System decreases: `leaves_availed -= credited_days`
- Effect: Restores balance
- Only applicable: Leaves in 'Pending' status
- Cannot cancel already-approved leaves (restoration depends on policy)

---

### Rule 5: Can Only Manage Own Leaves

**Condition**: Manager can only view, edit, and delete their own leave records.

**Implementation**:

- Prevents viewing other managers' leaves
- Prevents editing other managers' leaves
- Prevents deleting other managers' leaves
- Managers can view and approve/reject Employees' leaves (based on Rule 12)

---

### Rule 6: Can Only Edit Pending Leaves

**Condition**: Manager can only modify (update) leave requests that are in 'Pending' status.

**Rationale**: Approved/rejected leaves are final decisions and cannot be changed.

**Implementation**:

- If not Pending → 400 Bad Request: "Can only update pending leaves"
- If Pending → Allow modifications

**Modifiable Fields**:

- `from_date`
- `to_date`
- `leave_duration`
- `leave_reason`
- `alternate_person` (person covering responsibilities)
- `additional_alternate` (backup person)
- `available_on_phone`

**Non-Modifiable Fields**:

- `user_id` (system-set)
- `status` (set by approvers)
- `approved_by` (set by approvers)

---

### Rule 7: Can Only Delete Pending Leaves

**Condition**: Manager can only cancel (delete) leave requests in 'Pending' status.

**Rationale**: Approved leaves are decisions made by management.

**Implementation**:

- If not Pending → 400 Bad Request: "Can only delete pending leaves"
- If Pending → Allow deletion

---

### Rule 8: Partial Cancellation for Ongoing Leaves

**Condition**: Manager cancels a leave that's currently in progress (some dates past, some future), system performs partial cancellation.

**Logic**:

- Get today's date
- Parse leave from_date and to_date
- If `from_date >= today`: Full cancellation (all dates future)
- If `to_date < today`: Cannot cancel (all dates already consumed)
- If `from_date < today` AND `to_date >= today`: Partial cancellation
  - Keep past dates as leaves (since leave was already availed)
  - Cancel future dates (they are not considered as leaves applied and were not availed)
  - Update `to_date` to yesterday
  - Recalculate `credited_days` for remaining days
  - Restore balance for cancelled portion

**Example**:

```
Leave: Jan 15-20 (6 days)
Today: Jan 18
from_date (Jan 15) < today ✓
to_date (Jan 20) >= today ✓
→ Partial cancellation

Days to keep (leaves availed): Jan 15-17 (3 days)
Days to cancel (no leave applied): Jan 18-20 (3 days)
Update to_date (leave availed): Jan 17
Restore: 3 days to leaves_availed
```

---

### Rule 9: Leave Request Information

**Condition**: Users must provide certain information with leave application.

**Required Fields**:

- `from_date`: Start date (REQUIRED)
- `leave_reason`: Reason for leave (REQUIRED)

**Optional Fields**:

- `to_date`: End date (defaults to from_date)
- `leave_duration`: Type of leave (defaults to 'Full Day')
- `alternate_person`: Name of colleague covering (optional)
- `additional_alternate`: Secondary backup (optional)
- `available_on_phone`: Boolean indicating phone availability (defaults true)
- `leave_type`: 'Paid' or other type (defaults 'Paid')

---

## Approval Rules

### Rule 10: Manager Cannot Approve Another Manager's Leave

**Condition**: A user of Manager role CANNOT approve or reject leave requests from other Managers.

**Rationale**: Inter-departmental approval conflicts; only Management role (higher authority) can make decisions on Manager's leaves.

**Implementation**:

- When approveLeave/rejectLeave is called:
  - Check the leave's user_id and get their role
  - If leave's user has Manager role:
    - Only Management role can approve/reject
    - If approver is Manager → 403 Forbidden: "Only Management can approve Manager's leaves"
    - If approver is Management → Allowed
  - If leave's user has Employee role:
    - Manager can approve if credited_days ≤ 2
    - Management can approve if credited_days > 2
    - (Existing logic applies)

---

### Rule 11: Managers Can Approve/Reject Employee Leaves (Duration-based)

**Condition**: Manager can approve Employee's leave requests ONLY if duration is ≤ 2 days.

**Implementation**:

- Check leave's user role = 'Employee'
- Check credited_days ≤ 2
- If yes → Manager can approve
- If no (Employee's leave > 2 days) → 403 Forbidden: "This leave requires Management approval"

---

### Rule 12: Management Approves All Leaves (Unlimited Duration)

**Condition**: Management role can approve or reject ANY leave request from ANY role (Employee or Manager), regardless of duration.

**Implementation**:

- When Management user calls approveLeave/rejectLeave:
  - No duration restrictions
  - No role-based restrictions on leave's user
  - Always allowed to proceed

---

## Eligibility Determination

**Conditions Checked**:

- User status in users table is 'active'
- User's role in user_roles table is 'Manager'

---

## Calendar Integration

### Features for Manager Users:

1. **Monthly View**: Calendar showing personal pending and approved leaves
2. **Weekly View**: Detailed weekly breakdown of own leaves
3. **Visual Indicators**:
   - Approved leaves: Green badge
   - Pending leaves: Yellow badge
   - Rejected leaves: Red badge (shown for reference)
4. **Click to Interact**:
   - Click date to view leave details
   - Click badge to edit (if pending) or view details
   - View leave balance information

### Data Flow (for Manager role):

- User navigates to `/manager/leaves` or similar
- System loads `ManagerCalendar.jsx` component
- Displays calendar with only current user's leaves
- Shows all months/years user has leaves in calendar
- Includes leave application form integrated into calendar

---

## Database Schema Details

### Tables Involved:

#### 1. `users` Table

Fields relevant to Manager:
- `id`: Unique identifier
- `email`: Email address
- `firstname`, `lastname`: Name
- `department_id`: Department assignment
- `status`: Must be 'active'

---

#### 2. `roles` Table

**Role**: Defines available roles in system
- Contains 'Manager' role definition

---

#### 3. `user_roles` Table (Pivot/Junction)

**Role**: Links Manager users to their role
**Critical Check**:
- `roles.name = 'Manager'`
- `user_roles.user_id` matches current user
- Only users with Manager role can apply for leave

---

#### 4. `leaves` Table

**Key Columns for Manager**:

- `id`: Unique leave identifier
- `user_id`: Manager's id (Manager creates with this set to their own ID)
- `from_date`: Start date of leave (YYYY-MM-DD format)
- `to_date`: End date of leave (YYYY-MM-DD format)
- `leave_reason`: Why the leave is needed
- `leave_duration`: 'Full Day', 'Morning Half', 'Afternoon Half'
- `credited_days`: Calculated days (0.5 for half-day, 1+ for full days)
- `status`: 'Pending' (initial), 'Approved', 'Rejected'
- `approved_by`: ID of Management user who approved (if applicable)
- `approved_date`: Timestamp of approval
- `alternate_person`: Colleague covering responsibilities (optional)
- `additional_alternate`: Secondary backup (optional)
- `available_on_phone`: Boolean - whether manager is reachable (optional)
- `leave_type`: 'Paid' or other type
- `created_at`: Record creation timestamp

---

#### 5. `leaves_entitlement` Table

**Role**: Tracks Manager's annual leave balance

**Key Columns**:

- `user_id`: Manager's id
- `year`: Calendar year
- `leave_entitled`: Annual allocation
- `leaves_accumulated`: Rollover from previous years
- `leaves_availed`: Total days applied (sum of all approved + pending + rejected)
- `balance`: Calculated as `leave_entitled + leaves_accumulated - leaves_availed`

**Example Record**:

```
user_id: 5 (Manager user)
year: 2026
leave_entitled: 12
leaves_accumulated: 2 (from 2025)
leaves_availed: 3.5 (3 days pending + 0.5 half-day)
balance: 12 + 2 - 3.5 = 10.5
```

---

## API Endpoints for Manager Role

### Leave Management (Manager's own leaves)

- `GET /api/leaves/eligibility` - Check if Manager can apply
- `POST /api/leaves` - Apply for leave
- `GET /api/leaves/my-leaves` - Get own leaves with filters
- `GET /api/leaves/balance` - Get own leave balance
- `GET /api/leaves/history/:year` - Get historical leaves
- `PUT /api/leaves/:id` - Update pending leave
- `DELETE /api/leaves/:id` - Cancel pending leave
- `GET /api/leaves/department-colleagues` - Get colleagues from same department

### Leave Approval (for Employee leaves only, duration-based)

- `GET /api/leaves/pending` - Get pending Employee leaves to approve
- `POST /api/leaves/:id/approve` - Approve Employee's leave (≤ 2 days only)
- `POST /api/leaves/:id/reject` - Reject Employee's leave (≤ 2 days only)

### Note on Manager Approval

**Manager applies for leave → Management approves** (not handled by Manager endpoints; Management handles separately)

---

## Error Scenarios

### Scenario 1: Manager tries to approve another Manager's leave

**Request**: Manager user calls `POST /api/leaves/:id/approve` on a Manager's leave

**Response**:

```json
{
  "success": false,
  "message": "Only Management can approve Manager's leaves"
}
```

**HTTP Status**: 403 Forbidden

---

### Scenario 2: Manager tries to approve Employee's leave > 2 days

**Request**: Manager user calls `POST /api/leaves/:id/approve` on Employee's 5-day leave

**Response**:

```json
{
  "success": false,
  "message": "This leave requires Management approval (> 2 days)"
}
```

**HTTP Status**: 403 Forbidden

---

### Scenario 3: Manager successfully approves Employee's ≤ 2 day leave

**Request**: Manager user calls `POST /api/leaves/:id/approve` on Employee's 1-day leave

**Response**:

```json
{
  "success": true,
  "message": "Leave approved successfully",
  "data": { ... leave record with status: "Approved" ... }
}
```

**HTTP Status**: 200 OK

---

## Testing Checklist for Manager Role

- [ ] Manager can apply for leave
- [ ] Manager can view own leaves
- [ ] Manager can edit pending leaves
- [ ] Manager can delete pending leaves
- [ ] Manager can see leave balance
- [ ] Manager can approve Employee's ≤ 2 day leave
- [ ] Manager cannot approve Employee's > 2 day leave
- [ ] Manager cannot approve another Manager's leave
- [ ] Management can approve Manager's leave (any duration)
- [ ] Partial cancellation works for Manager's ongoing leaves
- [ ] Balance is restored when Manager cancels a leave
