# Leave Entitlement and Leave Calculation - Current Implemented Behavior

This document explains what is currently implemented in HYLOC for leave entitlement and leave usage calculations.
It is written in business language, but keeps exact column names so implementation changes can be made safely.

## 1) Exact implementation files

These are the files that currently implement entitlement creation, annual entitlement generation, balance calculation, paid/unpaid split logic, and leave usage updates:

1. server/src/models/user.model.js
2. server/src/models/leaveEntitlement.model.js
3. server/src/services/leaveEntitlement.service.js
4. server/src/services/leave.service.js
5. server/src/models/leave.model.js
6. server/src/schedulers/leaveEntitlement.scheduler.js
7. server/src/server.js
8. server/database/migrations/008_create_leaves.sql
9. server/database/migrations/009_create_leaves_entitlement.sql

## 2) Columns used for entitlement and leave accounting

### A. leaves_entitlement table columns

1. id
2. user_id
3. year
4. leave_entitled
5. leaves_accumulated
6. leaves_availed
7. created_at
8. updated_at

Meaning in current implementation:

1. leave_entitled: base entitlement value for that year.
2. leaves_accumulated: carried amount brought forward from previous year.
3. leaves_availed: amount consumed from paid leave accounting.
4. leave balance: not stored as a separate physical column; it is calculated as:
   leave_entitled + leaves_accumulated - leaves_availed

### B. leaves table columns used in calculations

1. id
2. user_id
3. from_date
4. to_date
5. leave_duration
6. credited_days
7. leave_type
8. status
9. approved_by
10. leave_reason
11. alternate_person
12. additional_alternate
13. available_on_phone
14. created_at

Meaning in current implementation:

1. leave_duration drives whether leave is Full Day or half day.
2. credited_days is the numeric day amount for that record.
3. leave_type is Paid or Unpaid for that leave record.
4. status is one of Pending, Approved, Rejected, Cancelled.

## 3) How entitlement is created for a newly joined user

Current implemented flow:

1. When a new user is created, the system inserts a row in leaves_entitlement for the current calendar year.
2. The base formula used is:
   leave_entitled = 12 - current_month + 1
3. The inserted values are:
   - leave_entitled = computed value above
   - leaves_accumulated = 0.0
   - leaves_availed = 0.0
4. If a record for that user and year already exists, it is not duplicated.

Important implementation detail:

1. The formula uses the system current month at the time the user is created.
2. The active creation flow does not use a separate join_date field for this calculation.

## 4) How entitlement is created for users for a new year

Current implemented annual grant flow:

1. A scheduled job runs and calls annual entitlement grant for the current year.
2. For each user:
   - New row year = current year
   - leave_entitled = 12.0
   - leaves_availed = 0.0
   - leaves_accumulated = carryover from previous year
3. Carryover formula is:
   carryover = max(previous_year_leave_balance, 0)
4. previous_year_leave_balance is:
   previous leave_entitled + previous leaves_accumulated - previous leaves_availed
5. If there is already a row for that user and year, it is not duplicated.

Current scheduler timing as implemented:

1. The scheduler is active from server startup.
2. It runs using cron expression: 02 12 12 5 *
3. That expression is the currently implemented trigger timing for this annual process.

## 5) Leave balance and "available" calculation

Current implemented balance formula:

1. leave_balance = leave_entitled + leaves_accumulated - leaves_availed

Current implemented behavior when entitlement row does not exist:

1. A default entitlement row is created for that user/year.
2. Default values created:
   - leave_entitled = 12.0
   - leaves_accumulated = 0.0
   - leaves_availed = 0.0
3. Then leave_balance is calculated with the same formula.

Business interpretation used by UI/logic:

1. "Available" (or leave balance shown to users) comes from leave_balance formula above.

## 6) How Paid and Unpaid leave are calculated when applying leave

Step-by-step current implementation:

1. Leave day quantity is calculated as credited_days.
2. credited_days rules:
   - Morning Half or Afternoon Half: credited_days = 0.5 and to_date is forced to from_date.
   - Full Day: credited_days = inclusive day count from from_date to to_date.
3. The system fetches available balance using leave_balance formula.
4. Decision for leave_type:

   Case A: Half day leave
   1. If available balance >= 0.5, leave_type = Paid.
   2. Else leave_type = Unpaid.

   Case B: Full day leave and available balance >= credited_days
   1. Entire leave is one Paid record.

   Case C: Full day leave and available balance <= 0
   1. Entire leave is one Unpaid record.

   Case D: Full day leave and available balance is positive but less than credited_days
   1. Leave is split into two records.
   2. paidDays = minimum of floor(available balance) and floor(credited_days).
   3. unpaidDays = credited_days - paidDays.
   4. First segment is Paid for paidDays.
   5. Remaining segment is Unpaid for unpaidDays.

## 7) When leaves_availed is increased or decreased

### A. On leave apply

1. For Paid leave portion, leaves_availed is increased immediately by paid day amount.
2. For Unpaid leave portion, leaves_availed is not changed.
3. This increase happens at apply time, not at approve time.

### B. On leave update by leave owner

1. If credited_days changes and the leave is Paid, leaves_availed is adjusted by the difference.
2. difference = new credited_days - old credited_days.
3. If difference is positive, balance sufficiency is checked before increasing leaves_availed.
4. If difference is negative, leaves_availed is reduced by that negative adjustment.

### C. On leave cancel

1. If cancelled leave is Paid, leaves_availed is reduced by credited_days.
2. If cancelled leave is Unpaid, leaves_availed is not changed.
3. Then the leave record is deleted.

### D. On approve/reject

1. Approve and reject update status/approved_by only.
2. They do not recalculate or adjust leaves_availed in current implementation.

## 8) Current business rule summary (implemented state)

1. Entitlement accounting year is driven by the year value on leaves_entitlement and leave from_date year.
2. Newly created user gets current-year entitlement based on month formula 12 - month + 1.
3. Annual process creates next-year entries with full 12 entitlement and carryover as non-negative prior balance.
4. Paid versus Unpaid is determined at leave application time using then-current balance.
5. Full-day partial coverage is split into separate Paid and Unpaid leave records.
6. leaves_availed is the consumption tracker used in balance formula.
7. leaves_accumulated is the carry-forward component and is used in balance formula.
8. leave_balance is always computed, not stored as a physical database column.

## 9) Reference formulas (as implemented)

1. New user current-year entitlement:
   leave_entitled = 12 - current_month + 1

2. Carryover to new year:
   carryover = max((prev leave_entitled + prev leaves_accumulated - prev leaves_availed), 0)

3. Current year available balance:
   leave_balance = leave_entitled + leaves_accumulated - leaves_availed

4. Full-day split case:
   paidDays = min(floor(available balance), floor(credited_days))
   unpaidDays = credited_days - paidDays

************************************************************************




**Leave Entitlement Rules**

**1. Year of User/Employee Joining**
- No leaves are credited in the year the employee joins.

**2. Leaves Credited on Jan 1st of the Following Year**

**Step 1 — Find days remaining in the joining year:**
> Total days in joining year − Days elapsed before joining date
- "Days elapsed" = all days from Jan 1st up to (but not including) the joining date

**Step 2 — Find Sundays falling on or after the joining date (till Dec 31st)**

**Step 3 — Calculate working days:**
> Working days = Days remaining − Sundays (from Step 2)

**Step 4 — Calculate leaves:**
> Leaves = Working days ÷ 20, **rounded up**

**Step 5 — Apply cap:**
> If result > 15, credit only **15**

---

**Example — Joined March 7, 2024 (leap year):**
- Days elapsed (Jan 1 to Mar 6) = 31 + 29 + 6 = **66**
- Days remaining = 366 − 66 = **300**
- Sundays from Mar 7 to Dec 31, 2024 = **53**
- Working days = 300 − 53 = **247**
- Leaves = 247 ÷ 20 = 12.35 → rounded up = **13**
- 13 ≤ 15, so **13 days are credited on Jan 1, 2025**

---

**3. Every Subsequent Year (Jan 1st onwards)**
- A flat **15 days** is credited to the employee's leave account on every Jan 1st.

---

Leaves Encashed:

- Need to subtract leaves from the number the leaves available
- Example : If leaves available = 45 days
            Leaves to be encashed = 30 days
            Leaves balance = 45 - 30 = 15 days