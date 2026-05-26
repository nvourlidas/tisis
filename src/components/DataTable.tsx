import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Columns3, ChevronLeft, ChevronRight } from 'lucide-react';

export type ColumnDef<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
  defaultVisible?: boolean;
  alwaysVisible?: boolean;
  className?: string;
  headerClassName?: string;
};

type SortDir = 'asc' | 'desc';

type Props<T> = {
  tableId: string;
  columns: ColumnDef<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  pageSize?: number;
  emptyState?: React.ReactNode;
};

const PAGE_SIZE_DEFAULT = 20;

export default function DataTable<T>({
  tableId,
  columns,
  data,
  rowKey,
  onRowClick,
  rowClassName,
  pageSize = PAGE_SIZE_DEFAULT,
  emptyState,
}: Props<T>) {
  const storageKey = `dt_cols_${tableId}`;

  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch {}
    return new Set(columns.filter((c) => c.defaultVisible !== false).map((c) => c.key));
  });

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify([...visibleKeys]));
  }, [visibleKeys, storageKey]);

  // Reset to page 1 when data or sort changes
  useEffect(() => { setPage(1); }, [data, sortKey, sortDir]);

  useEffect(() => {
    if (!colMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setColMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colMenuOpen]);

  const toggleSort = useCallback((key: string, sortable: boolean) => {
    if (!sortable) return;
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const toggleCol = (key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev; // keep at least one
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const visibleCols = columns.filter((c) => c.alwaysVisible || visibleKeys.has(c.key));

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return 0;
    const va = col.sortValue(a) ?? '';
    const vb = col.sortValue(b) ?? '';
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageData = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const from = sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, sorted.length);

  return (
    <div className="space-y-3">
      {/* Column selector */}
      <div className="flex justify-end">
        <div className="relative" ref={colMenuRef}>
          <button
            onClick={() => setColMenuOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary border border-border/10 bg-white/3 hover:bg-white/6 hover:text-text-primary transition-colors cursor-pointer"
          >
            <Columns3 className="h-3.5 w-3.5" />
            Στήλες
          </button>
          {colMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 min-w-44 rounded-xl border border-border/10 bg-secondary-background shadow-xl py-1">
              {columns.filter((c) => !c.alwaysVisible).map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/5 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={visibleKeys.has(col.key)}
                    onChange={() => toggleCol(col.key)}
                    className="accent-primary"
                  />
                  <span className="text-sm text-text-primary">{col.header}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/3 border-b border-border/10 text-text-secondary text-xs uppercase tracking-wider">
              {visibleCols.map((col) => {
                const sortable = !!col.sortValue;
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    className={[
                      'text-left px-4 py-3 font-medium whitespace-nowrap',
                      sortable ? 'cursor-pointer select-none hover:text-text-primary' : '',
                      col.headerClassName ?? '',
                    ].join(' ')}
                    onClick={() => toggleSort(col.key, sortable)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {sortable && (
                        active
                          ? sortDir === 'asc'
                            ? <ChevronUp className="h-3 w-3 text-primary" />
                            : <ChevronDown className="h-3 w-3 text-primary" />
                          : <ChevronsUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/10">
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length} className="px-4 py-12 text-center">
                  {emptyState ?? <span className="text-sm text-text-secondary">Δεν υπάρχουν εγγραφές.</span>}
                </td>
              </tr>
            ) : (
              pageData.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={[
                    'transition-colors',
                    onRowClick ? 'hover:bg-white/3 cursor-pointer' : '',
                    rowClassName?.(row) ?? '',
                  ].join(' ')}
                >
                  {visibleCols.map((col) => (
                    <td key={col.key} className={['px-4 py-3', col.className ?? ''].join(' ')}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {sorted.length > 0 && (
        <div className="flex items-center justify-between gap-4 px-1">
          <span className="text-xs text-text-secondary">
            {from}–{to} από {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="h-7 w-7 flex items-center justify-center rounded-lg border border-border/10 text-text-secondary hover:bg-white/5 hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {getPageNums(safePage, totalPages).map((n, i) =>
              n === '...' ? (
                <span key={`ellipsis-${i}`} className="h-7 w-7 flex items-center justify-center text-xs text-text-secondary">…</span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n as number)}
                  className={[
                    'h-7 w-7 flex items-center justify-center rounded-lg text-xs font-medium transition-colors cursor-pointer',
                    n === safePage
                      ? 'bg-primary/15 text-primary border border-primary/20'
                      : 'border border-border/10 text-text-secondary hover:bg-white/5 hover:text-text-primary',
                  ].join(' ')}
                >
                  {n}
                </button>
              )
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="h-7 w-7 flex items-center justify-center rounded-lg border border-border/10 text-text-secondary hover:bg-white/5 hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getPageNums(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}
