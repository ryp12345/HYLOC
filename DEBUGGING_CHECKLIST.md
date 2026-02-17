# NO DATA VISIBLE - Debugging Checklist

## Step 1: Check Browser Console (CRITICAL)

### Open Browser Developer Tools
- Press `F12` or Right-click → Inspect
- Go to **Console** tab
- Clear console (press Ctrl+L or click 🚫)
- Refresh the page

### Look for These Logs:

#### 1. API Request Logs (Blue 🔵)
```
🔵 API Request: GET /kpis
🔵 API Request: GET /kpi-values?kpi_id=123
```
**If you DON'T see these** → API calls aren't being made

#### 2. API Response Logs (Green 🟢)
```
🟢 API Response: /kpis - Status: 200 - Data count: 50
🟢 API Response: /kpi-values - Status: 200 - Data count: 150
```
**If you see "Data count: 0"** → Database has no data
**If you see "Data count: N/A"** → Response structure is wrong

#### 3. Error Logs (Red 🔴)
```
🔴 [AXIOS] Error status: 401
🔴 [AXIOS] Error: Authorization token is missing
```
**If you see 401/403** → Authentication problem
**If you see 500** → Server error

## Step 2: Check Server Console (Terminal)

### Look for These Logs:

#### 1. Authentication Success
```
✅ AUTH: Decoded token: { userId: 123, email: 'user@example.com', role: 'Management' }
```
**Check:** Is the role correct? ('Management', 'Employee', 'Manager', 'Admin')

#### 2. KPI Values Request
```
[KPI Values] Request from user: { userId: 123, userRole: 'management', kpi_id: undefined }
[KPI Values] Returning all values for management/admin: 150
```
**What to check:**
- Is `userId` a valid number?
- Is `userRole` lowercase and correct? ('management', 'employee', 'manager', 'admin')
- How many values are being returned?

#### 3. Monthly Data Request
```
[Monthly Data] Request from user: { userId: 123, userRole: 'management', kpiValueId: '45', year: '2025' }
[Monthly Data] Access granted for management/admin
```

## Step 3: Check localStorage

### In Browser Console, run:
```javascript
console.log('Access Token:', localStorage.getItem('accessToken'));
console.log('User:', JSON.parse(localStorage.getItem('user')));
```

**Check:**
- Is there an `accessToken`?
- Does the user object have a `role` field?
- What is the role value?

## Step 4: Common Issues & Solutions

### Issue 1: "Authorization token is missing" (401)
**Cause:** Not logged in or token expired
**Solution:**
1. Logout and login again
2. Check if token exists: `localStorage.getItem('accessToken')`
3. If null, login is required

### Issue 2: "Data count: 0" - No data returned
**Cause:** Empty database OR incorrect filtering
**For Management users:**
- Server logs should show: "Returning all values for management/admin"
- Check database: 
  ```sql
  SELECT COUNT(*) FROM kpi_values;
  SELECT COUNT(*) FROM kpis;
  ```
**For Employee users:**
- Server logs should show: "Filtered for employee/manager: X of Y"
- If X=0, employee is not assigned any KPI values
- Check database:
  ```sql
  SELECT * FROM kpi_values WHERE "data operator" = <employee_id>;
  ```

### Issue 3: Role mismatch
**Symptoms:** Management user being filtered like Employee
**Check server logs for:**
```
✅ AUTH: Decoded token: { userId: 123, email: 'user@example.com', role: 'XXXX' }
```
**If role is wrong:**
1. Check JWT token generation in `auth.service.js`
2. Check database `user_roles` table:
   ```sql
   SELECT u.email, r.role_name 
   FROM users u
   JOIN user_roles ur ON ur.user_id = u.id
   JOIN roles r ON r.id = ur.role_id
   WHERE u.id = <user_id>;
   ```
3. Role names should be: 'Management', 'Employee', 'Manager', 'Admin'
4. Code converts to lowercase for comparison

### Issue 4: Frontend shows loading forever
**Check:** Network tab in DevTools
- Are requests being sent?
- What's the status code?
- Is there a CORS error?

### Issue 5: "Failed to load KMI details"
**This is a Management-specific page issue**
1. Check Management Dashboard loads statistics
2. Check server logs when accessing KMI detail page
3. Look for errors in browser console

## Step 5: Quick Database Check

### Run these queries in your PostgreSQL:

```sql
-- Check if KPIs exist
SELECT COUNT(*) as kpi_count FROM kpis;

-- Check if KPI values exist
SELECT COUNT(*) as kpi_value_count FROM kpi_values;

-- Check if data exists
SELECT COUNT(*) as data_count FROM kpi_data_value;

-- Check user roles
SELECT u.id, u.empid, u.email, r.role_name 
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
LIMIT 10;

-- Check KPI value assignments
SELECT kv.id, kv.data, kv."data operator", u.empid, u.email
FROM kpi_values kv
LEFT JOIN users u ON u.id = kv."data operator"
LIMIT 10;
```

**Expected results:**
- kpi_count > 0
- kpi_value_count > 0
- Users should have role_name assigned

## Step 6: Report Back

After checking the above, report:
1. **What logs appear in Browser Console?**
2. **What logs appear in Server Console?**
3. **What is your user's role?** (from localStorage)
4. **What error messages do you see?** (if any)
5. **Database counts** (how many KPIs, values, data entries?)

This will help identify the exact issue!
