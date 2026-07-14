import React, { useEffect, useState, useMemo, useRef } from 'react';
import { getMonthlyWorkingDaysStaff, importMonthlyWorkingDays } from '../../../api/leaveEntitlementApi';

const MONTH_NAMES = [
  'January','February','March','April','May','June','July','August','September','October','November','December'
];

const MonthlyAttendancePage = ({ token: propToken }) => {
  const currentYear = new Date().getFullYear();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [monthlyStaff, setMonthlyStaff] = useState([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [uploadSummary, setUploadSummary] = useState(null);
  const fileInputRef = useRef(null);
  const uploadSummaryTimeoutRef = useRef(null);
  const successTimeoutRef = useRef(null);
  const token = propToken || localStorage.getItem('accessToken');

  useEffect(() => { loadMonthlyData(); }, [month, token]);

  const parseCsvLine = (line) => {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = line[i + 1];
      if (ch === '"') {
        if (inQuotes && next === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) { cells.push(current.trim()); current = ''; } else { current += ch; }
    }
    cells.push(current.trim());
    return cells;
  };

  const normalizeHeader = (header) => (header || '').toString().replace(/\s+/g, '').toLowerCase();

  const loadMonthlyData = async () => {
    if (!token) { setError('No authentication token found. Please login.'); return; }
    setMonthlyLoading(true);
    try {
      const response = await getMonthlyWorkingDaysStaff(month, token);
      setMonthlyStaff(response.data?.staff || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load monthly working days');
    }
    setMonthlyLoading(false);
  };

  const handleDownloadTemplate = () => {
    const headers = ['S.No', 'EmployeeName', 'EmployeeID', 'NoOFDays'];
    const rows = monthlyStaff.map((s, idx) => {
      const workingDays = s.monthly_working_days?.no_of_days ?? '';
      return [idx + 1, `${s.firstname || ''} ${s.lastname || ''}`.trim(), s.empid || '', workingDays];
    });
    const escapeCsvCell = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const csvContent = [headers.join(','), ...rows.map((row) => row.map(escapeCsvCell).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monthly_working_days_${MONTH_NAMES[month - 1].toLowerCase()}_${currentYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUploadButtonClick = () => { if (fileInputRef.current) fileInputRef.current.click(); };

  const handleUploadCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(''); setSuccessMessage(''); setUploadSummary(null); setUploadingCsv(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0);
      if (lines.length < 2) throw new Error('CSV file must contain a header and at least one data row');
      const headerCells = parseCsvLine(lines[0]);
      const headerIndex = new Map(headerCells.map((h, i) => [normalizeHeader(h), i]));
      const idxUserId = headerIndex.get('userid');
      const idxEmpId = headerIndex.get('employeeid') ?? headerIndex.get('empid');
      const idxDays = headerIndex.get('noofdays');
      if (idxEmpId === undefined || idxDays === undefined) throw new Error('CSV headers must include EmployeeID and NoOFDays');
      const staffByEmpId = new Map(monthlyStaff.filter(s=>s.empid!==null&&s.empid!==undefined).map(s=>[String(s.empid).trim().toLowerCase(), s]));
      const staffById = new Map(monthlyStaff.map(s=>[String(s.id), s]));
      const unmatchedIds = new Set(); const invalidRows = []; const mappedByUser = new Map(); let skippedRows = 0;
      for (let i = 1; i < lines.length; i++) {
        const rowNumber = i + 1; const cells = parseCsvLine(lines[i]);
        const empIdRaw = idxEmpId !== undefined ? (cells[idxEmpId] || '').trim() : '';
        const userIdRaw = idxUserId !== undefined ? (cells[idxUserId] || '').trim() : '';
        const daysRaw = (cells[idxDays] || '').trim();
        if (!empIdRaw && !userIdRaw && !daysRaw) { skippedRows++; continue; }
        if ((!empIdRaw && !userIdRaw) || !daysRaw) { invalidRows.push(rowNumber); continue; }
        const leaveDays = Number(daysRaw);
        if (!Number.isFinite(leaveDays) || leaveDays < 0) { invalidRows.push(rowNumber); continue; }
        let staffMatch = null;
        if (userIdRaw) {
          const uid = Number(userIdRaw);
          if (Number.isFinite(uid) && staffById.get(String(uid))) { staffMatch = staffById.get(String(uid)); } else { unmatchedIds.add(userIdRaw); continue; }
        } else {
          staffMatch = staffByEmpId.get(empIdRaw.toLowerCase()); if (!staffMatch) { unmatchedIds.add(empIdRaw); continue; }
        }
        mappedByUser.set(String(staffMatch.id), { user_id: staffMatch.id, no_of_days: leaveDays });
      }
      const assignments = Array.from(mappedByUser.values());
      if (assignments.length > 0) await importMonthlyWorkingDays(month, assignments, token);
      await loadMonthlyData();
      setUploadSummary({ fileName: file.name, totalDataRows: lines.length - 1, updatedUsers: assignments.length, unmatchedEmployeeIds: Array.from(unmatchedIds), invalidRows, skippedRows });
      if (uploadSummaryTimeoutRef.current) clearTimeout(uploadSummaryTimeoutRef.current);
      uploadSummaryTimeoutRef.current = setTimeout(()=>setUploadSummary(null),4000);
      if (assignments.length > 0) {
        setSuccessMessage(`Upload successful. ${assignments.length} monthly working day record(s) updated for ${MONTH_NAMES[month - 1]} ${currentYear}.`);
        if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = setTimeout(()=>setSuccessMessage(''),4000);
      }
      if (assignments.length === 0) setError('No valid rows were found to update monthly working days.');
    } catch (err) { setError(err.message || 'Failed to upload CSV'); }
    finally { setUploadingCsv(false); event.target.value = ''; }
  };

  const monthlyAssignedCount = useMemo(() => monthlyStaff.filter((item) => item.monthly_working_days).length, [monthlyStaff]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [search, setSearch] = useState('');

  const getDisplayName = (staff) => {
    const fullName = `${staff.firstname || ''} ${staff.lastname || ''}`.trim();
    if (fullName) return fullName;
    if (staff.user_name) return staff.user_name;
    return staff.empid ? `ID:${staff.empid}` : '';
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const filteredData = monthlyStaff.filter(s => {
      const name = getDisplayName(s).toLowerCase();
      const emp = (s.empid || '').toString().toLowerCase();
      return name.includes(q) || emp.includes(q) || (s.user_name || '').toLowerCase().includes(q);
    });
    return filteredData.sort((a, b) => {
      const nameA = getDisplayName(a);
      const nameB = getDisplayName(b);
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });
  }, [monthlyStaff, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  return (
    <div className="min-h-screen px-4 py-12 bg-gradient-to-br from-gray-50 to-gray-100 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 rounded-xl border border-indigo-100 bg-white p-6 shadow-lg">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Monthly Working Days Input</h2>
              <p className="mt-1 text-sm text-gray-600">Select a month for the current year ({currentYear}), download the template, fill NoOfDays, and upload it back.</p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <select value={month} onChange={(e)=>setMonth(Number(e.target.value))} className="border px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                {MONTH_NAMES.map((monthName, index) => (<option key={monthName} value={index+1}>{monthName}</option>))}
              </select>
              <button onClick={handleDownloadTemplate} className="flex items-center justify-center px-6 py-3 font-medium text-white transition-all duration-300 transform rounded-lg shadow-lg bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-1 hover:scale-105" type="button" disabled={monthlyLoading}>Download Excel Template</button>
              <button onClick={handleUploadButtonClick} disabled={uploadingCsv||monthlyLoading} className="flex items-center justify-center px-6 py-3 font-medium text-white transition-all duration-300 transform rounded-lg shadow-lg bg-green-600 hover:bg-green-700 disabled:bg-green-300" type="button">{uploadingCsv? 'Uploading...' : 'Upload Excel'}</button>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4"><div className="text-sm font-medium text-gray-500">Month</div><div className="mt-1 text-xl font-semibold text-gray-900">{MONTH_NAMES[month - 1]}</div></div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4"><div className="text-sm font-medium text-gray-500">Current Year</div><div className="mt-1 text-xl font-semibold text-gray-900">{currentYear}</div></div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4"><div className="text-sm font-medium text-gray-500">Monthly Coverage</div><div className="mt-1 text-xl font-semibold text-gray-900">{monthlyAssignedCount} / {monthlyStaff.length}</div></div>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleUploadCsv} className="hidden" />
        </div>
          {successMessage && (<div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">{successMessage}</div>)}
          <div className="flex flex-col items-start justify-between gap-4 mb-6 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <input value={search} onChange={(e)=>{ setSearch(e.target.value); setPage(1); }} placeholder="Search by name or emp ID..." className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>
        {uploadSummary && (<div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><div className="font-semibold mb-1">Upload Summary ({uploadSummary.fileName})</div><div>Total rows processed: {uploadSummary.totalDataRows}</div><div>Users updated for {MONTH_NAMES[month - 1]} {currentYear}: {uploadSummary.updatedUsers}</div><div>Skipped blank rows: {uploadSummary.skippedRows}</div><div>Invalid rows: {uploadSummary.invalidRows.length > 0 ? uploadSummary.invalidRows.join(', ') : 'None'}</div><div>Unmatched Employee IDs: {uploadSummary.unmatchedEmployeeIds.length > 0 ? uploadSummary.unmatchedEmployeeIds.join(', ') : 'None'}</div></div>)}
        {error && <div className="text-red-500 mt-2">{error}</div>}

        <div className="mb-10 overflow-hidden bg-white shadow-xl rounded-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-600">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">S.No</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Emp ID</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">No. of Days</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.length === 0 ? (
                  <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-500">No monthly working days records found for this month</td></tr>
                ) : (
                  paginated.map((s, idx) => {
                    const md = s.monthly_working_days || null;
                    const noOfDays = md?.no_of_days ?? '-';
                    const name = getDisplayName(s);
                    return (
                      <tr key={s.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors duration-150`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{s.empid || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{Number.isInteger(Number(noOfDays)) ? Number(noOfDays) : noOfDays}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > PAGE_SIZE && (
            <div className="flex justify-end items-center gap-2 px-6 pb-6">
              <button className="px-3 py-1 rounded border border-gray-300 bg-white text-gray-700 disabled:opacity-50" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
              <span className="text-sm text-gray-700">Page {page} of {Math.ceil(filtered.length / PAGE_SIZE)}</span>
              <button className="px-3 py-1 rounded border border-gray-300 bg-white text-gray-700 disabled:opacity-50" onClick={() => setPage(p => Math.min(Math.ceil(filtered.length / PAGE_SIZE), p + 1))} disabled={page === Math.ceil(filtered.length / PAGE_SIZE)}>Next</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonthlyAttendancePage;