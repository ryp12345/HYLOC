# KMI Module User Guide

## What is KMI?

KMI stands for **Key Management Indicators**. It is the main module where the company defines, tracks, and manages its important performance goals. Think of it as the central place where yearly targets are set and actual progress is recorded.

This guide explains how to use the KMI module in **simple language**.

---

## Two Ways to Access KMI

There are **three different views** of the same KMI data:

| Who Uses It | Where to Find It | What They Can Do |
|-------------|------------------|------------------|
| **Admin / HR** | Admin Menu -> KMI's | Create, edit, delete, and replicate KMIs. Manage KPI values and formulas. |
| **Management** | Management Menu -> KMI/Global Objectives | View KMIs and their performance analytics. No editing allowed. |
| **Employee** | Employee Menu -> My KPIs/KAIs | Enter monthly actual and target data for assigned KPIs. View computed results. |

---

## Part 1: Admin Side (Full Control)

Admins and authorized users can manage everything here.

---

### 1.1 KMI List Page (Admin)

**Path:** Admin Menu -> KMI's

**What you see:**
- A **tree structure** showing KMIs organized by parent-child relationships.
- Only KMIs belonging to the category **"KMI / GLOBAL OBJECTIVES"** are shown at the top level.
- Each KMI shows its title, category tags, financial year, and type (Manual or Computed).

**Tools available:**
- **Financial Year selector:** Choose which year's KMIs to view (e.g., 2025-26).
- **Search box:** Type a KMI title to find it quickly. The tree auto-expands to show matching items.
- **Expand All / Collapse All:** Open or close all parent KMIs at once.
- **Add KMI (+):** Create a new top-level KMI.
- **Replicate from Previous Year:** Copy KMIs from a past year into the current year.

**Icons on each KMI card:**
- **Eye (👁️):** View details and analytics of this KMI.
- **Plus (+):** Add a child KMI under this one.
- **Pencil (✏️):** Edit this KMI.
- **Trash (🗑️):** Delete this KMI.

---

### 1.2 Add or Edit a KMI

When you click **Add KMI** or the **Edit (✏️)** icon, a form opens.

**Fields in the form:**

| Field | Description |
|-------|-------------|
| **Financial Year** | The year this KMI belongs to (e.g., 2025-26). Financial year runs from April to March. |
| **Category** | Select one or more categories. Main category is usually "KMI / GLOBAL OBJECTIVES". |
| **Department** | Required only if you selected "Department KPI" category. Choose which department this KMI belongs to. |
| **Employee** | Required only if you selected "Employee KPI" category. Choose which employee this KMI is for. |
| **Parent KMI** | If you want this to be a child of another KMI, select the parent. Leave empty for a top-level KMI. |

**Rules to remember:**
- You cannot delete a KMI that has child KMIs. Delete the children first.
- If you replicate from a previous year, it copies the whole structure but does not copy monthly data entries.

---

### 1.3 Replicate KMIs from Previous Year

This feature saves time when starting a new financial year.

**How to use:**
1. Click **"Replicate from Previous Year"** on the KMI list page.
2. Select which previous year to copy from.
3. A list of KMIs from that year appears with checkboxes.
4. **Select the KMIs you want to copy.** If you select a parent, all its children are automatically selected.
5. Click **"Replicate Selected KMIs"**.

**What gets copied:**
- KMI titles, categories, parent-child structure.
- KPI values and their settings (formulas, units, pillars, operators).
- Department and employee mappings.

**What does NOT get copied:**
- Monthly actual/target data entries. You start fresh for the new year.

**Warning:** If KMIs already exist for the current year, the system warns you that replication will add new ones without removing existing ones.

---

### 1.4 KMI Detail Page (Admin)

**Path:** Click the **Eye (👁️)** icon on any KMI, or go directly to `/admin/kmis/:id`

This page shows everything about one specific KMI.

**Top section:**
- KMI Title and Financial Year.

**KPI Values Table:**
A KPI Value is a specific measurement under a KMI. For example, if KMI is "Sales", KPI Values might be "Monthly Sales Amount" and "Number of New Customers".

| Column | Meaning |
|--------|---------|
| **Type** | Manual (entered by person) or Computed (calculated by system using formula). |
| **Data** | The name of this KPI value. |
| **Data Operator** | The person responsible for entering data for this KPI value. |
| **Unit of Measurement** | e.g., Rupees, Percentage, Numbers, Tons. |
| **Pillar** | Which strategic pillar this belongs to (e.g., Safety, Quality, Delivery). |
| **Target Required** | Yes = user must enter both target and actual values. No = only actual values are entered. |
| **Performance** | Shows achievement percentage and trend arrow. |

**Actions on each KPI Value:**
- **Edit (✏️):** Change settings, formulas, or assignments.
- **Delete (🗑️):** Remove this KPI value permanently.

---

### 1.5 Add or Edit a KPI Value

When you click **+ Add Value** or **Edit**, a form opens.

**Basic Fields:**

| Field | Description |
|-------|-------------|
| **Data/Name** | Name of this KPI value (e.g., "Monthly Revenue"). |
| **KPI Type** | Manual = someone enters values. Computed = system calculates it. |
| **Unit of Measurement** | Select from the list (e.g., Rupee, Percentage, Numbers). |
| **Pillar** | Select which pillar this KPI value supports. |
| **Data Operator** | The employee who will enter monthly data for this value. |
| **Target Required** | Check if you need both target and actual values. |
| **Default Target Value** | A pre-filled target suggestion (optional). |

**If KPI Type is "Computed":**
The system calculates the value using a formula instead of manual entry.

**Computation Type options:**
1. **Actual computed; target uses default** - System calculates actual value. Target comes from the default value you set.
2. **Actual manual; target computed** - You enter actual values. System calculates target using formula.
3. **Both actual and target computed** - System calculates both using formulas.

**How to write a formula:**
- Use `v1`, `v2`, `v3` etc. to refer to other KPI values.
- Use normal math: `+`, `-`, `*`, `/`, `%`
- Special functions: `CUMSUM(v1)` adds up values from April to current month. `AVERAGE(v1, v2)` finds the average.

**Example:** If you want to calculate "Percentage of Target Achieved", and KPI value #5 is Actual and #6 is Target, your formula could be:
```
v5*100/v6
```

**Steps to set up a formula:**
1. Type the formula in the formula box (e.g., `v5*100/v6`).
2. The system detects variables (v5, v6).
3. For each variable, search and select the actual KPI value it refers to.
4. The "Resolved preview" shows exactly what the system will calculate.

---

### 1.6 Analytics Section (Admin KMI Detail)

Below the KPI Values table, each KPI value has an **Analytics** section.

**What it shows:**
- **Overall Achievement:** Total percentage achieved against targets.
- **Average Monthly Achievement:** Average of all monthly percentages.
- **Best Month:** Which month performed the best.
- **Trend:** Whether performance is improving, declining, or stable.
- **Bar Chart:** Visual comparison of Actual vs Target for each month.

**No data message:**
If no monthly data has been entered, the system shows a helpful message explaining what needs to be entered to see analytics.

---

## Part 2: Management Side (Read-Only)

Management users view KMI performance. They cannot edit or create anything here.

---

### 2.1 KMI List Page (Management)

**Path:** Management Menu -> KMI/Global Objectives

**What you see:**
- A simplified tree view of all KMIs for the selected financial year.
- Each KMI card shows title, category, and financial year.
- A **View (👁️)** button to open details.

**Tools available:**
- **Financial Year selector:** Switch between years.
- **Search box:** Find KMIs by title.

---

### 2.2 KMI Detail Page (Management)

**Path:** Click **View (👁️)** on any KMI, or go to `/management/kmis/:id`

**What you see:**

**1. Overall Performance Summary (Top Cards)**
- **Average Achievement:** Overall percentage across all KPIs in this KMI.
- **KPI Coverage:** How many KPIs have data vs total KPIs (e.g., 8/10).
- **Overall Status:** Green = Exceeding Targets, Yellow = On Track, Red = Needs Attention.

**2. KPI Values Table**

| Column | Meaning |
|--------|---------|
| **Type** | Manual or Computed. |
| **Data** | Name of the KPI value. |
| **Data Operator** | Person responsible for data entry. |
| **Unit of Measurement** | e.g., Rupee, Percentage. |
| **Pillar** | Strategic pillar name. |
| **Target Required** | Yes or No. |
| **Performance** | Achievement percentage and trend arrow. |

**3. Analytics for Each KPI Value**
When you expand any KPI value, you see:
- Summary cards with key metrics.
- A bar chart showing monthly actual vs target values.
- Trend indicators.

---

## Part 3: Employee Side (Data Entry)

Employees use this page to enter monthly data for the KPIs assigned to them. This is where the actual numbers get recorded each month.

---

### 3.1 My KPIs/KAIs Page (Employee)

**Path:** Employee Menu -> My KPIs/KAIs

**What you see:**
- A list of **only the KPIs assigned to you** for the selected financial year.
- Each KPI card shows the title, number of values, and category.
- A **▼ Enter Data** button to expand and fill in monthly values.

**Tools available:**
- **Financial Year selector:** Choose which year's data you want to enter (e.g., 2025-26).
- **Search box:** Type a KPI title to find it quickly.

**Important:** You will only see KPIs that your admin has assigned to you. If you see a message saying "No KPIs assigned," contact your administrator.

---

### 3.2 How to Enter Monthly Data

**Step 1:** Click the **▼ Enter Data** button on any KPI card.

**Step 2:** The card expands and shows all KPI Values under that KPI. Each value has a grid of **12 months** (April to March).

**Step 3:** For each month, click the month box and enter the required values.

**What you need to enter depends on the KPI type:**

| KPI Type | What You Enter | What System Does |
|----------|---------------|------------------|
| **Manual** | Enter both Target and Actual values yourself. | Nothing - system just stores your values. |
| **Actual Computed** | Enter Target value. Actual is calculated automatically. | System calculates Actual using formula. |
| **Target Computed** | Enter Actual value. Target is calculated automatically. | System calculates Target using formula. |
| **Both Computed** | Nothing to enter manually. | System calculates both Actual and Target using formulas. |

---

### 3.3 Manual Data Entry (Most Common)

When a KPI value is **Manual**, you will see month boxes like this:

**If Target Required = Yes:**
- You must enter **Target** (what you plan to achieve) and **Actual** (what you actually achieved) for each month.

**If Target Required = No:**
- You only enter **Actual** values. No target is needed.

**How to enter:**
1. Click on a month box (e.g., "April").
2. The box turns blue and shows input fields.
3. Type the Target value (if required) and Actual value.
4. Click **Save**.
5. The box shows your saved values. Click **Edit** anytime to change them.

**Buttons:**
- **Add Data:** Shows when no value has been entered yet for that month.
- **Edit:** Shows when a value already exists. Click to modify it.
- **Save:** Saves your entered values.
- **Cancel:** Discards changes and closes the edit mode.

---

### 3.4 Computed KPI Values (Formula-Based)

Some KPIs are **Computed**, meaning the system calculates values automatically using formulas. You may still need to enter some inputs.

**Three types of computed KPIs:**

**Type 1: Actual Computed; Target Manual**
- You enter the **Target** value.
- The system automatically calculates the **Actual** value using a formula.
- The month box shows "🔧 Computed" next to the actual value.

**Type 2: Actual Manual; Target Computed**
- You enter the **Actual** value.
- The system automatically calculates the **Target** value using a formula.
- The month box shows "🔧 Computed" next to the target value.

**Type 3: Both Actual and Target Computed**
- You do not enter anything manually.
- Both values are calculated by the system.
- You just monitor the results.

**Viewing Formula Details:**
- If a computed KPI has an eye icon (👁️), click it to see the formula details.
- A popup shows:
  - The formula being used (e.g., `v5*100/v6`).
  - The dependent KPI values and their current values.
  - How the final number was calculated.

---

### 3.5 Understanding the Month Box Colors

| Color | Meaning |
|-------|---------|
| **White** | Normal state - no data entered yet, or data already saved. |
| **Blue border** | Currently editing - you are entering or changing values. |
| **Green background** | Computed value is available and calculated successfully. |
| **Yellow/Amber background** | Waiting for dependent KPI values. Another KPI's data is missing, so this one cannot be calculated yet. |

---

### 3.6 After You Save Data

**What happens when you click Save:**
1. Your data is saved to the system.
2. If there are any **computed KPIs** that depend on the value you just entered, the system automatically recalculates them.
3. A notification appears: "Data saved successfully! Computing dependent KPIs..."
4. If any computed KPIs were updated, a green notice appears at the top showing the newly calculated values.
5. All month boxes refresh to show the latest values.

**Example:** If you enter actual sales for January, and there is a computed KPI for "Percentage Achievement" that uses your sales data, the system automatically updates the achievement percentage for January.

---

### 3.7 Tips for Employees

- **Enter data regularly:** Try to enter your monthly values as soon as the month ends.
- **Check before saving:** Make sure the numbers are correct before clicking Save. You can edit later if needed.
- **Look for the eye icon:** Click 👁️ on computed KPIs to understand how the system calculated a value.
- **Watch for amber warnings:** If a month box is yellow/amber, it means another related KPI is missing data. Enter that data first.
- **Contact admin if stuck:** If you cannot see a KPI that you should be entering data for, ask your administrator to assign it to you.
- **Default targets:** Some KPIs have a default target value pre-filled. You can use it or enter your own.

---

### 3.8 Common Employee Questions

**Q: I don't see any KPIs on my page. What should I do?**
A: Contact your administrator. They need to assign KPIs to your employee profile.

**Q: Can I edit data after I have saved it?**
A: Yes. Click the **Edit** button on any month box, change the values, and click **Save** again.

**Q: Why is a computed KPI showing "Not Available"?**
A: The formula depends on other KPI values. Make sure all those dependent KPIs have data entered for the same month.

**Q: What if I make a mistake?**
A: Click **Edit**, correct the value, and click **Save**. The system will update the record.

**Q: Who can see my entered data?**
A: Your HOD, management users, and admins can view the data you enter for performance tracking.

---

## Important Terms Explained

| Term | Simple Explanation |
|------|-------------------|
| **KMI (Key Management Indicator)** | A big goal or focus area for the company for a specific year. Example: "Improve Customer Satisfaction". |
| **KPI Value** | A specific measurement under a KMI. Example: "Monthly Customer Complaint Count". |
| **Financial Year (FY)** | The company's accounting year. Runs from **April 1 to March 31**. Example: FY 2025-26 means April 2025 to March 2026. |
| **Pillar** | A strategic area like Safety, Quality, Delivery, Cost, etc. KMIs are linked to pillars. |
| **Category** | Type of KMI. Examples: "KMI / GLOBAL OBJECTIVES", "Department KPI", "Employee KPI". |
| **Parent/Child KMI** | Parent is a main goal. Children are smaller goals that support the parent. Like chapters and sections in a book. |
| **Manual KPI** | A value that a person types into the system every month. |
| **Computed KPI** | A value that the system calculates automatically using a formula. |
| **Target Required** | If Yes, you must set a target and enter actual values. If No, you only enter actual values. |
| **Data Operator** | The employee responsible for entering monthly data for a KPI value. |
| **Unit of Measurement (UOM)** | What the numbers mean. e.g., Rupees (money), Percentage (%), Numbers (count), Tons (weight). |
| **Replicate** | Copy KMIs from a previous year to the current year to save time. |
| **Achievement %** | (Actual Value / Target Value) x 100. Shows how much of the target was reached. |
| **Trend** | Shows if performance is going up (improving), down (declining), or staying the same (stable). |

---

## How Monthly Data Entry Works

Monthly data is entered by employees through the **My KPIs/KAIs** page:

1. **Employee enters data:** Go to Employee Menu -> My KPIs/KAIs. Expand any KPI and enter monthly Target and/or Actual values in the month boxes.
2. **Admin/KmiDetail** shows where data should be entered and who is responsible.
3. **Management/MgtKmiDetail** shows the results after data is entered.

**To see analytics:**
- For target-required KPIs: Enter both target and actual values for each month.
- For non-target KPIs: Enter only actual values for each month.

**Computed KPIs:** If a KPI is computed, the system automatically calculates values using formulas once the dependent data is entered. Employees may still need to enter some inputs (like actual values) depending on the computation type.

---

## Common Tasks - Quick Steps

### How to create a new KMI (Admin)
1. Go to Admin Menu -> KMI's.
2. Select the Financial Year.
3. Click **+ Add KMI**.
4. Enter title, select category.
5. If it is a Department or Employee KPI, select the department or employee.
6. Click Create.

### How to add a child KMI
1. Find the parent KMI in the tree.
2. Click the **Plus (+)** icon on the parent.
3. Enter the child KMI details.
4. Click Create.

### How to replicate last year's KMIs
1. Go to Admin Menu -> KMI's.
2. Select the new Financial Year.
3. Click **Replicate from Previous Year**.
4. Select the year to copy from.
5. Check the KMIs you want to copy.
6. Click **Replicate Selected KMIs**.

### How to add a KPI Value to a KMI
1. Go to Admin Menu -> KMI's.
2. Click the **Eye (👁️)** icon on the KMI.
3. Click **+ Add Value**.
4. Fill in the name, type, unit, pillar, and data operator.
5. If it is computed, set up the formula.
6. Click Create.

### How to set up a computed KPI value
1. When adding/editing a KPI value, set KPI Type to **Computed**.
2. Choose Computation Type (actual computed, target computed, or both).
3. Type your formula using v1, v2, etc.
4. Assign each variable to an actual KPI value from the list.
5. Click Create or Update.

### How to view performance (Management)
1. Go to Management Menu -> KMI/Global Objectives.
2. Select the Financial Year.
3. Click **View (👁️)** on any KMI.
4. See overall summary cards and expand individual KPI values for detailed charts.

### How to enter monthly KPI data (Employee)
1. Go to Employee Menu -> My KPIs/KAIs.
2. Select the Financial Year.
3. Find the KPI you need to update and click **▼ Enter Data**.
4. For each month, click the month box.
5. Enter Target and/or Actual values as required.
6. Click **Save**.
7. If there are computed KPIs, the system will automatically recalculate them.

### How to edit previously entered data (Employee)
1. Go to Employee Menu -> My KPIs/KAIs.
2. Expand the KPI and find the month you want to change.
3. Click **Edit** on that month box.
4. Change the values.
5. Click **Save**.
6. The system will update the record and recalculate any dependent computed KPIs.

### How to understand computed values (Employee)
1. Enter the required data for a KPI value.
2. If a computed KPI depends on it, wait a few seconds after saving.
3. Look for the green "Recently Auto-Computed" notice at the top.
4. Click the **👁️** eye icon on any computed month to see the formula and how the value was calculated.

---

## Need Help?

If you are unsure about:

**For Employees:**
- **No KPIs visible:** Contact your administrator to assign KPIs to your profile.
- **How to enter data:** Follow the steps in Part 3. Click any month box to start entering values.
- **Computed values not showing:** Make sure all dependent KPIs have data entered for that month.
- **Wrong values entered:** Click Edit on the month box, correct the value, and Save.

**For Admins:**
- **Formulas:** Check the formula help icon in the KPI Value form.
- **Categories:** Contact your system administrator.
- **Data Entry assignments:** Check with your assigned Data Operator or HOD.

---

*This guide covers the KMI module as of the current system version.*
