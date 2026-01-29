# Leave Management System - Management Role Documentation

## Document Overview
This document details the leave approval and management functionality for the **Management Role** in the Hyloc-PMS Leave Management System. The Management role represents senior management personnel who have authority over long-duration leave requests (greater than 2 days) and serve as the escalation tier in the approval hierarchy.

---

## Table of Contents
1. [Business Rules Overview](#business-rules-overview)
2. [Database Schema & Models](#database-schema--models)
3. [Detailed Business Rules by Function](#detailed-business-rules-by-function)
4. [Access Control & Authorization](#access-control--authorization)
5. [Management Workflow](#management-workflow)
6. [API Endpoints](#api-endpoints)

---

## Business Rules Overview

### Summary for Management Role

The Management role represents the **escalation tier** in the leave management system with authority over longer leave requests:

| Rule # | Rule Description | Key Detail |
|--------|------------------|-----------|
| BR-1 | Leave Application Eligibility | Only Employee role can apply; Management cannot apply for leave |
| BR-2 | Department Assignment | Management users are escalation authority for leaves > 2 days |
| BR-3 | Escalation Authority | Management approves/rejects leaves > 2 days without supervisor verification |
| BR-4 | Leave Types & Duration | Full Day (1 day), Morning Half (0.5 days), Afternoon Half (0.5 days); Paid or Unpaid |
| BR-5 | Leave Balance Tracking | Automatic calculation: balance = (entitled + accumulated) - availed |
| BR-6 | Cannot Cancel Others' Leaves | Only HR can cancel approved leaves; Management cannot |

---

## Database Schema & Models

### Core Tables Used in New Architecture

#### 1. **users Table**
Stores all system users including employees, managers, and management personnel with extended profile information.

```sql
CREATE TABLE IF NOT EXISTS public.users (
  id INTEGER NOT NULL PRIMARY KEY,
  email CHARACTER VARYING(255) NOT NULL UNIQUE,
  empid CHARACTER VARYING(50),
  first_name CHARACTER VARYING(100),
  middle_name CHARACTER VARYING(100),
  last_name CHARACTER VARYING(100),
  department_id INTEGER REFERENCES departments(id),
  phone CHARACTER VARYING(20),
  address TEXT,
  blood_group CHARACTER VARYING(5),
  password CHARACTER VARYING(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

**Columns:**
- `id` (INTEGER, PRIMARY KEY): Unique identifier for each user
  - Manually assigned or auto-generated integer
  - Used to uniquely identify employees in system
- `email` (VARCHAR 255): Unique email address
  - Used for login and communication
  - Must be unique across all users
- `empid` (VARCHAR 50): Employee identification number
  - Unique employee code/badge number
  - May be null for non-employee users
- `first_name` (VARCHAR 100): Employee's first name
- `middle_name` (VARCHAR 100): Employee's middle name (optional)
- `last_name` (VARCHAR 100): Employee's last name
- `department_id` (INTEGER, FOREIGN KEY): Reference to departments table
  - Links user to their assigned department
  - Used for supervisor identification and leave routing
  - Foreign key constraint ensures department exists
  - Can be null for non-department users
- `phone` (VARCHAR 20): Contact phone number
- `address` (TEXT): Physical address
- `blood_group` (VARCHAR 5): Blood group (e.g., O+, B-, AB)
- `password` (VARCHAR 255): Encrypted password
  - Stored as hash (never plain text)
  - Verified during authentication
- `created_at` (TIMESTAMP): When account was created
- `updated_at` (TIMESTAMP): When account was last modified

**Management User Context:**
- Management users have Management role in user_roles table
- Have department_id assigned (required for organizational structure)
- Cannot apply for leave themselves (BR-1)
- Identified as escalation authority for leave approvals

---

#### 2. **roles Table**
Defines system roles and their names.

```sql
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
)
```

**Columns:**
- `id` (INTEGER, PRIMARY KEY): Unique role identifier
- `name` (VARCHAR 50): Role name (must be unique)

**System Roles:**
- `Employee`: Regular staff member (can apply for leave)
- `Manager`: Department manager (approves ≤ 2 day leaves)
- `Management`: Senior management (approves > 2 day leaves)
- `HR`: Human Resources (administrative override)

**Management Role Assignment:**
- Users assigned Management role have escalation approval authority
- Management role is exclusive to senior management users
- Cannot coexist with Employee or Manager roles on same user

---

#### 3. **user_roles Table (Pivot/Junction Table)**
Links users to their assigned roles with status tracking.

```sql
CREATE TABLE user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  role_id INTEGER NOT NULL REFERENCES roles(id),
  status VARCHAR(20) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
)
```

**Columns:**
- `id` (INTEGER, PRIMARY KEY): Unique record identifier
- `user_id` (INTEGER, FOREIGN KEY): Reference to users table
  - Links this role assignment to a specific user
  - Foreign key constraint ensures user exists
- `role_id` (INTEGER, FOREIGN KEY): Reference to roles table
  - Links this assignment to a specific role
  - Foreign key constraint ensures role exists
- `status` (VARCHAR 20): Current status of role assignment
  - Values: 'Active', 'Inactive'
  - 'Active' = user currently has this role
  - 'Inactive' = user previously had this role (historical)
- `created_at` (TIMESTAMP): When role was assigned
- `updated_at` (TIMESTAMP): When role assignment was modified

**For Management Users:**
- One record: user_id → Management role_id (status = 'Active')
- Cannot have Employee or Manager roles simultaneously
- May have historical inactive records from previous role assignments

---

#### 4. **departments Table**
Stores organizational departments and their metadata.

```sql
CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  dept_name VARCHAR(255) NOT NULL,
  dept_shortname VARCHAR(255) NOT NULL,
  status VARCHAR(255) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
)
```

**Columns:**
- `id` (INTEGER, PRIMARY KEY): Unique department identifier
- `dept_name` (VARCHAR 255): Full department name
- `dept_shortname` (VARCHAR 255): Short code/abbreviation
- `status` (VARCHAR 255): Department status ('active', 'inactive')
- `created_at` (TIMESTAMP): When department was created
- `updated_at` (TIMESTAMP): Last modification timestamp

**Management Context:**
- Management users typically have no department_id (null)
- They are organization-wide escalation authority
- Department structure used for Manager-level approvals
- Management overrides department boundaries for > 2 day leaves

---

#### 5. **leaves Table (Core Leave Application Data)**
Stores individual leave requests submitted by employees.

```sql
CREATE TABLE leaves (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  alternate_person VARCHAR(100),
  additional_alternate VARCHAR(100),
  leave_reason VARCHAR(255),
  leave_duration VARCHAR(50) DEFAULT 'Full Day',
  leave_type VARCHAR(20) DEFAULT 'Paid',
  available_on_phone BOOLEAN DEFAULT TRUE,
  approved_by INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  credited_days DECIMAL(4,1) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
)
```

**Columns:**
- `id` (INTEGER, PRIMARY KEY): Unique leave request identifier
- `user_id` (INTEGER, NOT NULL, FOREIGN KEY): Employee applying for leave
  - References users table
  - Only employees (Employee role) can create records here
- `from_date` (DATE): Leave start date (YYYY-MM-DD)
- `to_date` (DATE): Leave end date (YYYY-MM-DD)
- `alternate_person` (VARCHAR 100): Primary delegate/contact
- `additional_alternate` (VARCHAR 100): Secondary delegate/contact
- `leave_reason` (VARCHAR 255): Reason for absence (required)
- `leave_duration` (VARCHAR 50): Type of absence (Full Day, Morning Half, Afternoon Half)
- `leave_type` (VARCHAR 20): Category (Paid, Unpaid)
- `available_on_phone` (BOOLEAN): Availability during leave
- `approved_by` (INTEGER, FOREIGN KEY): User ID of approver (null until decision)
  - References users table
  - Set when leave is approved/rejected by Manager or Management
- `status` (VARCHAR 20): Current approval status (Pending, Approved, Rejected)
- `credited_days` (DECIMAL 4,1): Days deducted from entitlement
- `created_at` (TIMESTAMP): Request submission time

**Management Interactions:**
- View leaves with duration > 2 days
- Access escalated leaves from Manager approvals
- Approve/reject without further supervisor verification
- Cannot view personal leaves (Management cannot apply)

---

#### 6. **leaves_entitlement Table (Leave Balance Tracking)**
Tracks leave entitlements and usage per employee per calendar year.

```sql
CREATE TABLE leaves_entitlement (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  year INTEGER NOT NULL,
  leave_entitled DECIMAL(4,1) NOT NULL DEFAULT 12.0,
  leaves_accumulated DECIMAL(4,1) NOT NULL DEFAULT 0.0,
  leaves_availed DECIMAL(4,1) NOT NULL DEFAULT 0.0,
  CONSTRAINT leaves_entitlement_user_year_unique UNIQUE (user_id, year)
)
```

**Columns:**
- `id` (INTEGER, PRIMARY KEY): Unique record identifier
- `user_id` (INTEGER, NOT NULL, FOREIGN KEY): Employee reference
  - References users table
- `year` (INTEGER, NOT NULL): Calendar year
- `leave_entitled` (DECIMAL 4,1): Annual leave allocation (default 12.0 days)
- `leaves_accumulated` (DECIMAL 4,1): Carryover from previous year (default 0.0)
- `leaves_availed` (DECIMAL 4,1): Total leaves consumed this year (default 0.0)

**Constraints:**
- UNIQUE(user_id, year): Only one entitlement record per employee per year

**Calculated Field (Not Stored):**
```
leave_balance = leave_entitled + leaves_accumulated - leaves_availed
```

**Management Perspective:**
- Can view all employees' leave balances (organization-wide)
- Cannot modify entitlements (HR function only)
- Uses balance info when approving long-duration leaves

---

### Model Relationships

```
User (id = INTEGER)
  ├─ hasMany UserRole (Link to roles)
  ├─ hasMany Leave (Approvals as approved_by)
  └─ hasMany LeaveEntitlement (View all employee balances)

Role
  ├─ 'Management' role
  └─ hasMany UserRole

UserRole
  ├─ belongsTo User
  └─ belongsTo Role

Department
  └─ hasMany User (employees in department)

Leave
  ├─ belongsTo User (employee who applied)
  └─ belongsTo User (approver - approved_by field)

LeaveEntitlement
  └─ belongsTo User (employee's entitlement)
```

---

## Detailed Business Rules by Function

### BR-1: Leave Application Eligibility

**Rule:** Only employees with the **Employee** role can apply for leave. Management role users cannot apply.

#### Why Management Cannot Apply:
- Management personnel are **approvers**, not applicants
- Separation of duties: applicants and approvers must be different roles
- If Management needs leave, it must be processed by HR with override authority

#### Impact for Management Users:
- **Cannot** see "Apply for Leave" button in UI
- **Cannot** access leave application form
- **Cannot** submit leave requests through API
- **Must contact HR** for any leave needs
- If HR approves leave for Management user, it appears as HR override (not standard application)

#### System Validation:
```
User clicks "Apply for Leave"
    ↓
System checks current role
    ↓
If Management role → Error: "Only Employee role can apply for leave"
If Employee role → Form enabled, proceed to application
```

---

### BR-2: Department Assignment & Escalation Structure

**Rule:** Management role users are organization-wide escalation authority for leaves > 2 days.

#### Organizational Hierarchy for Leave Approvals:

```
Employee applies for leave
    ↓
    If leave ≤ 2 days
    ↓
    Routed to Manager (in same department as employee)
    Manager approves/rejects
    ↓
    
    If leave > 2 days
    ↓
    Auto-escalates to Management role
    Management reviews and decides
```

#### Management Role Characteristics:
- **Organization-wide authority**: Not limited to specific department
- **Override capability**: Can approve any leave > 2 days regardless of department
- **Escalation tier**: Receives leaves when Managers lack authority
- **No supervisor chain**: Management is final approval (before HR override)

#### Department Assignment:
- Management users typically have `department_id = NULL`
  - Indicates organization-wide scope
  - No department-level restrictions
  - Can access all department leaves

---

### BR-3: Escalation Authority & Approval Rules

**Rule:** Management approves/rejects leaves > 2 days without supervisor verification.

#### Escalation Process:

**Stage 1: Manager Review (≤ 2 days)**
```
Manager receives leave request
    ↓
If leave duration ≤ 2 days
    ↓
Manager can approve/reject directly
    ↓
Decision final for ≤ 2 days
```

**Stage 2: Management Review (> 2 days)**
```
Manager receives leave request > 2 days
    ↓
Cannot approve directly
    ↓
Auto-escalates to Management role
    ↓
Management receives in pending queue
    ↓
Management reviews request
    ↓
Management approves/rejects
    ↓
Decision final (unless HR overrides)
```

#### Management Approval Authority:
- **Full Decision Authority**: Can approve any leave > 2 days
- **No Verification Required**: No need to check with supervisor
  - Leaves > 2 days are pre-screened by Manager
  - Manager already verified employee eligibility
  - Management makes final decision
- **Reject Authority**: Can reject any leave > 2 days
  - No appeal required at Management level
  - Employee can resubmit after addressing concerns
  - HR can override rejection

#### Scope of Management Authority:
- All leaves > 2 days from any employee
- All departments' leaves > 2 days
- Cannot approve ≤ 2 day leaves (outside Management scope)
- Cannot modify approved leaves (edit function)

---

### BR-4: Leave Types & Duration Options

**Rule:** Employees can request different leave durations and types.

#### Leave Duration Categories:

**Full Day Leave**
- Represents: Entire workday absence
- Credited Days: 1.0 per day
- Format: `from_date` to `to_date` (any date range)
- Calculation: Inclusive count of dates
  - Example: Jan 1 to Jan 3 = 3 full days
  - Example: Jan 1 to Jan 1 = 1 full day

**Half-Day Leaves**
- **Morning Half**: Only morning absence (afternoon works)
  - Credited Days: 0.5
  - Format: `from_date` = `to_date` (same day only)
  - Constraint: Cannot span multiple days
- **Afternoon Half**: Only afternoon absence (morning works)
  - Credited Days: 0.5
  - Format: `from_date` = `to_date` (same day only)
  - Constraint: Cannot span multiple days

#### Leave Type Categories:

**Paid Leave**
- Default type for standard leave requests
- Deducts from annual leave balance
- Updates `leaves_availed` when applied
- Most common leave type

**Unpaid Leave**
- Does not deduct from balance
- `leaves_availed` not updated
- Used for special circumstances
- Requires HR approval or explicit policy

#### Management Review of Duration:
- Management focuses on > 2 day requests
- Duration affects approval routing (not approval authority)
- Type (Paid/Unpaid) visible in Management's approval interface

---

### BR-5: Leave Balance Tracking & Calculation

**Rule:** Leave balance is automatically calculated from entitlement data.

#### Balance Formula:
```
Leave Balance = (leave_entitled + leaves_accumulated) - leaves_availed
```

#### Components Explained:

**leave_entitled**
- Annual allocation for the calendar year
- Default: 12.0 days/year
- Set at beginning of calendar year
- Rarely changes (only policy updates)

**leaves_accumulated**
- Carryover balance from previous year
- Usually set at year start
- May have maximum limit based on policy
- Decreases as accumulated balance is used

**leaves_availed**
- Cumulative days consumed in this year
- Includes: Pending, Approved, and sometimes Rejected leaves
- Increases automatically when employee applies
- Decreases automatically when employee cancels (pending only)

#### Automatic Updates When Leaves are Processed:

**When Leave is Applied:**
```sql
-- System automatically updates
UPDATE leaves_entitlement 
SET leaves_availed = leaves_availed + :credited_days
WHERE user_id = :user_id AND year = EXTRACT(YEAR FROM NOW())
```

**When Leave is Cancelled (Pending Status):**
```sql
-- System automatically restores balance
UPDATE leaves_entitlement 
SET leaves_availed = leaves_availed - :cancelled_days
WHERE user_id = :user_id AND year = EXTRACT(YEAR FROM NOW())
```

#### Management Use of Balance Data:
- View employee's balance when reviewing leave request
- Check if employee has sufficient balance
- Use balance info to make approval decisions
- Cannot modify entitlement (HR-only function)

#### Real-Time Balance Visibility:
- Balance calculated on-demand from database
- Always current as of moment of view
- Includes pending leaves in availed count
- API endpoint: `GET /api/leaves/balance/:user_id`

---

### BR-6: Cannot Cancel Others' Leaves

**Rule:** Only HR can cancel approved or pending leaves created by other users.

#### Management Cancellation Restrictions:

**Management CANNOT:**
- Cancel other employees' leaves (any status)
- Cancel approved leaves (even if Management approved them)
- Cancel pending leaves (even those they're reviewing)

**Only HR CAN:**
- Cancel any leave (Pending or Approved status)
- Provide override for special circumstances
- Ensure system integrity with high-level authority

#### Rationale:
- **Audit Trail**: HR maintains final authority over cancellations
- **Accountability**: All cancellations tracked through HR
- **Policy Enforcement**: HR ensures policy compliance
- **Conflict of Interest**: Management cannot undo their own decisions

#### Management Actions Permitted:
- **Approve** pending leaves > 2 days
- **Reject** pending leaves > 2 days
- **View** all pending and approved leaves
- **Update own profile** and settings
- **View** all leave balances (read-only)

#### If Management Wants to Cancel a Leave:
```
Management initiates cancel request
    ↓
System routes to HR
    ↓
HR reviews request
    ↓
HR approves/denies cancellation
    ↓
If approved: HR cancels and restores balance
If denied: Management receives notification
```

---

## Management Workflow

### Complete Management Approval Lifecycle

#### Phase 1: Leave Escalation
```
Employee submits leave request > 2 days
    ↓
Manager receives in queue
    ↓
Manager checks duration
    ↓
If > 2 days: Auto-escalate to Management
    ↓
Management receives notification
```

#### Phase 2: Management Review
```
Management views pending leaves > 2 days
    ↓
Management reviews employee profile
    ↓
Management checks leave balance
    ↓
Management verifies dates and reason
    ↓
Management makes decision
```

#### Phase 3: Approval Decision
```
Decision Options:

1. APPROVE
    ↓
Leave status = 'Approved'
approved_by = Management user ID
Employee notified
Leave confirmed
    ↓

2. REJECT
    ↓
Leave status = 'Rejected'
approved_by = Management user ID
Employee notified
Balance restored
Employee can resubmit
```

#### Phase 4: Post-Approval
```
Leave Consumption Phase
    ↓
Leave date arrives
    ↓
Employee is absent
    ↓
Management cannot cancel
    ↓
Leave remains 'Approved'
```

---

## Access Control & Authorization

### Management Role Permissions Matrix

| Function | Employee | Manager | Management | HR |
|----------|----------|---------|------------|-----|
| Apply for Leave | ✓ | ✗ | ✗ | ✗ |
| View Own Leaves | ✓ | ✓ | ✗ | ✓ |
| View Own Balance | ✓ | ✓ | ✗ | ✓ |
| View Pending (own dept) | ✗ | ✓ | ✗ | ✓ |
| View Pending (all) | ✗ | ✗ | ✓ | ✓ |
| View Approved (all) | ✗ | ✗ | ✓ | ✓ |
| Approve ≤ 2 days | ✗ | ✓ | ✗ | ✓ |
| Approve > 2 days | ✗ | ✗ | ✓ | ✓ |
| Reject ≤ 2 days | ✗ | ✓ | ✗ | ✓ |
| Reject > 2 days | ✗ | ✗ | ✓ | ✓ |
| Cancel Own Leaves | ✓ | ✓ | ✗ | ✓ |
| Cancel Others' Leaves | ✗ | ✗ | ✗ | ✓ |
| Manage Entitlements | ✗ | ✗ | ✗ | ✓ |
| Override Decisions | ✗ | ✗ | ✗ | ✓ |

---

## API Endpoints

### View Pending Approvals
- **Endpoint:** `GET /api/leaves/pending`
- **Auth Required:** Management role
- **Filters:** Duration > 2 days only
- **Response:** All pending leaves > 2 days organization-wide

### Approve Leave
- **Endpoint:** `POST /api/leaves/:id/approve`
- **Auth Required:** Management role
- **Restrictions:** Only if duration > 2 days
- **Body:** Optional approval notes
- **Response (200 OK):** Updated leave record with status = 'Approved'

### Reject Leave
- **Endpoint:** `POST /api/leaves/:id/reject`
- **Auth Required:** Management role
- **Restrictions:** Only if duration > 2 days
- **Body:**
  ```json
  {
    "rejection_reason": "Reason for rejection"
  }
  ```
- **Response (200 OK):** Updated leave record with status = 'Rejected'

### View Leave Details
- **Endpoint:** `GET /api/leaves/:id`
- **Auth Required:** Management role
- **Response:** Complete leave details including employee info and balance

### Get Employee Balance
- **Endpoint:** `GET /api/leaves/balance/:user_id`
- **Auth Required:** Management role
- **Response:**
  ```json
  {
    "user_id": 1,
    "year": 2026,
    "leave_entitled": 12.0,
    "leaves_accumulated": 2.5,
    "leaves_availed": 3.0,
    "leave_balance": 11.5
  }
  ```

---

## Summary

The Management role is the **escalation tier** for long-duration leave requests with:
- ✓ Organization-wide approval authority for > 2 day leaves
- ✓ Full visibility of all pending and approved leaves
- ✓ Access to all employee leave balances
- ✓ Cannot apply for leave themselves (separation of duties)
- ✓ Cannot cancel leaves (only HR can)
- ✓ Final approval authority (except HR override)

Management's primary interaction with the system:
1. **Monitor** → Review escalated leaves > 2 days
2. **Decide** → Approve or reject without further verification
3. **Track** → View all organizational leave status
4. **Balance** → Check employee entitlements when needed
5. **Notify** → Communicate decisions to employees

The Management role ensures organizational oversight of extended leave requests while maintaining clear separation from employee applications and HR administrative control.
