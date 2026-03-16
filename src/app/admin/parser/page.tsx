'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

interface ParseResult {
  className: string;
  columns: Record<number, string>;
  columnCount: number;
  data: Record<string, string>[];
}

export default function ParserPage() {
  const [files, setFiles] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Column visibility
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [colPickerSearch, setColPickerSearch] = useState('');
  const colPickerRef = useRef<HTMLDivElement>(null);

  // Data search
  const [dataSearch, setDataSearch] = useState('');
  const [searchColumns, setSearchColumns] = useState<Set<string>>(new Set());
  const [searchExact, setSearchExact] = useState(false);
  const [searchPickerOpen, setSearchPickerOpen] = useState(false);
  const searchPickerRef = useRef<HTMLDivElement>(null);

  const tableRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setColPickerOpen(false);
      }
      if (searchPickerRef.current && !searchPickerRef.current.contains(e.target as Node)) {
        setSearchPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load file list on mount
  useEffect(() => {
    fetch('/api/admin/parser?action=list')
      .then(r => r.json())
      .then(d => {
        const names = (d.files ?? []).map((f: { name: string }) => f.name);
        setFiles(names);
      })
      .catch(() => setError('Failed to load file list'));
  }, []);

  async function handleParse(file: string, force = false) {
    setSelectedFile(file);
    setResult(null);
    setError(null);
    setLoading(true);
    setHiddenColumns(new Set());
    setDataSearch('');
    setSearchColumns(new Set());

    try {
      const url = `/api/admin/parser?action=parse&file=${encodeURIComponent(file)}${force ? '&force=1' : ''}`;
      const r = await fetch(url);
      const data = await r.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch {
      setError('Failed to parse file');
    } finally {
      setLoading(false);
    }
  }

  // All unique column names
  const allColumns = useMemo(() =>
    result ? [...new Set(result.data.flatMap(row => Object.keys(row)))] : [],
    [result]
  );

  // Visible columns (excluding hidden)
  const visibleColumns = useMemo(() =>
    allColumns.filter(c => !hiddenColumns.has(c)),
    [allColumns, hiddenColumns]
  );

  // Columns matching the picker search
  const pickerFilteredCols = colPickerSearch
    ? allColumns.filter(c => c.toLowerCase().includes(colPickerSearch.toLowerCase()))
    : allColumns;

  // Determine which columns to search in
  const effectiveSearchCols = searchColumns.size > 0
    ? [...searchColumns].filter(c => !hiddenColumns.has(c))
    : visibleColumns;

  // Filter rows by data search
  const filteredRows = useMemo(() => {
    if (!result || !dataSearch.trim()) return result?.data ?? [];
    const term = dataSearch.trim();
    const lower = term.toLowerCase();

    return result.data.filter(row =>
      effectiveSearchCols.some(col => {
        const val = row[col] ?? '';
        if (searchExact) return val === term;
        return val.toLowerCase().includes(lower);
      })
    );
  }, [result, dataSearch, effectiveSearchCols, searchExact]);

  const filteredFiles = search
    ? files.filter(f => f.toLowerCase().includes(search.toLowerCase()))
    : files;

  function toggleColumn(col: string) {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }

  function showAllColumns() {
    setHiddenColumns(new Set());
  }

  function hideAllColumns() {
    setHiddenColumns(new Set(allColumns));
  }

  function toggleSearchColumn(col: string) {
    setSearchColumns(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-100px)]">
      {/* Sidebar: file list */}
      <div className="w-72 shrink-0 flex flex-col border-r border-zinc-800 pr-4">
        <h1 className="text-xl font-bold mb-3">Bytes Parser</h1>

        <input
          type="text"
          placeholder="Search files..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-3 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />

        <div className="overflow-y-auto flex-1 space-y-0.5">
          {filteredFiles.map(f => (
            <button
              key={f}
              onClick={() => handleParse(f)}
              className={`block w-full text-left rounded px-2 py-1 text-sm truncate transition-colors ${
                f === selectedFile
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
              title={f}
            >
              {f.replace('.bytes', '')}
            </button>
          ))}
        </div>

        <p className="mt-2 text-xs text-zinc-600">{filteredFiles.length} files</p>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedFile && (
          <div className="flex items-center justify-center h-full text-zinc-600">
            Select a .bytes file to parse
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-full text-zinc-400">
            Parsing {selectedFile}...
          </div>
        )}

        {error && (
          <div className="rounded border border-red-800 bg-red-950/50 p-4 text-red-400">
            {error}
          </div>
        )}

        {result && !loading && (
          <>
            {/* Header info */}
            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-mono text-blue-400">{result.className}</span>
              <span className="text-zinc-500">{visibleColumns.length}/{allColumns.length} cols</span>
              <span className="text-zinc-500">{filteredRows.length}/{result.data.length} rows</span>

              {selectedFile && (
                <button
                  onClick={() => handleParse(selectedFile, true)}
                  className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  Re-parse
                </button>
              )}
            </div>

            {/* Toolbar: column picker + search */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {/* Column visibility picker */}
              <div ref={colPickerRef} className="relative">
                <button
                  onClick={() => { setColPickerOpen(v => !v); setColPickerSearch(''); }}
                  className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  Columns {hiddenColumns.size > 0 && `(${hiddenColumns.size} hidden)`}
                </button>

                {colPickerOpen && (
                  <div className="absolute top-full left-0 mt-1 z-30 w-64 max-h-80 overflow-hidden rounded border border-zinc-700 bg-zinc-900 shadow-xl flex flex-col">
                    <div className="p-2 border-b border-zinc-800 space-y-2">
                      <input
                        type="text"
                        placeholder="Filter columns..."
                        value={colPickerSearch}
                        onChange={e => setColPickerSearch(e.target.value)}
                        className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button onClick={showAllColumns} className="text-xs text-blue-400 hover:text-blue-300">Show all</button>
                        <button onClick={hideAllColumns} className="text-xs text-blue-400 hover:text-blue-300">Hide all</button>
                      </div>
                    </div>
                    <div className="overflow-y-auto p-1">
                      {pickerFilteredCols.map(col => (
                        <label key={col} className="flex items-center gap-2 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!hiddenColumns.has(col)}
                            onChange={() => toggleColumn(col)}
                            className="accent-blue-500"
                          />
                          <span className="truncate">{col}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Data search */}
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    placeholder={`Search in ${searchColumns.size > 0 ? searchColumns.size + ' column(s)' : 'all columns'}...`}
                    value={dataSearch}
                    onChange={e => setDataSearch(e.target.value)}
                    className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                {/* Exact match toggle */}
                <button
                  onClick={() => setSearchExact(v => !v)}
                  className={`shrink-0 rounded border px-2 py-1.5 text-xs transition-colors ${
                    searchExact
                      ? 'border-blue-500 bg-blue-600/20 text-blue-400'
                      : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                  }`}
                  title={searchExact ? 'Exact match' : 'Partial match'}
                >
                  {searchExact ? 'Exact' : 'Partial'}
                </button>

                {/* Search column picker */}
                <div ref={searchPickerRef} className="relative shrink-0">
                  <button
                    onClick={() => setSearchPickerOpen(v => !v)}
                    className={`rounded border px-2 py-1.5 text-xs transition-colors ${
                      searchColumns.size > 0
                        ? 'border-blue-500 bg-blue-600/20 text-blue-400'
                        : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {searchColumns.size > 0 ? `${searchColumns.size} col(s)` : 'All cols'}
                  </button>

                  {searchPickerOpen && (
                    <div className="absolute top-full right-0 mt-1 z-30 w-56 max-h-64 overflow-hidden rounded border border-zinc-700 bg-zinc-900 shadow-xl flex flex-col">
                      <div className="p-2 border-b border-zinc-800">
                        <button
                          onClick={() => setSearchColumns(new Set())}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Reset (all columns)
                        </button>
                      </div>
                      <div className="overflow-y-auto p-1">
                        {visibleColumns.map(col => (
                          <label key={col} className="flex items-center gap-2 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={searchColumns.has(col)}
                              onChange={() => toggleSearchColumn(col)}
                              className="accent-blue-500"
                            />
                            <span className="truncate">{col}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Data table */}
            <div ref={tableRef} className="overflow-auto flex-1 rounded border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-zinc-900 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 border-b border-zinc-800">
                      #
                    </th>
                    {visibleColumns.map(col => (
                      <th
                        key={col}
                        className="px-3 py-2 text-left text-xs font-medium text-zinc-400 border-b border-zinc-800 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                      <td className="px-3 py-1.5 text-zinc-600 tabular-nums">{i + 1}</td>
                      {visibleColumns.map(col => (
                        <td
                          key={col}
                          className="px-3 py-1.5 text-zinc-300 max-w-xs truncate"
                          title={row[col] ?? ''}
                        >
                          {row[col] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
