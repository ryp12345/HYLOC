# Leave Management System - Employee Role Documentation

## Document Overview
This document details the leave application and management functionality for the **Employee Role** in the Hyloc-PMS Leave Management System. The Employee role represents regular staff members who can submit leave requests and manage their own leave entitlements.

---

## Table of Contents
1. [Business Rules Overview](#business-rules-overview)
2. [Database Schema & Models](#database-schema--models)
3. [Detailed Business Rules by Function](#detailed-business-rules-by-function)
4. [Access Control & Authorization](#access-control--authorization)
5. [Employee Workflow](#employee-workflow)
6. [API Endpoints](#api-endpoints)

---

## Business Rules Overview

### Summary for Employee Role

The Employee role represents the **applicant tier** in the leave management system with focused responsibilities:

| Rule # | Rule Description | Key Detail |
|--------|------------------|-----------|
| BR-1 | Leave Application Eligibility | **Only Employee role can apply for leave**; approval requires Manager or Management role |
| BR-2 | Automatic Supervisor Identification | System identifies supervisor automatically based on department and roles |
| BR-3 | Cannot Approve Leaves | Employees cannot approve anyone's leaves (including their own) |
| BR-4 | Leave Types & Duration | Full Day (1 day), Morning Half (0.5 days), Afternoon Half (0.5 days); Paid or Unpaid |
| BR-5 | Leave Balance Tracking | Automatic calculation: balance = (entitled + accumulated) - availed |
| BR-6 | Self-Service Cancellation | Can cancel own leaves only if in Pending status and future dates |

---

## Database Schema & Models

### Core Tables Used in New Architecture

#### 1. **users Table**
Stores all system users, including employees, managers, and HR personnel with extended profile information.

```


**Employee Perspective:**
- Each employee has one `users` record
- Email used for login
- ID used across all leave-related records
- Department_id must be populated for leave routing

---

#### 2. **roles Table**
Defines system roles and their names.



**System Roles:**
- `Employee`: Regular staff member (can apply for leave)
- `Manager`: Department manager (approves ≤ 2 day leaves)
- `Management`: Senior management (approves > 2 day leaves)
- `HR`: Human Resources (administrative override)
  ('HR': is now called 'Admin' role in new architecture)

**Employee Context:**
- Employees have Employee role
- May also have Manager role (rare, employee who manages others)
- Cannot have Management or HR roles

---

#### 3. **user_roles Table (Pivot/Junction Table)**
Links users to their assigned roles with status tracking.





**For Each Employee:**
- Minimum one record: user_id → Employee role_id (status = 'Active')
- Optional additional record: user_id → Manager role_id (if they manage others)
- Never has Management or HR roles

---





**Employee Context:**
- Employees belong to departments
- Department determines their Manager (supervisor in same department)
- Used for routing leave approvals to appropriate Manager

---

#### 5. **leaves Table (Core Leave Application Data)**
Stores individual leave requests submitted by employees.




**Employee Interactions:**
- Employees create new records when submitting leave requests
- Can update (PUT) leave only if status = 'Pending'
- Can delete (DELETE) leave only if status = 'Pending' and future dates
- Cannot modify approved/rejected leaves
- Cannot change status field (only Manager/Management/HR can)

---

#### 6. **leaves_entitlement Table (Leave Balance Tracking)**
Tracks leave entitlements and usage per employee per calendar year.





**Constraints:**
- UNIQUE(user_id, year): Only one entitlement record per employee per year

**Calculated Field (Not Stored):**
```
leave_balance = leave_entitled + leaves_accumulated - leaves_availed
```

**Employee Perspective:**
- Can view their own balance anytime
- API: `GET /api/leaves/balance`
- Shows: entitled, accumulated, availed, balance
- Cannot modify their entitlement (HR function only)
- Balance updated automatically when applying/cancelling leave

---

### Model Relationships

```
User (id = INTEGER)
  ├─ hasMany UserRole (Link to roles)
  ├─ hasMany Leave (All leave requests by this user)
  └─ hasMany LeaveEntitlement (Leave balance records per year)

Role
  ├─ 'Employee' role
  └─ hasMany UserRole

UserRole
  ├─ belongsTo User
  └─ belongsTo Role

Department
  └─ hasMany User (employees in department)

Leave
  └─ belongsTo User (employee who applied)

LeaveEntitlement
  └─ belongsTo User (employee's entitlement)
```

---

## Detailed Business Rules by Function

### BR-1: Leave Application Eligibility

**Rule:** Only employees with the **Employee** role can apply for leave.

#### Eligibility Requirements:
1. User must exist in `users` table
2. User must have active Employee role in `user_roles` table
   - user_roles entry with role = 'Employee'
   - status = 'Active'
3. User must be logged in with current role = 'Employee'

#### Non-Eligible Users:
- Users with only Manager role (cannot apply)
- Users with Management role (cannot apply)
- Users with HR() role (cannot apply)
- Users without active Employee role (cannot apply)

#### Application Process:
```
Employee clicks "Apply for Leave"
    ↓
System checks: Does current user have Employee role?
    ↓ Yes                              ↓ No
Form enabled               Error message displayed
Apply button active        "Only Employee role can apply"
    ↓                      Form disabled
User submits form         Submit button disabled
    ↓
Server validates
  ✓ User has Employee role
  ✓ from_date valid
  ✓ to_date valid
  ✓ leave_reason provided
    ↓
Leave record created with status = 'Pending'
leaves_availed automatically increased
    ↓
Success confirmation
```

---

### BR-2: Automatic Supervisor Identification
Employee's supervisor is Manager in same department
**Rule:** System automatically identifies supervisor for each employee based on their role and department.

#### Supervisor Identification Logic:

**Case A: Employee has Manager role**
```
Employee role: Manager
    ↓
Supervisor = Any Management role user
Result: First available Management user
```

**Case B: Employee does NOT have Manager role**
```
Employee role: Non-Manager (regular employee)
    ↓
Supervisor = Manager in same department
Result: Manager assigned to employee's department
```

#### How Supervisor is Used:
1. When employee submits leave request
2. System identifies supervisor automatically
3. Leave appears in supervisor's "Pending Approvals" queue
4. Supervisor can approve/reject

#### Employee Visibility:
- System can provide supervisor info via API
- Endpoint: `GET /api/leaves/supervisor`
- Shows who will approve their leave request

#### Escalation for > 2 Days:
```
Manager receives leave request > 2 days
    ↓
Cannot approve directly
    ↓
Auto-escalates to Management role
    ↓
Management role receives in queue
    ↓
Management can approve/reject without supervisor check
```

---

### BR-3: Cannot Approve Leaves

**Rule:** Employees cannot approve any leave requests, including their own.

#### Access Restrictions:
- Employee role cannot access approval endpoints
- `POST /api/leaves/:id/approve` → Returns 403 Forbidden
- `POST /api/leaves/:id/reject` → Returns 403 Forbidden
- Approval buttons not displayed in UI for Employee role

#### Rationale:
- Only Manager/Management/HR can approve
- Prevents conflicts of interest
- Ensures hierarchical control
- Maintains audit trail (approved_by shows authority)

---

### BR-4: Leave Types & Duration

**Rule:** Employees can request different leave durations and types.

#### Leave Duration Options:

**Full Day**
- Represents: Entire workday absence
- Credited Days: 1.0 per day
- Format: `from_date` to `to_date` (any date range)
- Calculation: Inclusive count of dates
  - Jan 1 to Jan 3 = 3 full days
  - Jan 1 to Jan 1 = 1 full day

**Morning Half**
- Represents: Only morning absence (afternoon works)
- Credited Days: 0.5
- Format: `from_date` = `to_date` (same day only)
- Constraint: Cannot span multiple days

**Afternoon Half**
- Represents: Only afternoon absence (morning works)
- Credited Days: 0.5
- Format: `from_date` = `to_date` (same day only)
- Constraint: Cannot span multiple days

#### Leave Type Options:

**Paid**
- Default type
- Deducts from leave balance
- Updates `leaves_availed` when applied
- Most common leave type

**Unpaid**
- Does not deduct from balance
- `leaves_availed` not updated
- Used for special circumstances

---

### BR-5: Leave Balance Tracking & Calculation

**Rule:** Leave balance is automatically calculated from entitlement data.

#### Formula:
```
Leave Balance = (leave_entitled + leaves_accumulated) - leaves_availed
```

#### Components Explained:

**leave_entitled**
- Annual allocation
- Default: 12.0 days/year
- Set at beginning of calendar year

**leaves_accumulated**
- Carryover from previous year
- Usually set at year start
- May have maximum limit

**leaves_availed**
- Cumulative days used this year
- Includes: Pending, Approved, and sometimes Rejected leaves
- Increases when employee applies for leave
- Decreases when employee cancels leave

#### Automatic Updates:

**When Leave is Applied:**
```sql
UPDATE leaves_entitlement 
SET leaves_availed = leaves_availed + :credited_days
WHERE user_id = :user_id AND year = EXTRACT(YEAR FROM NOW())
```

**When Leave is Cancelled:**
```sql
UPDATE leaves_entitlement 
SET leaves_availed = leaves_availed - :cancelled_days
WHERE user_id = :user_id AND year = EXTRACT(YEAR FROM NOW())
```

#### Employee Access:
- **View Balance:** `GET /api/leaves/balance`
- **When:** Anytime (real-time calculation)
- **Frequency:** Can check multiple times daily
- **Displays:**
  - `leave_entitled`: Annual allocation
  - `leaves_accumulated`: Carryover
  - `leaves_availed`: Used so far
  - `leave_balance`: Available remaining

---

### BR-6: Self-Service Leave Cancellation

**Rule:** Employees can cancel their own leave requests, but only for future dates and pending status.

#### Cancellation Eligibility:
1. User must be the leave applicant (user_id matches)
2. Leave status must be 'Pending'
3. At least some of the leave must be in the future

#### Cancellation Types:

**Full Cancellation (All Future)**
```
Example:
  Leave: March 15-20 (6 days)
  Cancelled on: March 10
  Action: Delete entire leave request
  Result: Restore 6.0 days to balance
```

**Partial Cancellation (Mixed Past/Future)**
```
Example:
  Leave: March 15-20 (6 days)
  Cancelled on: March 17 (morning)
  Today: March 17
  Yesterday: March 16
  
  Retained: March 15-16 (2 days - past)
  Cancelled: March 17-20 (4 days - future)
  Result: Restore 4.0 days to balance
```

**No Cancellation (All Past)**
```
Example:
  Leave: March 10-15 (6 days)
  Cancelled on: March 20
  Action: Cancellation not allowed
  Error: "Cannot cancel leaves that have already been consumed"
```

---

## Employee Workflow

### Complete Leave Request Lifecycle

#### Phase 1: Application
```
Employee clicks "Apply for Leave"
    ↓
Fill in leave request form
    ↓
Submit form
    ↓
System validates
    ↓
Leave record created (status = 'Pending')
leaves_availed updated
    ↓
Confirmation displayed
```

#### Phase 2: Pending Approval
```
Leave in Pending Status
    ↓
Supervisor identified automatically
    ↓
Leave appears in supervisor's queue
    ↓
Supervisor approves/rejects
    ↓
Status updated
```

#### Phase 3: Post-Approval
```
Approved Status
    ↓
Leave confirmed
Cannot be edited
    ↓
OR
    ↓
Rejected Status
    ↓
Leave denied
Can resubmit new request
```

#### Phase 4: Leave Consumption
```
Leave date arrives
    ↓
Employee is absent
    ↓
Cannot cancel (past dates)
```

---

## Access Control & Authorization

### Employee Role Permissions Matrix

| Function | Employee | Manager | Management | HR |
|----------|----------|---------|------------|-----|
| Apply for Leave | ✓ | ✗ | ✗ | ✗ |
| View Own Leaves | ✓ | ✓ | ✓ | ✓ |
| View Own Balance | ✓ | ✓ | ✓ | ✓ |
| View Pending (others) | ✗ | ✓ (dept) | ✓ (all) | ✓ |
| Approve Leave | ✗ | ✓ (supervisor) | ✓ (>2 days) | ✓ |
| Reject Leave | ✗ | ✓ (supervisor) | ✓ (>2 days) | ✓ |
| Update Own (Pending) | ✓ | ✓ | ✓ | ✓ |
| Cancel Own (Pending) | ✓ | ✓ | ✓ | ✓ |
| Cancel Others' | ✗ | ✗ | ✗ | ✓ |
| Manage Entitlements | ✗ | ✗ | ✗ | ✓ |

---


---

## Summary

The Employee role is the **primary initiator** of leave requests with:
- ✓ Ability to submit leave requests
- ✓ Self-service leave cancellation (pending, future only)
- ✓ Real-time balance visibility
- ✓ Leave history and tracking
- ✓ Cannot approve leaves (prevents conflicts)
- ✓ Automatic supervisor identification
- ✓ Flexible duration and type options

Employee interacts with the system through:
1. **Apply** → Submit leave request
2. **Monitor** → Check status in pending queue
3. **Manage** → Update or cancel pending leaves
4. **View** → See balance and history
5. **Receive** → Notification of approval/rejection(Dont implement for now. We'll see later)

The Employee role provides the foundation of the leave management workflow, with oversight from Manager, Management, and HR roles as appropriate.
