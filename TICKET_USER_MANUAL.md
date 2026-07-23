# Ticket System - User Manual

> **HYLOC-MGT Application**
> Version 1.0 | July 2026

---

## Table of Contents

1. [What is the Ticket System?](#1-what-is-the-ticket-system)
2. [How to Access the Ticket Module](#2-how-to-access-the-ticket-module)
3. [Understanding the Dashboard](#3-understanding-the-dashboard)
4. [Creating a New Ticket](#4-creating-a-new-ticket)
5. [Viewing & Managing Tickets](#5-viewing--managing-tickets)
6. [Editing a Ticket](#6-editing-a-ticket)
7. [Assigning Tickets to Users](#7-assigning-tickets-to-users)
8. [Changing Ticket Status](#8-changing-ticket-status)
9. [Attachments](#9-attachments)
10. [Deleting a Ticket](#10-deleting-a-ticket)
11. [Searching & Filtering Tickets](#11-searching--filtering-tickets)
12. [Ticket Statuses Explained](#12-ticket-statuses-explained)
13. [Ticket Priorities Explained](#13-ticket-priorities-explained)
14. [Notifications](#14-notifications)
15. [Calendar Integration](#15-calendar-integration)
16. [Role-Based Permissions](#16-role-based-permissions)
17. [Best Practices](#17-best-practices)
18. [Frequently Asked Questions](#18-frequently-asked-questions)

---

## 1. What is the Ticket System?

The Ticket System helps you track requests, issues, and tasks within your organization. Think of it as a digital "to-do" board where:

- **Employees** can raise tickets for work requests, IT issues, or any organizational task
- **Managers / HODs** can assign tickets to team members and track progress
- **Management** gets a complete overview of all tickets across the organization

Every ticket has a title, description, priority level, due date, and assignee(s) so nothing falls through the cracks.

---

## 2. How to Access the Ticket Module

1. Log in to your HYLOC-MGT account.
2. Look for the **"Tickets"** option in the left sidebar or navigation menu.
3. Click on it to open the Ticket Dashboard.

> **Note**: If you don't see the Tickets menu, please contact your administrator. Access is role-based.

---

## 3. Understanding the Dashboard

When you open the Tickets page, you will see:

### 3.1 Charts (Management Users Only)
If you are logged in as **Management**, you will see two charts at the top:

- **Ticket Priority Distribution**: Shows how many tickets are Low, Medium, High, or Critical.
- **Ticket Status Distribution**: Shows the breakdown of Open vs Closed tickets.
- **Overdue Count**: Displays how many tickets have passed their due date and are still not closed.

### 3.2 Main Ticket Table
Below the charts is the main table showing all tickets. Columns include:

| Column | Description |
|--------|-------------|
| **S.No** | Serial number for easy reference |
| **Title** | The ticket title |
| **Status** | Current status (Open, Closed, etc.) |
| **Priority** | Priority level chip (color-coded) |
| **Attachment** | Icon to view attached files, or "--NA--" if none |
| **Closed Date** | Date when the ticket was closed, or "--NA--" if still open |
| **Actions** | Edit and Delete buttons (visible based on your permissions) |

### 3.3 Quick Stats
Above the table, you will see filter buttons:
- **All**: Shows all tickets you can see
- **Mine**: Shows only tickets assigned to you

Each button shows the count of tickets in that category.

---

## 4. Creating a New Ticket

To create a new ticket:

1. Click the **"Add Ticket"** button (blue button at the top right).
2. A modal window will open with the ticket form.
3. Fill in the following fields:

   | Field | Required | Description |
   |-------|----------|-------------|
   | **Title** | Yes | A short, clear title for the ticket |
   | **Description** | Yes | Detailed explanation of the request or issue |
   | **Priority** | No | Choose from: Low, Medium, High |
   | **Assign To** | Yes | Select one or more users to handle this ticket |
   | **Status** | Auto | New tickets always start as "Open" |
   | **Due Date** | Yes | Select the deadline for this ticket |
   | **Attachment** | No | Upload a relevant file (document, image, etc.) |

4. Click **"Create Ticket"** to submit.

### Tips for Creating Good Tickets:
- Use a clear, specific title (e.g., "Fix login issue on mobile app" instead of "Bug")
- Describe the problem or request in detail in the Description field
- Set a realistic due date
- Choose the right priority:
  - **Low**: Nice-to-have, not urgent
  - **Medium**: Normal workflow items
  - **High**: Urgent, needs attention soon

---

## 5. Viewing & Managing Tickets

### 5.1 The Ticket Table
The main table displays all tickets you have access to. You can:

- **Scroll horizontally** to see all columns
- **Click column headers** (S.No, Title, Status, Priority) to sort
- **Paginate** using the "Prev" and "Next" buttons at the bottom

### 5.2 Color Indicators
- **Red border on the left**: Indicates an **Overdue** ticket (past due date and still open)
- **Red chip**: Ticket status is "Rejected"
- **Blue chip**: Ticket status is "Open"

### 5.3 Attachment Icon
- **Eye icon**: Click to view/download the attached file
- **"--NA--"**: No attachment is available for this ticket

---

## 6. Editing a Ticket

To edit an existing ticket:

1. Find the ticket in the table.
2. Click the **Edit** button (pencil icon) in the Actions column.
3. Modify the fields you need to change.
4. Click **"Update Ticket"**.

> **Note**: You can only edit a ticket if:
> - You are the **creator** of the ticket, OR
> - You are an **assigned user** (can edit title and description), OR
> - You are a **Management** user (can edit everything)

### Fields You Can Edit:
| Field | Who Can Edit |
|-------|-------------|
| Title | Creator, Assignee, Management |
| Description | Creator, Assignee, Management |
| Priority | Creator, Assignee, Management |
| Due Date | Creator or Management only |
| Status | Creator (to Closed); Management (to Rejected/Closed) |
| Assignees | Management can assign multiple; others can assign one |

---

## 7. Assigning Tickets to Users

### For Management Users:
1. Click **Edit** on the ticket.
2. In the **"Assign To"** field, you will see a list of all users.
3. You can select **multiple users** by checking the checkboxes.
4. All selected users will receive a notification.

### For Non-Management Users:
1. Click **Edit** on the ticket.
2. In the **"Assign To"** dropdown, select **one user**.
3. You **cannot** assign tickets to Management-level users.

### Who Can Be Assigned?
- Any **active** user in the system
- **Exception**: Non-Management users cannot assign tickets to Management users

---

## 8. Changing Ticket Status

The ticket status shows where a ticket is in its lifecycle.

### Available Statuses:
- **Open**: Ticket has been created but not yet processed
- **Rejected**: Ticket has been declined (Management only)
- **Closed**: Ticket has been completed/resolved

### How to Change Status:
1. Click the **Edit** button on the ticket.
2. Find the **"Status"** dropdown.
3. Select the new status.
4. Click **"Update Ticket"**.

### Status Rules:
| From | To | Who Can Do This |
|------|-----|-----------------|
| Open | Rejected | Management only |
| Open | Closed | Creator or Management |
| Rejected | (none) | Cannot be changed |
| Closed | (none) | Cannot be changed |

---

## 9. Attachments

You can attach files to tickets for reference, evidence, or documentation.

### Adding an Attachment:
1. When creating or editing a ticket, look for the **"Attachment"** field.
2. Click **"Choose File"** or the file input area.
3. Select a file from your computer.
4. Save the ticket.

### Supported File Types:
- Documents: PDF, DOC, DOCX, TXT
- Images: JPG, PNG, GIF
- Other common formats

### Viewing an Attachment:
- In the ticket table, click the **eye icon** in the Attachment column.
- The file will open in a new tab or download automatically.

### Removing an Attachment:
- Edit the ticket.
- If you don't select a new file, the existing attachment remains.
- To remove, edit the ticket and the attachment will be cleared if a new one is not selected.

---

## 10. Deleting a Ticket

You can delete a ticket **only if its status is "Closed"**.

### Steps to Delete:
1. Find the closed ticket in the table.
2. Click the **Delete** button (trash icon) in the Actions column.
3. A confirmation popup will appear: "Are you sure you want to delete this ticket?"
4. Click **"Delete"** to confirm, or **"Cancel"** to keep the ticket.

> **Warning**: Deleted tickets cannot be recovered. Make sure the ticket is truly finished before deleting.

---

## 11. Searching & Filtering Tickets

When you have many tickets, use these tools to find what you need quickly.

### 11.1 Search Bar
- Located at the top of the ticket table.
- Type any keyword to search in **Title**, **Description**, **Status**, or **Priority**.
- Results update instantly as you type.

### 11.2 Filters Panel
Click the **"Filters"** button to open advanced filters:

| Filter | Options | Description |
|--------|---------|-------------|
| **Assignee** | Any + user names | Filter tickets by assigned person |
| **Priority** | Any + Low/Medium/High | Filter by priority level |
| **Status** | Any + Open/Closed | Filter by current status |
| **Options** | Only overdue checkbox | Show only overdue tickets |

- Click **"Clear"** to reset all filters.

### 11.3 Quick Filters
- **All**: Shows all accessible tickets.
- **Mine**: Shows only tickets assigned to you.

### 11.4 Sorting
Click any column header to sort:
- **S.No**: Sort by ticket ID
- **Title**: Sort alphabetically
- **Status**: Sort by status name
- **Priority**: Sort by priority level

Click again to reverse the sort order (ascending/descending).

---

## 12. Ticket Statuses Explained

| Status | Meaning | Who Sets It |
|--------|---------|-------------|
| **Open** | Ticket has been raised and is waiting to be worked on | System (default) |
| **Rejected** | Ticket has been declined by Management | Management only |
| **Closed** | Ticket work is complete | Creator or Management |

---

## 13. Ticket Priorities Explained

| Priority | Meaning | When to Use |
|----------|---------|-------------|
| **Low** | Minor issue or request | Non-urgent tasks, improvements |
| **Medium** | Standard priority | Regular workflow items |
| **High** | Urgent attention needed | Critical issues, approaching deadlines |

---

## 14. Notifications

You will receive in-app notifications when:

| Event | Who Gets Notified |
|-------|-------------------|
| Ticket is created and you are assigned | Assigned user(s) |
| Ticket is rejected | The ticket creator |
| Ticket is reassigned to you | Newly assigned user(s) |

> **Note**: Make sure your notifications are turned on in your account settings.

---

## 15. Calendar Integration

Tickets also appear on your **Calendar** page:

- Each day that has tickets shows a small **ticket icon** or indicator.
- Click on a day to see the **Ticket Modal** with all tickets for that date.
- The modal shows: S.No, Title, Description, Priority, Assigned To, and Due Date.
- This helps you plan your work alongside your leave schedule.

---

## 16. Role-Based Permissions

Different users have different capabilities in the Ticket System.

| Feature | Employee | HOD | Management | Admin |
|---------|----------|-----|------------|-------|
| View all tickets | No | No | Yes | Yes |
| View own & assigned tickets | Yes | Yes | Yes | Yes |
| Create ticket | Yes | Yes | Yes | Yes |
| Edit title/description | Own/Assigned only | Own/Assigned only | All | All |
| Edit due date | Creator only | N/A | All | All |
| Change status to Closed | Creator only | N/A | Creator + Management | All |
| Reject tickets | No | No | Yes | Yes |
| Assign multiple users | No | No | Yes | Yes |
| Assign single user | Yes | Yes | Yes | Yes |
| Delete ticket | Creator (Closed only) | N/A | Creator (Closed only) | All |
| View charts/analytics | No | No | Yes | Yes |

---

## 17. Best Practices

### For Ticket Creators:
1. **Be specific**: Write a clear title and detailed description
2. **Set realistic due dates**: Don't rush, but don't set distant deadlines
3. **Choose the right priority**: Help assignees understand urgency
4. **Assign wisely**: Pick the person best suited for the task

### For Assignees:
1. **Check regularly**: Look at your "Mine" filter to see assigned tickets
2. **Update status**: Close the ticket when work is complete
3. **Communicate**: Use the description or attach files to provide updates

### For Management:
1. **Review regularly**: Use the charts to spot overdue or high-priority tickets
2. **Reject with care**: Only reject when necessary, and inform the creator
3. **Assign fairly**: Distribute tickets based on team capacity

---

## 18. Frequently Asked Questions

**Q: Can I create a ticket for someone else?**
A: Yes, if you are Management. Otherwise, you can only create tickets for yourself.

**Q: Why can't I edit a ticket?**
A: You can only edit tickets that you created, are assigned to, or if you are a Management user.

**Q: Can I assign a ticket to multiple people?**
A: Only Management users can assign tickets to multiple people. Other users can assign to only one person.

**Q: What happens when I reject a ticket?**
A: The ticket status changes to "Rejected" and the creator receives a notification. The ticket cannot be reopened.

**Q: Can I reopen a closed ticket?**
A: No. Once a ticket is closed, its status cannot be changed. You would need to create a new ticket.

**Q: Why can't I delete a ticket?**
A: Tickets can only be deleted when their status is "Closed". Open or Rejected tickets cannot be deleted.

**Q: What file types can I attach?**
A: Most common file types are supported, including PDFs, Word documents, Excel files, and images.

**Q: Who can see my tickets?**
A: Management can see all tickets. Other users can only see tickets they created or are assigned to.

**Q: What does "Overdue" mean?**
A: A ticket is overdue if its due date has passed and the ticket is still not closed.

**Q: How do I find tickets assigned to me?**
A: Click the **"Mine"** filter button, or use the Assignee filter and select your name.

---

## Need Help?

If you encounter any issues or have questions about the Ticket System, please contact your system administrator or IT support team.

---

*This manual is for the HYLOC-MGT Ticket Module. For technical documentation, refer to `TICKET_MODULE.md`.*
