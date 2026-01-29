# Leave Management System - HR Role Documentation

## Document Overview
This document details the leave administration and management functionality for the **HR Role** in the Hyloc-PMS Leave Management System. The HR role represents Human Resources personnel with unrestricted administrative authority over all leave management operations, including overrides, entitlement management, and system-wide controls.

---

## Table of Contents
1. [Business Rules Overview](#business-rules-overview)
2. [Database Schema & Models](#database-schema--models)
3. [Detailed Business Rules by Function](#detailed-business-rules-by-function)
4. [Access Control & Authorization](#access-control--authorization)
5. [HR Workflow](#hr-workflow)
6. [API Endpoints](#api-endpoints)

---

## Business Rules Overview

### Summary for HR Role

The HR role represents **unrestricted administrative authority** with control over all leave management functions:

| Rule # | Rule Description | Key Detail |
|--------|------------------|-----------|
| BR-1 | Leave Application Eligibility | Only Employee role can apply; HR cannot apply for themselves |
| BR-2 | Organizational Access | HR has unrestricted access to all employees' leaves organization-wide |
| BR-3 | Override Authority | HR can override, cancel, and modify any leave regardless of status |
| BR-4 | Leave Types & Duration | Full Day (1 day), Morning Half (0.5 days), Afternoon Half (0.5 days); Paid or Unpaid |
| BR-5 | Entitlement Management | HR manages leave balances, adjustments, and carryover policies |
| BR-6 | Audit & Compliance | HR maintains complete audit trails for all leave operations |

---

## Database Schema & Models

### Core Tables Used in New Architecture

#### 1. **users Table**
Stores all system users including employees, managers, management, and HR personnel with extended profile information.

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
  - Used to uniquely identify all system users
- `email` (VARCHAR 255): Unique email address
  - Used for login and communication
  - Must be unique across all users
- `empid` (VARCHAR 50): Employee identification number
  - Unique employee code/badge number
  - May be null for non-employee users
- `first_name` (VARCHAR 100): User's first name
- `middle_name` (VARCHAR 100): User's middle name (optional)
- `last_name` (VARCHAR 100): User's last name
- `department_id` (INTEGER, FOREIGN KEY): Reference to departments table
  - Links user to their assigned department
  - HR users typically have department_id = NULL
  - Foreign key constraint ensures department exists
- `phone` (VARCHAR 20): Contact phone number
- `address` (TEXT): Physical address
- `blood_group` (VARCHAR 5): Blood group (e.g., O+, B-, AB)
- `password` (VARCHAR 255): Encrypted password
  - Stored as hash (never plain text)
  - Verified during authentication
- `created_at` (TIMESTAMP): When account was created
- `updated_at` (TIMESTAMP): When account was last modified

**HR User Context:**
- HR users have HR role in user_roles table
- Cannot apply for leave themselves (policy separation)
- Have unrestricted access to all user records
- Department_id typically null (organization-wide scope)

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
- `HR`: Human Resources (unrestricted administrative access)

**HR Role Characteristics:**
- Highest privilege level
- Unrestricted system access
- Cannot be combined with other roles on same user
- Exclusively for HR department personnel

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

**For HR Users:**
- One record: user_id → HR role_id (status = 'Active')
- Cannot have Employee, Manager, or Management roles
- May have historical inactive records from previous assignments
- HR role assignment is exclusive and organization-wide

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

**HR Perspective:**
- HR has unrestricted view of all departments
- Can assign/manage users across all departments
- Can modify department records (if authorized)
- No department-level restrictions for HR

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
  - Only employees (Employee role) typically create records
  - HR can create records for employees via admin interface
- `from_date` (DATE): Leave start date (YYYY-MM-DD)
- `to_date` (DATE): Leave end date (YYYY-MM-DD)
- `alternate_person` (VARCHAR 100): Primary delegate/contact
- `additional_alternate` (VARCHAR 100): Secondary delegate/contact
- `leave_reason` (VARCHAR 255): Reason for absence
- `leave_duration` (VARCHAR 50): Type of absence (Full Day, Morning Half, Afternoon Half)
- `leave_type` (VARCHAR 20): Category (Paid, Unpaid)
- `available_on_phone` (BOOLEAN): Availability during leave
- `approved_by` (INTEGER, FOREIGN KEY): User ID of approver
  - References users table
  - HR can set this field when processing leaves
  - Can be null (pending) or populated (approved/rejected)
- `status` (VARCHAR 20): Current approval status (Pending, Approved, Rejected)
- `credited_days` (DECIMAL 4,1): Days deducted from entitlement
- `created_at` (TIMESTAMP): Request submission time

**HR Interactions:**
- **View:** All leaves from all employees (no restrictions)
- **Create:** Admin-created leaves for employees
- **Approve:** Override any pending leave
- **Reject:** Reject with explanations
- **Modify:** Edit leave details if needed
- **Delete/Cancel:** Cancel any leave regardless of status

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
  - One record per user per year
- `year` (INTEGER, NOT NULL): Calendar year
- `leave_entitled` (DECIMAL 4,1): Annual leave allocation (default 12.0 days)
  - **HR can modify:** Adjust entitlement for individual employees
  - **HR can set:** Policy changes at year start
- `leaves_accumulated` (DECIMAL 4,1): Carryover from previous year (default 0.0)
  - **HR can modify:** Adjust carryover values
  - **HR sets:** At year-start planning
  - May enforce maximum carryover limits
- `leaves_availed` (DECIMAL 4,1): Total leaves consumed this year (default 0.0)
  - Auto-updated when leaves are created/cancelled
  - **HR can override:** Manually adjust if policy corrections needed

**Constraints:**
- UNIQUE(user_id, year): Only one entitlement record per employee per year

**Calculated Field (Not Stored):**
```
leave_balance = leave_entitled + leaves_accumulated - leaves_availed
```

**HR Management:**
- View all employee entitlements
- Adjust entitled days for policy changes
- Manage carryover at year-end/year-start
- Correct availed counts when needed
- Enforce compliance with entitlement policies

---

### Model Relationships

```
User (id = INTEGER)
  ├─ hasMany UserRole (Link to roles)
  ├─ hasMany Leave (as employee)
  ├─ hasMany Leave (as approver via approved_by)
  └─ hasMany LeaveEntitlement

Role
  ├─ 'HR' role
  └─ hasMany UserRole

UserRole
  ├─ belongsTo User
  └─ belongsTo Role

Department
  └─ hasMany User (all employees and managers)

Leave
  ├─ belongsTo User (employee who applied)
  └─ belongsTo User (approver - approved_by field)

LeaveEntitlement
  └─ belongsTo User (employee's entitlement)
```

---

## Detailed Business Rules by Function

### BR-1: Leave Application Eligibility

**Rule:** Only employees with the **Employee** role can apply for leave. HR personnel cannot apply for themselves.

#### Why HR Cannot Apply:
- **Separation of Duties**: HR manages leave for others, not themselves
- **Conflict of Interest**: HR should not approve their own leaves
- **Transparency**: Someone else (Management/another HR) must handle HR leave requests

#### HR Leave Request Process:
- HR employee cannot use standard "Apply for Leave" form
- HR must contact another HR person or Management
- Other HR person processes leave via admin interface
- Creates leave record in database on behalf of HR employee

#### System Validation:
```
HR User clicks "Apply for Leave"
    ↓
System checks current role
    ↓
HR role detected → Error: "HR role cannot apply for leave"
Form disabled
"Contact your HR Manager" message displayed
```

#### Exception Handling:
- **HR 2 required**: At minimum 2 HR personnel needed for mutual approval
- **Management approval**: Management can approve HR employee leaves
- **HR override**: Only other HR can process HR leave requests

---

### BR-2: Organizational Access & Unrestricted Visibility

**Rule:** HR has unrestricted access to all employees' leaves organization-wide without departmental or hierarchical limitations.

#### HR Access Scope:

**Employee Records:**
```
HR can view/access:
├─ All users regardless of department
├─ All roles and role assignments
├─ All user profile information
├─ All contact and identity data
└─ No access restrictions based on department
```

**Leave Records:**
```
HR can view/access:
├─ All leaves from all employees
├─ All pending leave requests
├─ All approved leaves
├─ All rejected leaves
├─ All cancelled leaves
├─ Complete leave history
└─ No departmental filtering
```

**Balance Records:**
```
HR can view/access:
├─ All employee entitlements
├─ All yearly leave balances
├─ Historical entitlement records
├─ Accumulated vs available breakdowns
├─ Full financial reconciliation
└─ Bulk reporting capabilities
```

#### Organization-Wide Authority:
- **No Department Boundaries**: Can access leaves from any department
- **No Hierarchy Restrictions**: No supervision chain limitations
- **No Approval Chain Bypass**: Can view leaves regardless of approval status
- **Complete Audit Trail**: Access all operations by all users

#### HR Visibility Features:
- Dashboard showing all pending leaves
- Department-wise leave statistics
- Employee-wise balance reports
- Approval history tracking
- Audit logs of all changes

---

### BR-3: Override Authority & Administrative Control

**Rule:** HR can override, cancel, and modify any leave regardless of current status.

#### Override Capabilities:

**Approve Any Leave:**
```
HR can approve:
├─ Pending leaves at any stage
├─ Leaves awaiting Manager approval
├─ Leaves awaiting Management approval
├─ Leaves with insufficient balance (policy override)
├─ Leaves outside normal policy
└─ Without needing any prior approvals
```

**Reject Any Leave:**
```
HR can reject:
├─ Any pending leave
├─ Any approved leave (reversal)
├─ Any rejected leave (modification)
├─ With explanation to employee
└─ With restoration of balance
```

**Cancel Any Leave:**
```
HR can cancel:
├─ Pending leaves
├─ Approved leaves
├─ Consumed leaves (with payroll impact)
├─ Regardless of date (past, present, future)
├─ With automatic balance restoration
└─ With audit trail of reason
```

**Modify Leave Details:**
```
HR can modify:
├─ from_date and to_date
├─ leave_duration (Full Day, Half Day)
├─ leave_type (Paid, Unpaid)
├─ leave_reason
├─ alternate_person information
├─ approved_by field
└─ Even after approval
```

#### Policy Override Examples:

**Scenario 1: Insufficient Balance**
```
Employee tries to apply
System checks balance: 1.5 days available
Employee requests: 5 days
Result: Application blocked

HR intervention:
→ HR approves despite balance
→ System allows override
→ Leave approved even though balance insufficient
→ Balance goes negative (flagged for payroll)
```

**Scenario 2: Late Approval**
```
Leave date: January 15
Current date: January 20 (leave already consumed)
Status: Still Pending (unusual)

HR intervention:
→ HR approves after-the-fact
→ Leave marked as 'Approved' retroactively
→ Balance corrected
→ Leave now in system with approval
```

**Scenario 3: Cancellation of Approved Leave**
```
Leave: Approved on Jan 10
Leave dates: Jan 15-20
Current date: Jan 18 (employee already consumed 3 days)

HR intervention:
→ HR cancels entire leave
→ Status: Changed from 'Approved' to 'Cancelled'
→ Balance: 5 days restored to employee
→ Payroll: Notified of retroactive change
→ Reason: Documented in HR notes
```

#### Authorization Check for Overrides:
```
HR initiates override operation
    ↓
System logs HR user ID
    ↓
System validates HR role
    ↓
Override executed
    ↓
Audit trail recorded
    ↓
Employee/Manager notified (if configured)
```

---

### BR-4: Leave Types & Duration Options

**Rule:** All leave types and durations are available and uniformly managed across the system.

#### Leave Duration Categories:

**Full Day Leave**
- Represents: Entire workday absence
- Credited Days: 1.0 per day
- Format: `from_date` to `to_date` (any date range)
- Calculation: Inclusive count of dates
  - Example: Jan 1 to Jan 3 = 3 full days
  - Example: Jan 1 to Jan 1 = 1 full day
- HR visibility: Duration clearly displayed
- HR override: Can change duration post-submission

**Half-Day Leaves**
- **Morning Half**: Only morning absence (afternoon works)
  - Credited Days: 0.5
  - Format: `from_date` = `to_date` (same day only)
  - Constraint: Cannot span multiple days
  - HR visibility: Type clearly marked
- **Afternoon Half**: Only afternoon absence (morning works)
  - Credited Days: 0.5
  - Format: `from_date` = `to_date` (same day only)
  - Constraint: Cannot span multiple days
  - HR visibility: Type clearly marked

#### Leave Type Categories:

**Paid Leave**
- Default type for standard leave requests
- Deducts from annual leave balance
- Updates `leaves_availed` when applied
- HR can override type if needed
- Affects payroll calculations

**Unpaid Leave**
- Does not deduct from balance
- `leaves_availed` not updated for balance purposes
- Used for special circumstances
- Requires HR approval in many systems
- Still recorded in leave history

#### HR Administration of Duration & Type:
- HR can view all combination types
- HR can change duration/type after submission
- HR can create special duration combinations
- HR can override duration restrictions
- HR can batch-process leaves by type

---

### BR-5: Entitlement Management & Balance Control

**Rule:** HR manages leave balances, annual allocations, adjustments, and carryover policies.

#### Entitlement Management Functions:

**Annual Leave Setting:**
```
At year-start (Jan 1):
HR sets for all employees:
├─ leave_entitled = 12.0 (default)
├─ leaves_accumulated = carryover from previous year
├─ leaves_availed = 0.0 (fresh start)
├─ Can vary per employee (promotions, new joinees)
└─ Can vary per department (policy differences)
```

**Carryover Management:**
```
At year-end/year-start transition:
HR manages carryover policy:
├─ Maximum carryover limit (e.g., 5 days max)
├─ Expiration rules (e.g., old carry-over expires)
├─ Adjustment for unused leave
├─ Payment in lieu if applicable
└─ Communication to employees
```

**Individual Adjustments:**
```
HR can adjust for:
├─ Promotion/demotion (different entitlement)
├─ Mid-year joining/leaving (prorated entitlement)
├─ Sabbatical/unpaid leave
├─ Maternity/paternity leave impact
├─ Long-term illness coverage
├─ Disciplinary adjustments
└─ Special circumstances approval
```

**Balance Corrections:**
```
HR can correct:
├─ Over-availed balance (negative balance)
├─ Calculation errors
├─ System sync issues
├─ Approval reversals
├─ Manual correction requests
└─ With full audit trail
```

#### Entitlement Modification Examples:

**Example 1: New Employee Mid-Year**
```
Employee joins: June 15
Annual entitlement: 12 days
Days already passed (Jan-Jun): 181 days (6 months)

HR calculation:
→ Prorated: 12 × (181/365) = 5.94 days
→ HR sets: leave_entitled = 5.94
→ leaves_accumulated = 0
→ leaves_availed = 0 (starts fresh)
```

**Example 2: Year-End Carryover**
```
Employee balance: 15 days remaining
Carryover policy: Maximum 5 days
End-of-year processing:

HR actions:
→ Excess: 15 - 5 = 10 days
→ Carryover to next year: 5 days
→ Payment in lieu: 10 days × pay_rate (payroll)
→ Sets leaves_accumulated = 5 for next year
→ Next year's leaves_entitled = 12
→ Total available next year: 17 days
```

**Example 3: Balance Negative**
```
Employee availed: 14 days
Employee entitled: 12 days
Balance: -2 days (over-availed)

HR correction options:
1. Deduct from next year: leave_entitled(next year) -= 2
2. Recovery period: Payroll deduction
3. Waive: Policy exception
4. Balance adjustment: Manual correction
```

---

### BR-6: Audit & Compliance Tracking

**Rule:** HR maintains complete audit trails for all leave operations with full traceability.

#### Audit Trail Components:

**Who Changed What:**
```
System tracks:
├─ User who made change (HR user ID)
├─ Field that was changed
├─ Old value before change
├─ New value after change
├─ Timestamp of change (created_at, updated_at)
└─ Reason for change (HR notes)
```

**Leave Modification History:**
```
For each leave record:
├─ Original submission (employee)
├─ All approval/rejection actions
├─ Any cancellations (with reason)
├─ Any modifications (by HR)
├─ All status changes
├─ All metadata changes
└─ Complete audit log viewable by HR
```

**Entitlement Change Tracking:**
```
For each entitlement change:
├─ Date of change
├─ Previous values (all 3 components)
├─ New values (all 3 components)
├─ HR person who made change
├─ Reason for change
├─ Impact on current balance
└─ Approval workflow if required
```

#### Compliance & Reporting:

**Regular Reports:**
```
HR can generate:
├─ Employee leave utilization (per employee)
├─ Department-wise leave statistics
├─ Month-wise consumption trends
├─ Balance projection reports
├─ Policy violation detection
├─ Carryover aging reports
└─ Payroll impact analysis
```

**Audit Reports:**
```
HR can view:
├─ Leave application audit trail
├─ Approval decision history
├─ Cancellation logs
├─ Override usage tracking
├─ User activity logs
├─ System change logs
└─ Compliance verification
```

**Policy Enforcement:**
```
HR verifies:
├─ Entitlement policy compliance
├─ Approval authority enforcement
├─ Balance accuracy
├─ Date range validation
├─ Duplicate leave prevention
├─ Minimum notice period (if any)
└─ Special approval conditions
```

#### Export & Data Security:
```
HR can:
├─ Export reports to CSV/Excel
├─ Generate PDF documents
├─ Archive historical data
├─ Backup entitlement records
├─ Maintain compliance copies
├─ Integrate with payroll system
└─ All with access controls and logging
```

---

## HR Workflow

### Complete HR Management Lifecycle

#### Phase 1: Monitoring & Review
```
HR reviews dashboard
    ↓
HR identifies pending actions:
├─ New leave applications
├─ Approval delays
├─ Balance anomalies
├─ Policy violations
├─ Escalation items
    ↓
HR prioritizes workload
```

#### Phase 2: Intervention & Decision-Making
```
HR reviews specific case
    ↓
HR checks:
├─ Employee eligibility
├─ Balance availability
├─ Policy compliance
├─ Manager/Management approval
├─ Supporting documentation
    ↓
HR makes decision
```

#### Phase 3: Action & Processing
```
Decision Options:

1. APPROVE
    ↓
HR approves leave
approved_by = HR user ID
Status = 'Approved'
Employee notified
    ↓

2. REJECT
    ↓
HR rejects with reason
approved_by = HR user ID
Status = 'Rejected'
Balance restored
Employee notified
    ↓

3. OVERRIDE
    ↓
HR overrides prior decision
Changes status as needed
Updates balance if needed
Employee/Manager notified
    ↓

4. CANCEL
    ↓
HR cancels leave
Reason documented
Balance restored
Payroll notified (if applicable)
    ↓

5. MODIFY
    ↓
HR modifies details
Updates leave record
May require re-notification
Audit trail recorded
```

#### Phase 4: Compliance & Follow-up
```
Post-action tasks:
├─ Balance verification
├─ Payroll coordination
├─ Employee communication
├─ Manager notification
├─ Archive documentation
├─ Audit trail review
└─ Compliance check
```

---

## Access Control & Authorization

### HR Role Permissions Matrix

| Function | Employee | Manager | Management | HR |
|----------|----------|---------|------------|-----|
| Apply for Leave | ✓ | ✗ | ✗ | ✗ |
| View Own Leaves | ✓ | ✓ | ✗ | ✗ |
| View Own Balance | ✓ | ✓ | ✗ | ✗ |
| View Pending (own dept) | ✗ | ✓ | ✗ | ✗ |
| View Pending (all) | ✗ | ✗ | ✓ | ✓ |
| View Approved (all) | ✗ | ✗ | ✓ | ✓ |
| View All Leaves (History) | ✗ | ✗ | ✗ | ✓ |
| Approve ≤ 2 days | ✗ | ✓ | ✗ | ✓ |
| Approve > 2 days | ✗ | ✗ | ✓ | ✓ |
| Approve Any (Override) | ✗ | ✗ | ✗ | ✓ |
| Reject ≤ 2 days | ✗ | ✓ | ✗ | ✓ |
| Reject > 2 days | ✗ | ✗ | ✓ | ✓ |
| Reject Any (Override) | ✗ | ✗ | ✗ | ✓ |
| Cancel Own Leaves | ✓ | ✓ | ✗ | ✗ |
| Cancel Any Leaves | ✗ | ✗ | ✗ | ✓ |
| Modify Leaves | ✗ | ✗ | ✗ | ✓ |
| Manage Entitlements | ✗ | ✗ | ✗ | ✓ |
| View All Balances | ✗ | ✗ | ✓ | ✓ |
| Adjust Balances | ✗ | ✗ | ✗ | ✓ |
| Generate Reports | ✗ | ✗ | ✗ | ✓ |
| Audit Trail Access | ✗ | ✗ | ✗ | ✓ |

---

## API Endpoints

### View All Leaves
- **Endpoint:** `GET /api/leaves/all`
- **Auth Required:** HR role
- **Filters:** Optional by employee, department, status, date range
- **Response:** Complete list of all leaves in system with full details

### Approve Leave (Override)
- **Endpoint:** `POST /api/leaves/:id/approve`
- **Auth Required:** HR role
- **Special Power:** Can approve any leave regardless of status or balance
- **Body:**
  ```json
  {
    "approval_notes": "HR override - special approval",
    "force_approve": true
  }
  ```
- **Response (200 OK):** Updated leave record

### Reject Leave (Override)
- **Endpoint:** `POST /api/leaves/:id/reject`
- **Auth Required:** HR role
- **Special Power:** Can reject any leave, even approved ones
- **Body:**
  ```json
  {
    "rejection_reason": "Policy violation - HR override",
    "restore_balance": true
  }
  ```
- **Response (200 OK):** Updated leave record with status = 'Rejected'

### Cancel Leave
- **Endpoint:** `DELETE /api/leaves/:id`
- **Auth Required:** HR role
- **Special Power:** Can cancel any leave regardless of status or dates
- **Body:**
  ```json
  {
    "cancellation_reason": "Cancelled by HR",
    "restore_balance": true,
    "notify_employee": true
  }
  ```
- **Response (200 OK):** Leave cancelled with balance restored

### Update Entitlement
- **Endpoint:** `PUT /api/leaves-entitlement/:id`
- **Auth Required:** HR role
- **Body:**
  ```json
  {
    "leave_entitled": 15.0,
    "leaves_accumulated": 3.5,
    "leaves_availed": 2.0,
    "modification_reason": "Promotion effective date"
  }
  ```
- **Response (200 OK):** Updated entitlement record

### Get All Employees' Balances
- **Endpoint:** `GET /api/leaves/balances/all`
- **Auth Required:** HR role
- **Filters:** Optional by department, year
- **Response:**
  ```json
  {
    "data": [
      {
        "user_id": 1,
        "user_name": "John Smith",
        "department": "IT",
        "year": 2026,
        "leave_entitled": 12.0,
        "leaves_accumulated": 2.5,
        "leaves_availed": 3.0,
        "leave_balance": 11.5
      }
    ]
  }
  ```

### Bulk Entitlement Update
- **Endpoint:** `POST /api/leaves-entitlement/bulk-update`
- **Auth Required:** HR role
- **Body:**
  ```json
  {
    "updates": [
      {
        "user_id": 1,
        "year": 2026,
        "leave_entitled": 15.0,
        "reason": "Promotion"
      },
      {
        "user_id": 2,
        "year": 2026,
        "leaves_accumulated": 5.0,
        "reason": "Carryover adjustment"
      }
    ]
  }
  ```
- **Response:** Bulk update summary

### Generate Leave Report
- **Endpoint:** `GET /api/reports/leave-summary`
- **Auth Required:** HR role
- **Filters:** By department, date range, employee
- **Response:** Comprehensive leave utilization report

---

## Summary

The HR role is the **ultimate administrative authority** with:
- ✓ Unrestricted access to all leave records organization-wide
- ✓ Override capabilities for any decision
- ✓ Full entitlement and balance management
- ✓ Cancel authority for any leave
- ✓ Modify authority for all leave details
- ✓ Complete audit trail access
- ✓ Cannot apply for leave themselves (policy separation)
- ✓ Reporting and compliance oversight

HR's primary interactions with the system:
1. **Monitor** → View all leaves and identify issues
2. **Approve** → Final authority for any approval
3. **Manage** → Adjust entitlements and balance
4. **Override** → Bypass rules when needed
5. **Audit** → Track all changes and maintain compliance
6. **Report** → Generate insights and verify accuracy

The HR role ensures organizational leave policy compliance, maintains system integrity, and provides final authority for all leave management decisions.
