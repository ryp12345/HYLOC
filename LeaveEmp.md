# Leave Management - Employee and Manager Role Documentation (Leave Application Perspective)

## Role Definition

**Employee Role and Manager Role**: Individual contributor role with the ability to apply for, view, and manage their own leave requests.

---

## Overview

The Employee and Manager role is the **only role that can apply for leave** in the system. User can:

1. Apply for new leave requests
2. View their own pending and approved leaves
3. View their leave balance for the current year
4. Modify (update) their own pending leave requests
5. Cancel (delete) their own pending leave requests
6. Access calendar view integrated with their leave information
7. Employee role cannot approve/reject leaves (not authorized)
8. Cannot view other employees' leave information

---

## Business Rules

### Rule 1: Users Can Apply for Leave

**Condition**: ONLY users with the current active role of `'Employee'` and 'Manager' can apply for leave.

**Rationale**: Leave applications are individual benefit claims tied to employment status.

**Implementation**:

- `evaluateApplyEligibility()` function checks: `req.user.role === 'Employee'`
- If user's current role is Management → 403 Forbidden
- If user's current role is Employee or Manager → Allowed to proceed

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

**Condition**: Users  leave balance is tracked in `leaves_entitlement` table and updated automatically.

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

- When users of role Employee or Manager cancels a pending leave application
- System decreases: `leaves_availed -= credited_days`
- Effect: Restores balance
- Only applicable: Leaves in 'Pending' status
- Cannot cancel already-approved leaves (no restoration)

---

### Rule 5: Can Only Manage Own Leaves

**Condition**: User can only view, edit, and delete their own leave records.

**Implementation**:

- Prevents viewing other users' leaves
- Prevents editing other employees' leaves
- Prevents deleting other employees' leaves
- User of Manager role  can view user of Employee role's leave record. He can approve/reject but cannot edit(subject to condition: leave duration is <= 2 days)

---

### Rule 6: Can Only Edit Pending Leaves

**Condition**: User of Employee and Manager role can only modify (update) leave requests that are in 'Pending' status.

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

**Condition**: Users of roles Employee and Manager can only cancel (delete) leave requests in 'Pending' status.

**Rationale**: Approved leaves are decisions made by management.

**Implementation**:

- If not Pending → 400 Bad Request: "Can only delete pending leaves"
- If Pending → Allow deletion

---

### Rule 8: Partial Cancellation for Ongoing Leaves

**Condition**: Users of roles Employee and Manager cancels a leave that's currently in progress (some dates past, some future), system performs partial cancellation.

**Logic**:

- Get today's date
- Parse leave from_date and to_date
- If `from_date >= today`: Full cancellation (all dates future)
- If `to_date < today`: Cannot cancel (all dates already consumed)
- If `from_date < today` AND `to_date >= today`: Partial cancellation
  - Keep past dates as leaves (since leave was already availed)
  - Cancel future dates(theyare not considered as leaves applied and were not availed)
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

Days to keep(leaves availed): Jan 15-17 (3 days)
Days to cancel(no leave applied): Jan 18-20 (3 days)
Update to_date(leave availed): Jan 17
Restore: 3 days to leaves_availed
```

---

### Rule 9: Leave Request Information

**Condition**: Users  must provide certain information with leave application.

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

## Eligibility Determination

**Conditions Checked**:

Has user  in active state : in the users table the status column value should be 'active'

---

## Calendar Integration

### Features for Employee and Manager Users:

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

### Data Flow(for Employee role):

- User navigates to `/employee/leaves`
- System loads `EmployeeCalendar.jsx` component
- Displays calendar with only current users leaves
- Shows all months/years users has leaves in calendar
- Includes leave application form integrated into calendar

---

## Database Schema Details

### Tables Involved (In New Architecture):

#### 1. `users` Table

---

#### 2. `roles` Table

**Role**: Defines available roles in system

---

#### 3. `user_roles` Table (Pivot/Junction)

**Role**: Links employee users to their  role :Employee/Manager/Management
**Critical Check**:

- `roles.name = 'Employee' or role`
- Only employees meeting both criteria can apply for leave

---

#### 4. `leaves` Table

**Key Columns for user of Employee role**:

- `user_id`: Employee's id (employee creates with this set to their own ID)
- `from_date`: Start date of leave
- `to_date`: End date of leave
- `leave_reason`: Why the leave is needed
- `leave_duration`: 'Full Day', 'Morning Half', 'Afternoon Half'
- `credited_days`: Calculated by system (0.5 for half-day, 1+ for full days)
- `status`: Employee can see 'Pending', 'Approved', 'Rejected'
- `approved_by`: ID of manager/management who approved (null if pending/rejected)

---

#### 5. `leaves_entitlement` Table

**Role**: Tracks users of role Employee and Manager leave balance for each calendar year

**Columns**:

- `user_id`: Employee's id
- `year`: Calendar year (e.g., 2024, 2025)
- `leave_entitled`: Annual allocation (default 12 days)
- `leaves_accumulated`: Rollover days from previous year
- `leaves_availed`: Total days applied for (pending + approved + rejected)

**Important Behavior**:

- Record created on first leave application
- Updated whenever users of role Employee and Manager applies/cancels/updates leaves
- `leaves_availed` includes pending AND rejected (conservative)
- Balance calculation: `(leave_entitled + leaves_accumulated) - leaves_availed`

**Example**:

```
Entitlement Record:
  user_id: 10
  year: 2024
  leave_entitled: 12.0
  leaves_accumulated: 2.0 (from 2023 rollover)
  leaves_availed: 5.5 (3 days approved + 2.5 days pending)

Available Balance: (12 + 2) - 5.5 = 8.5 days
```

---

#### 6. `departments` Table (For Reference)

**Role**: Not directly used by employees for leave application
**Future Use**: May link to employees for supervisor identification in new architecture

---

### Entity Relationships:

```
User (Employee) (users)
  │
  ├─→ user_roles ──→ roles (where name = 'Employee')
  │
  ├─→ Leave (1:Many)
  │   ├─ from_date
  │   ├─ to_date
  │   ├─ status (set by managers)
  │   └─ approved_by (manager)
  │
  └─→ LeaveEntitlement (1:Many, one per year)
      ├─ leave_entitled (12.0)
      ├─ leaves_accumulated (rollover)
      └─ leaves_availed (tracked from applies)
```

---

## API Endpoints - Employee and Manager Role

### 1. Apply for Leave

**Role**: Employee only

**Server Processing**:

1. Check eligibility: Employee and Manager role
2. Validate dates (format, sequence)
3. Calculate credited_days based on duration
4. Create leave record with status = 'Pending'
5. Deduct from leaves_availed
6. Return created leave

**Error Responses**:

// Not Employee role
{
  "message": "Only Employee and Manager role can apply for leave",
  "canApply": false
}

// Invalid dates
{
  "message": "Invalid date format. Expect YYYY-MM-DD"
}

// to_date before from_date
{
  "message": "to_date cannot be earlier than from_date"
}

// Missing required field
{
  "message": "Missing required fields: from_date, leave_reason"
}

---

### 2. View My Leave Balance

**Role**: Employee and Manager (for themselves)

**Response**:

```json
{
  "leave_entitled": 12.0,
  "leaves_accumulated": 2.0,
  "leaves_availed": 5.5,
  "leave_balance": 8.5
}
```

---

### 3. View My Leaves

**Endpoint**: `GET /api/leaves/my-leaves`
**Role**: Employee and Manager (for themselves)

**Response**: Array of all leaves belonging to current user

```json
[
  {
    "id": 1,
    "user_id": 10,
    "from_date": "2024-02-20",
    "to_date": "2024-02-22",
    "leave_duration": "Full Day",
    "credited_days": 3,
    "leave_reason": "Personal family matters",
    "status": "Pending",
    "created_at": "2024-02-10T10:30:00Z"
  },
  {
    "id": 2,
    "user_id": 10,
    "from_date": "2024-01-10",
    "to_date": "2024-01-12",
    "leave_duration": "Full Day",
    "credited_days": 3,
    "leave_reason": "Annual leave",
    "status": "Approved",
    "approved_by": 20,
    "created_at": "2024-01-05T14:20:00Z"
  }
]
```

---

### 4. Get Leave History for Calendar Year

**Endpoint**: `GET /api/users/:userId/leave-history?year=YYYY`
**Role**: Employee (for self), Manager, Management
**Authorization**: Self OR admin role

**Response**: All leaves in calendar year

```json
[
  { /* leave object */ },
  { /* leave object */ }
]
```

---

### 5. Update Pending Leave

**Endpoint**: `PUT /api/leaves/:id`
**Role**: Employee and Manager (only own leaves in Pending status)

**Request Body**: Any fields to update

```json
{
  "to_date": "2024-02-23",
  "leave_reason": "Extended family visit",
  "alternate_person": "Mike Johnson"
}
```

**Server Processing**:

1. Verify leave exists
2. Verify current user is owner: `row.user_id === req.user.id`
3. Verify status is Pending: `row.status === 'Pending'`
4. Calculate old vs new credited_days
5. If credited_days changed, adjust leaves_availed
6. Update leave record
7. Return updated leave

**Response**: Updated leave object

**Errors**:

```json
// Not owner
{
  "message": "Forbidden"
}

// Not pending
{
  "message": "Can only update pending leaves"
}

// Not found
{
  "message": "Not found"
}
```

---

### 6. Cancel (Delete) Pending Leave

**Endpoint**: `DELETE /api/leaves/:id`
**Role**: Employee and Manager (only own leaves in Pending status)

**Server Processing**:

1. Verify leave exists
2. Verify current user is owner
3. Verify status is Pending
4. Check leave dates:
   - If all dates in future: Full cancellation
   - If all dates in past: Cannot cancel
   - If mixed: Partial cancellation
5. Restore appropriate leaves_availed
6. Delete or update leave record
7. Return result

**Full Cancellation Response**:

```json
{
  "message": "Leave cancelled completely",
  "type": "full"
}
```

**Partial Cancellation Response**:

```json
{
  "message": "Leave partially cancelled. 3 day(s) cancelled, 1 day(s) retained.",
  "type": "partial",
  "cancelledDays": 3,
  "retainedDays": 1
}
```

**Error Responses**:

```json
// Cannot cancel past leave
{
  "message": "Cannot cancel leaves that have already been consumed"
}

// Not pending
{
  "message": "Can only delete pending leaves"
}
```

---

### 7. Check Eligibility

**Endpoint**: `GET /api/leaves/eligibility`
**Role**: Any (typically Employee checking before apply)

**Response**:

```json
{
  "canApply": true,
  "isEmployeeRole": true,
  "isStaff": true,
  "hasEmpId": true,
  "currentRole": "Employee"
}
```

---

## Leave Application Workflow

### Complete Workflow: Apply → Approve → View

**Step 1: User Applies**

```

 1. Employee opens calendar at /employee/leaves
Manager opens calendar at /manager/leaves
2. Selects date range for leave
3. Fills in:
   - from_date: "2024-03-15"
   - to_date: "2024-03-17"
   - leave_duration: "Full Day"
   - leave_reason: "Holiday celebration"
   - alternate_person: "Colleague name"

4. System validates:
   - User role can be Employee or Manager(depends user) ✓
   - Dates are valid ✓
   - from_date < to_date ✓

5. System calculates:
   - credited_days = 3
   - leave balance check: Has 8.5 days available ✓

6. System creates Leave record:
   - status = 'Pending'
   - user_id = 10 (10 is an example)
   - approved_by = null

7. System updates LeaveEntitlement:
   Example:
   - leaves_availed += 3
   - New balance = 8.5 - 3 = 5.5

8. Response to employee:
   - Success message
   - Leave now appears in calendar (yellow badge)
```

---

**Step 2: Manager Reviews**

```
1. Manager views /manager/leaves
2. Sees employee's 3-day leave in pending list
3. Manager reviews:
   - Duration: 3 days (> 2 days, cannot approve)
   - OR Duration: 2 days or less (can approve if supervisor)

4. If 3 days:
   - Manager cannot approve
   - Leaves for Management review

5. If 2 days or less:
   - Manager clicks "Approve"
   - System verifies Manager is supervisor ✓
   - System updates: status = 'Approved', approved_by = manager id

6. Employee sees:
   - Leave now shows as "Approved" (green badge)
   - Can no longer edit or cancel it
```

---

**Step 3: Employee Views Approved Leave**

```
1. Employee navigates to calendar
2. Sees leave with "Approved" status (green badge)
3. Can view leave details
4. Cannot modify or cancel approved leave
5. Leave dates appear on calendar
6. On leave dates:
   - Employee is marked as unavailable
   - Managers see employee has approved leave
```

---

### Scenario: Employee Modifies Pending Leave(Scenario cited below is for user of role Employee applying for a leave and Manager approving/rejecting it.) 

### If a user of role Manager had applied the user of role Management would be approving/rejecting it.

```
1. Employee applies for 2-day leave (Mar 15-16)
   - status = 'Pending'
   - leaves_availed += 2
   - balance = 8.5 - 2 = 6.5 days

2. Manager hasn't approved yet (still pending)

3. Employee realizes needs 3 days instead
   - Clicks "Edit" on pending leave
   - Changes to_date from Mar 16 → Mar 17
   - New credited_days = 3

4. System processes update:
   - old credited_days = 2
   - new credited_days = 3
   - difference = +1 day

5. System adjusts balance:
   - leaves_availed = 2 + 1 = 3
   - balance = 8.5 - 3 = 5.5 days

6. System returns updated leave
7. Manager sees updated 3-day leave request
8. If > 2 days, escalated to Management
```

---

### Scenario: Users of role Employee and Manager Cancels Partially Consumed Leave(Below example if for user of role Employee but a similar situation holds good for Manager also but user of role Management approves/rejects)

```
Timeline: Jan 18 (today), Jan 15-20 leave exists

1. Employee clicks "Cancel" on leave
2. System checks dates:
   - from_date (Jan 15) < today ✓
   - to_date (Jan 20) >= today ✓
   → Partial cancellation case

3. System calculates:
   - Days to keep: Jan 15-17 (3 days worked)
   - Days to cancel: Jan 18-20 (3 days remaining)
   - Original credited_days = 6

4. System updates:
   - to_date = Jan 17 (yesterday)
   - credited_days = 3 (for past days only)
   - leaves_availed -= 3 (restore cancelled portion)

5. Example balance impact:
   - Before cancel: leaves_availed = 5, balance = 7
   - After cancel: leaves_availed = 2, balance = 10

6. System returns:
   {
     "message": "Leave partially cancelled. 3 day(s) cancelled, 3 day(s) retained.",
     "type": "partial",
     "cancelledDays": 3,
     "retainedDays": 3
   }

7. Employee can see:
   - Leave still exists (Jan 15-17)
   - Shows 3 days instead of 6
   - Cancelled portion not displayed
```

---

## State Diagram: Leave Lifecycle from Employee Perspective

```
                    ┌─────────────────────────┐
                    │ Apply for Leave         │
                    │ status = 'Pending'      │
                    │ leaves_availed += days  │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │ Edit     │  │ Wait for │  │ Cancel   │
              │ Leave    │  │ Approval │  │ (Delete) │
              │(Pending) │  │          │  │(Restore) │
              └────┬─────┘  └────┬─────┘  └──────────┘
                   │             │
              ┌────┴─────────────┴───┐
              │                      │
              ▼                      ▼
         ┌──────────────┐      ┌─────────────┐
         │ APPROVED     │      │ REJECTED    │
         │ (Final)      │      │ (Final)     │
         │ Cannot edit  │      │ Cannot edit │
         │ Cannot del   │      │ Cannot del  │
         └──────────────┘      └─────────────┘
```

---

## Key Restrictions for Employee Role

| Action                | Allowed | Reason                                    |
| --------------------- | ------- | ----------------------------------------- |
| Apply for leave       | ✓ YES  | Core function                             |
| View own leaves       | ✓ YES  | Need to track status                      |
| Edit pending leave    | ✓ YES  | Flexible in planning                      |
| Delete pending leave  | ✓ YES  | Can cancel requests                       |
| View own balance      | ✓ YES  | Know available days                       |
| Approve/reject        | ✗ NO   | Not authorized for users of Employee role |
| View others' leaves   | ✗ NO   | Privacy protection                        |
| Modify others' leaves | ✗ NO   | Data integrity                            |
| Modify approved leave | ✗ NO   | Already approved                          |
| Delete approved leave | ✗ NO   | Already approved                          |
| Set status            | ✗ NO   | Only managers can                         |

---

## Integration with Calendar

### Calendar Component: `EmployeeCalendar.jsx`

**Location**: `client/src/pages/employee/leaves/EmployeeCalendar.jsx`

**Features**:

1. **Monthly View**: Display employee's leaves in month grid
2. **Weekly View**: Show week-by-week leave breakdown
3. **Color Coding**:
   - Green: Approved leaves
   - Yellow: Pending leaves
   - Red: Rejected leaves (reference only)
4. **Interactive Elements**:
   - Click date to apply for leave
   - Click badge to view/edit leave details
   - View balance information in sidebar

**Props**:

```javascript
{
  leaves: [],              // Employee's own leaves only
  currentMonth: Date,      // Currently displayed month
  onMonthChange: Function, // Navigate months
  viewMode: 'month',       // 'month' or 'week'
  canApply: true,          // Based on eligibility
  leaveBalance: {          // From leaves_entitlement
    leave_entitled: 12,
    leaves_accumulated: 0,
    leaves_availed: 3,
    leave_balance: 9
  }
}
```

---

## Performance Considerations(Dont implement/check  now. Keep it pending)

### Database Indexes Needed:

1. `leaves(user_id, status)` - Filter employee's leaves
2. `leaves(user_id, created_at)` - Latest leaves first
3. `leaves(from_date, to_date)` - Date range queries
4. `leaves_entitlement(user_id, year)` - UNIQUE constraint exists
5. `user_roles(user_id, role_id, status)` - Fast role verification

### Caching(Dont implement/check  now. Keep it pending):

- Cache leave balance for 5 minutes per user
- Invalidate on: apply, cancel, update
- Cache eligibility check for user's session

---

---

## Summary

The **Employee and Manager roles** represent the **individual contributor** who needs to take leave. Users have full control over their own leave applications while they remain pending, but cannot modify approved leaves. The system automatically tracks leave balance through the leaves_entitlement table, preventing over-application. The calendar interface provides an integrated view of leaves with full CRUD capabilities for pending requests.

---

*Last Updated: January 29, 2026*
*Architecture Version: 2.0 (Post Staff/Designation Removal)*
