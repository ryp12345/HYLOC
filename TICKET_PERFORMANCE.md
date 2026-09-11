# Ticket Performance

## Overview

Ticket performance is shown on the Management Dashboard alongside staff KPI performance. It is a dashboard-level metric built from the ticket report data, using the assignee breakdown returned by the ticket reports API.

This score is meant to answer a simple question: how consistently is a user handling assigned tickets without letting them go overdue?

## Data Source

The dashboard reads the ticket report from:

- `GET /api/tickets/reports?fiscalYear=YYYY`

The report includes an `assignee_breakdown` array with these fields:

- `id` - user id
- `name` - assignee display name
- `assigned_count` - total tickets assigned in the selected fiscal year
- `overdue_count` - assigned tickets that were overdue while still open

The report is generated in [server/src/models/ticket.model.js](server/src/models/ticket.model.js) and exposed through [server/src/controllers/ticket.controller.js](server/src/controllers/ticket.controller.js).

## Calculation

The ticket performance score is calculated per user as:

```text
Ticket Performance = round(((assigned_count - overdue_count) / assigned_count) × 100)
```

### In Plain Terms

- Start with all tickets assigned to the user in the selected fiscal year.
- Subtract tickets that became overdue while still open.
- Convert the remaining share into a percentage.
- Round to the nearest whole number.

### Example

If a user had:

- `assigned_count = 20`
- `overdue_count = 3`

Then:

```text
Ticket Performance = round(((20 - 3) / 20) × 100)
                    = round(85)
                    = 85%
```

## Rules

- If `assigned_count = 0`, the score is `0%`.
- The final value is clamped between `0` and `100`.
- The score is calculated for the selected fiscal year only.
- It uses assignee data, so a user must appear in the report’s assignee breakdown to receive a score.

## What Counts As Overdue

The ticket report treats a ticket as overdue when:

- the ticket status is still open or active, and
- the due date has passed.

The report uses open-like statuses such as:

- `Open`
- `Assigned`
- `In Progress`
- `Pending`

Closed or rejected tickets are not counted as overdue in the report.

## How It Appears In the UI

On the Management Dashboard, each active staff card shows both:

- KPI performance
- Ticket performance

The ticket score is rendered from `ticketPerformanceData[user.id]` and is displayed as a badge next to the KPI badge.

## Important Notes

- This is a reporting metric, not a database column.
- It does not use the KPI formula engine.
- It is based on ticket assignment and overdue behavior, not ticket priority or ticket status distribution alone.

## Related Files

- [client/src/pages/management/ManagementDashboard.jsx](client/src/pages/management/ManagementDashboard.jsx)
- [server/src/models/ticket.model.js](server/src/models/ticket.model.js)
- [server/src/controllers/ticket.controller.js](server/src/controllers/ticket.controller.js)
- [client/src/pages/tickets/TicketsAnalysisReport.jsx](client/src/pages/tickets/TicketsAnalysisReport.jsx)
