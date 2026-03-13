HYLOC
Role-Based Workflow & Functional Guide
________________________________________
0. Login Functionality (All Roles)
0.1 Overview
The Login module provides secure authentication and controlled access to the HYLOC system. Every user must log in using valid credentials. Based on the assigned role, the system automatically redirects the user to the appropriate dashboard and restricts access to authorized modules only.
________________________________________
0.2 Login Workflow
Step 1: Access System
The user opens the HYLOC application URL. The login page is displayed.
 https://hyloc.git.edu/login
Step 2: Enter Credentials
The user enters:
•	Empid
•	Password
After entering details, the user clicks the Login button.
Step 3: Authentication Process
The system performs:
•	Credential verification
•	Role identification
•	Permission mapping
If:
•	Credentials are incorrect → System displays “Invalid Credentials”.
Step 4: Role-Based Redirection
After successful login:
•	Admin → Redirected to Admin Dashboard
•	Management → Redirected to Management Dashboard
•	Manager → Redirected to Manager Dashboard
•	Employee → Redirected to Employee Dashboard
Each role sees only authorized modules.
Step 5: Session Management
•	A secure session is created upon login.
•	User remains logged in until logout.
•	Logout destroys the session and redirects to the login page.
________________________________________
1. Admin Role
1.1 Overview
The Admin has complete control over the HYLOC system. This role is responsible for system configuration, user management, organizational structure setup, KPI configuration, leave policy definition, and global ticket oversight.
________________________________________
1.2 Functional Modules & Detailed Explanation
Dashboard
Provides system-wide analytics including:
•	Total users
•	Department count
•	Designation and Pillers statistics
This dashboard helps Admin monitor overall organizational performance.
________________________________________
Roles
Allows creation and management of system roles.
Functions:
•	Create new roles
•	Edit existing roles
This ensures proper access control within the system.
________________________________________
Department
Used to manage organizational departments.
Functions:
•	Add department
•	Edit department details
•	Delete department
________________________________________
Designation
Manages employee job titles.
Functions:
•	Add designation
•	Modify designation
•	Delete designation
________________________________________
Association
Manages organizational associations.
Functions:
•	Create association
•	Update association
•	Delete association
________________________________________
Users
Complete user account management.
Functions:
•	Add new users
•	Edit user details
•	Activate / Deactivate accounts
•	Assign departments and designations
________________________________________
KMI’s (Key Management Indicators)
Used to define and manage performance indicators.
Functions:
•	Create KPI categories
•	Assign measurable targets
•	Link KPIs to departments or users
•	Track progress
________________________________________
Unit Master
Maintains unit-level master data such as business units, divisions, or operational categories.
Functions:
•	Create units
•	Edit units
•	Delete units
________________________________________
Pillars
Represents strategic organizational pillars.
Functions:
•	Create pillars
•	Edit pillars
•	Delete pillars
________________________________________
User-Roles
Maps users to roles.
Functions:
•	Assign role to user
•	Change role
•	Delete role
________________________________________
Leave Entitlement
Configures leave policies.
Functions:
•	Set leave limits
•	Define accrual policies
________________________________________
Tickets
Admin can monitor all tickets raised across the system.
Functions:
•	View all tickets
•	Assign tickets
•	Change ticket status
•	Close tickets
•	Escalate tickets
________________________________________
2. Management Role
2.1 Overview
The Management role focuses on strategic oversight, KPI monitoring, leave tracking, and organization-level ticket handling.
________________________________________
2.2 Functional Modules & Explanation
Dashboard
Displays:
•	Organization-wide KPI summaries
•	Performance analytics
•	Graphical Representation
________________________________________
KMI
Allows management to:
•	View KPI performance
•	Analyze trends
•	Review progress reports
________________________________________
Pillar
Enables strategic performance monitoring.
Functions:
•	View pillar performance
•	Analyze department contribution
•	Review KPI alignment
________________________________________
Calendar
Provides organization-level leave visibility.
Functions:
•	View leave schedule
•	Identify workforce availability
•	Monitor leave distribution
________________________________________
Leave List
Includes:
•	My Leave → Apply and track personal leave
•	Leave Approval → Approve or reject leave requests
________________________________________
Tickets
Management can:
•	View tickets across departments
•	Escalate critical issues
•	Monitor resolution timelines
________________________________________
3. Manager Role
3.1 Overview
Managers oversee team-level performance, leave approvals, and operational ticket handling.
________________________________________
3.2 Functional Modules & Explanation
Dashboard
Displays:
•	Team KPI performance
•	Productivity metrics
•	Leave summary
•	Ticket status
________________________________________
Calendar
Shows:
•	Team leave calendar
•	Availability overview
•	Conflict detection for leave approvals
________________________________________
Leave List
Includes:
•	My Leave → Apply and track personal leave
•	Leave Approval → Approve/reject team leave
Managers ensure minimal operational disruption.
________________________________________
Tickets
Managers:
•	Create tickets
•	Assign 
•	Close resolved tickets or Delete.
________________________________________
4. Employee Role
4.1 Overview
Employees use the system to monitor performance, manage leave, and raise support tickets.
________________________________________
4.2 Functional Modules & Explanation
Dashboard
Displays:
•	Personal KPI performance
•	Leave balance summary
•	Ticket status overview
________________________________________
My KPIs/KAIs
Employees can:
•	View assigned KPIs
•	Track progress
•	Monitor target completion
________________________________________
Calendar
Shows:
•	Personal leave history
•	Upcoming leave
•	Leave balance
________________________________________
Tickets
Employees can:
•	Submit new ticket
•	Describe issue
•	Track ticket status
•	View responses
•	Close ticket after resolution
________________________________________
5. General Features (All Roles)
5.1 Notifications
Real-time alerts for:
•	Leave 
•	Ticket updates
•	KPI updates
Ensures users stay informed without manual tracking.
________________________________________
5.2 Profile Management
Accessible from top navigation.
Includes:
•	View profile details
•	Update personal information
•	Change password
•	Logout
________________________________________
6. Security & Access Control
•	Role-Based Access Control (RBAC) enforced
•	Secure authentication
•	Session management
•	Permission-based module visibility
•	Data-level access restrictions