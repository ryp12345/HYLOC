# Leave Approval and Rejection (Management → Manager → Employee)
This document covers only Leave Approval and Leave Rejection flows for Management, Manager, and Employee roles. HR is intentionally excluded.

## Management

### Responsibility
- Approves/rejects leave requests submitted by Managers.
- Handles any leave request with duration > 2 days (system rule). This is treated as a Management decision.

### Business Rules 
- Management can approve or reject leave requests of users of role Employee role (only if the leave is more than 2 continuous days) or Manager role (any duration)
- Management is the supervisor for Managers’ leave requests.
- Only Management and Manager roles can approve or reject leave requests.
- Managers’ leave requests that last more than 2 days are routed to Management.

### Leave Approval Viewing
- Management can view status (Pending/Approved/Rejected) for all leaves in the approval list view: client/src/pages/management/leaves/LeaveApprovalPage.jsx
- Route path: /management/leave-approval
  
**Table Structure:**
- 3 tabs for leave requests: **Pending** ,**Approved** and **Rejected**
- On click of Pending tab all the leaves whose status is pending are shown
- On click of Approved tab all the leaves whose status is approved are shown
- On click of Rejected tab all the leaves whose status is rejected are shown
- Route path: /management/leave-approval
- Each row displays:
  - **Column 1 (Left):**
    - Manager(role) or Employee(role) user name who has applied for the leave
    - From and To Date of the leave
    - Duration of the leave
    - Full/Half (if it was 1 day)
    - Paid/Unpaid
    - Reason, Alternate Person, and Available on Phone
  - **Column 2 (Right):** Pending/Approved/Rejected status

***********************************************************************************************

## Manager

### Responsibility
- Approves/rejects leave requests submitted by Employees in the same department (supervisor-based).
- Does **not** approve leave requests where duration > 2 continuous days (those are escalated to Management).

### Leave Approval Viewing
- Manager approval screen: client/src/pages/manager/leaves/LeaveApprovalPage.jsx
- Route path: /manager/leave-approval

UI & rules(2 buttons)
1st button: Button 'Status of my Leave Requests'(Own leave requests)
On click of button 'Status of my Leave Requests' shows 3 tabs: Pending, Approved, Rejected
- Each row displays:
  - if Pending tab is clicked  the user(logged in Manager)leaves whose status is pending are shown
  - if Approved tab is clicked the user(logged in Manager)leaves whose status is approved are shown
  - if Rejected tab is clicked the user(logged in Manager)leaves whose status is rejected are shown

2nd button: Button 'Approve/Reject Employee Leaves'

On click of button 'Approve/Reject Employee Leaves' shows 3 tabs: Pending, Approved, Rejected
- Shows Approve and Reject buttons only when number of leave applied for <= 2`.
- Shows “Requires Management Approval” for number of leave applied > 2`.

- Each row displays:
  - **Column 1 (Left):**
    - Employee Name who has applied for the leave
    - From and To Date of the leave
    - Duration of the leave
    - Full/Half (if it was 1 day)
    - Paid/Unpaid
    - Reason, Alternate Person, and Available on Phone

  - **Column 2 (Right):** Pending/Approved/Rejected status
  

### Business Rules 
- Managers can Approve/Reject only for Employees they supervise in the same department.(on click of Approve/Reject buttons)
- Managers can Approve/Reject only Employee leaves of 2 or less continuous days.
- Leaves longer than 2 continuous days are escalated/routed to Management.
- Managers cannot Approve/Reject leaves those escalated requests.

### Status Viewing (own leaves)
- Status list + counters: client/src/pages/manager/leaves/LeavesPage.jsx
- Calendar status display: client/src/pages/manager/leaves/ManagerCalendar.jsx
 Route path: /manager/leaves
 
### Approval Viewing
- Manager can view status for leaves they supervise (Pending/Approved/Rejected) via: client/src/pages/manager/leaves/LeaveApprovalPage.jsx
  - Route path: /manager/leave-approval



***********************************************************************************************

## Employee

### Responsibility
- Submits leave requests and views approval status.
  - if Pending tab is clicked the user(logged in Employee) leaves whose status is pending are shown
  - if Approved tab is clicked  the user(logged in Employee) leaves whose status is approved are shown
  - if Rejected tab is clicked  the user(logged in Employee)leaves whose status is rejected are shown
- No approval/rejection privileges.

### UI (View Status)
- Employee leave calendar and list: client/src/pages/employee/leaves/LeavesPage.jsx
- Calendar UI that shows leave status: client/src/pages/employee/leaves/EmployeeCalendar.jsx
- Route path: /employee/leaves

### Business Rules 
- Employees can only view the status of their own leave requests.
- Employees cannot approve or reject any leave requests.
- Leave request status values are Pending, Approved, Rejected.



**Table Structure:**
- Three tabs for leave requests: **Pending**, **Approved** and **Rejected**
- Each row displays:
  - **Column 1 (Left):**
    - From and To Date of the leave
    - Duration of the leave
    - Full/Half (if it was 1 day)
    - Paid/Unpaid
    - Reason, Alternate Person, and Available on Phone
  - **Column 2 (Right):** Pending/Approved/Rejected status

---

## Cross-Role Interrelation Summary
- Employee → Manager: Manager approves/rejects Employee leave requests if the duration is 2 continuous days or less and the Manager is the valid supervisor.
- Employee → Management: Management approves/rejects Employee leave requests if the duration is more than 2 continuous days.
- Manager → Management: Management approves/rejects Manager leave requests of any duration. 