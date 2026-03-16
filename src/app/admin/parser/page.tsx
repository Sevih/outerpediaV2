'use client';

import { useState, useEffect, useRef } from 'react';

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
  const [columnSearch, setColumnSearch] = useState('');
  const tableRef = useRef<HTMLDivElement>(null);

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
    setColumnSearch('');

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

  // Get all unique column names from data rows
  const allColumns = result
    ? [...new Set(result.data.flatMap(row => Object.keys(row)))]
    : [];

  const filteredColumns = columnSearch
    ? allColumns.filter(c => c.toLowerCase().includes(columnSearch.toLowerCase()))
    : allColumns;

  const filteredFiles = search
    ? files.filter(f => f.toLowerCase().includes(search.toLowerCase()))
    : files;

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
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-mono text-blue-400">{result.className}</span>
              <span className="text-zinc-500">{result.columnCount} columns</span>
              <span className="text-zinc-500">{result.data.length} rows</span>

              {selectedFile && (
                <button
                  onClick={() => handleParse(selectedFile, true)}
                  className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  Re-parse
                </button>
              )}

              <input
                type="text"
                placeholder="Filter columns..."
                value={columnSearch}
                onChange={e => setColumnSearch(e.target.value)}
                className="ml-auto rounded border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
            </div>

            {/* Data table */}
            <div ref={tableRef} className="overflow-auto flex-1 rounded border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-zinc-900 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 border-b border-zinc-800">
                      #
                    </th>
                    {filteredColumns.map(col => (
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
                  {result.data.map((row, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                      <td className="px-3 py-1.5 text-zinc-600 tabular-nums">{i + 1}</td>
                      {filteredColumns.map(col => (
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
