import React, { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';

const parseFiscalYear = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const match = value.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : parseInt(value, 10);
  }
  return null;
};

const formatFiscalYear = (value) => {
  const parsedYear = parseFiscalYear(value);
  if (!parsedYear) return value || '-';
  return `${parsedYear}-${(parsedYear + 1).toString().slice(-2)}`;
};

const getCurrentFiscalYear = () => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month < 3 ? year - 1 : year;
};

const isPlantKpi = (kpi) => {
  const titleText = (kpi?.title || '').toLowerCase();
  const categoryText = (kpi?.category_name || kpi?.category || '').toLowerCase();

  return (
    titleText.includes('plant') ||
    titleText.includes('efficiency') ||
    titleText.includes('ope') ||
    categoryText.includes('plant') ||
    categoryText.includes('efficiency')
  );
};

const PlantEfficiency = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kpis, setKpis] = useState([]);
  const [plantCategoryId, setPlantCategoryId] = useState(null);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(getCurrentFiscalYear());
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    const loadKpis = async () => {
      try {
        setLoading(true);
        setError('');

        const [kpisResponse, categoriesResponse] = await Promise.all([
          api.get('/kpis'),
          api.get('/categories'),
        ]);

        const fetchedKpis = kpisResponse?.data?.data || [];
        const categories = categoriesResponse?.data?.data || [];
        const plantCategory = categories.find((category) => {
          const categoryName = (category?.category_name || '').toLowerCase();
          return categoryName === 'plant kpi' || categoryName.includes('plant kpi');
        });

        setPlantCategoryId(plantCategory?.id ?? null);
        setKpis(fetchedKpis);
      } catch (loadError) {
        console.error('Failed to load plant KPI list:', loadError);
        setError('Failed to load the plant KPI list.');
      } finally {
        setLoading(false);
      }
    };

    loadKpis();
  }, []);

  const plantKpis = useMemo(() => {
    if (plantCategoryId != null) {
      return kpis.filter((kpi) => String(kpi?.category_id) === String(plantCategoryId));
    }

    return kpis.filter(isPlantKpi);
  }, [kpis, plantCategoryId]);

  const availableFiscalYears = useMemo(() => {
    const years = new Set(
      plantKpis
        .map((kpi) => parseFiscalYear(kpi?.fin_year))
        .filter((year) => Number.isFinite(year))
    );

    return Array.from(years).sort((a, b) => a - b);
  }, [plantKpis]);

  useEffect(() => {
    if (availableFiscalYears.length === 0) return;

    if (!availableFiscalYears.includes(selectedFiscalYear)) {
      setSelectedFiscalYear(availableFiscalYears[0]);
    }
  }, [availableFiscalYears, selectedFiscalYear]);

  const selectedFiscalYearKpis = useMemo(() => {
    if (availableFiscalYears.length === 0) return plantKpis;

    return plantKpis.filter((kpi) => parseFiscalYear(kpi?.fin_year) === selectedFiscalYear);
  }, [availableFiscalYears.length, plantKpis, selectedFiscalYear]);

  const filteredKpis = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return [...selectedFiscalYearKpis]
      .filter((kpi) => {
        if (!query) return true;

        const searchableValues = [
          kpi?.title,
          kpi?.description,
          kpi?.fin_year,
          kpi?.category_name,
          kpi?.category,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableValues.includes(query);
      })
      .sort((a, b) => (a?.title || '').localeCompare(b?.title || ''));
  }, [searchText, selectedFiscalYearKpis]);

  const totalPages = Math.max(1, Math.ceil(filteredKpis.length / PAGE_SIZE));

  const paginatedKpis = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredKpis.slice(start, start + PAGE_SIZE);
  }, [filteredKpis, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, selectedFiscalYear]);

  const categoryCounts = useMemo(() => {
    const counts = new Map();

    selectedFiscalYearKpis.forEach((kpi) => {
      const key = kpi?.category_name || kpi?.category || 'Uncategorized';
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [selectedFiscalYearKpis]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Plant KPI List</h1>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between w-full">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by title, category, or year..."
            className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-800 outline-none transition bg-white shadow-sm"
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex items-center gap-1 bg-white rounded shadow px-2 py-1 border border-gray-200 h-9 min-h-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              const currentIndex = availableFiscalYears.indexOf(selectedFiscalYear);
              if (currentIndex > 0) {
                setSelectedFiscalYear(availableFiscalYears[currentIndex - 1]);
              }
            }}
            disabled={availableFiscalYears.length === 0 || availableFiscalYears.indexOf(selectedFiscalYear) <= 0}
            className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Previous Fiscal Year"
            style={{ lineHeight: '1' }}
          >
            ‹
          </button>
          <span className="text-xs text-gray-500 font-medium mr-1">FY</span>
          <span className="text-sm font-bold text-gray-800 mr-1">
            {selectedFiscalYear}-{(selectedFiscalYear + 1).toString().slice(-2)}
          </span>
          <span className="text-xs text-gray-400 mr-1 hidden sm:inline">Apr {selectedFiscalYear} - Mar {selectedFiscalYear + 1}</span>
          {availableFiscalYears.length > 0 && (
            <span className="text-xs text-gray-400 mr-1">
              ({availableFiscalYears.indexOf(selectedFiscalYear) + 1} / {availableFiscalYears.length})
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              const currentIndex = availableFiscalYears.indexOf(selectedFiscalYear);
              if (currentIndex >= 0 && currentIndex < availableFiscalYears.length - 1) {
                setSelectedFiscalYear(availableFiscalYears[currentIndex + 1]);
              }
            }}
            disabled={availableFiscalYears.length === 0 || availableFiscalYears.indexOf(selectedFiscalYear) >= availableFiscalYears.length - 1}
            className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Next Fiscal Year"
            style={{ lineHeight: '1' }}
          >
            ›
          </button>
        </div>
      </div>


      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-600">Loading plant KPI list...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
              KPI Records
            </h2>
          </div>

          {filteredKpis.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No KPIs match your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-600">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      S.NO
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Fiscal Year
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Category
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Parent KPI
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {paginatedKpis.map((kpi, idx) => (
                    <tr key={kpi.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {(currentPage - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{kpi?.title || '-'}</div>
                        {kpi?.description ? (
                          <div className="mt-1 max-w-xl truncate text-xs text-gray-500">
                            {kpi.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {formatFiscalYear(kpi?.fin_year)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {kpi?.category_name || kpi?.category || 'Uncategorized'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {kpi?.parent_kpi_id ? (kpis.find((p) => String(p.id) === String(kpi.parent_kpi_id))?.title || kpi.parent_kpi_id) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {filteredKpis.length > PAGE_SIZE && (
            <div className="flex justify-end items-center gap-2 px-4 py-3 border-t border-gray-200">
              <button
                type="button"
                className="px-3 py-1 rounded border border-gray-300 bg-white text-gray-700 disabled:opacity-50 transition-colors hover:bg-gray-50"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Prev
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className="px-3 py-1 rounded border border-gray-300 bg-white text-gray-700 disabled:opacity-50 transition-colors hover:bg-gray-50"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PlantEfficiency;