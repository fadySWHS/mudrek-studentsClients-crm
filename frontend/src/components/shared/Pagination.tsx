import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/utils/cn';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export default function Pagination({ page, limit, total, onPageChange, onLimitChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 0) return null;

  // Generate page numbers
  const getPages = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    if (page <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    
    if (page >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    
    return [1, '...', page - 1, page, page + 1, '...', totalPages];
  };

  const limits = [10, 20, 50, 100];

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 mb-8 text-sm text-gray-600 border-t border-gray-100 pt-4">
      
      {/* Items per page selector */}
      <div className="flex items-center gap-2">
        <span>عرض</span>
        <select 
          className="border border-gray-300 rounded-md py-1 px-2 text-sm focus:ring-primary focus:border-primary outline-none"
          value={limit}
          onChange={(e) => {
            onLimitChange(Number(e.target.value));
            // Automatically return to page 1 is handled in parent typically, but we should let the parent do it.
          }}
        >
          {limits.map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <span>لكل صفحة (إجمالي {total})</span>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500"
          title="الصفحة السابقة"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {getPages().map((p, i) => (
          <button
            key={i}
            onClick={() => typeof p === 'number' ? onPageChange(p) : null}
            disabled={p === '...'}
            className={cn(
              "min-w-8 h-8 flex items-center justify-center rounded-md font-medium transition-colors cursor-pointer",
              p === '...' ? "cursor-default opacity-50 bg-transparent text-gray-500 hover:bg-transparent" :
              page === p ? "bg-primary text-white shadow-sm" : "hover:bg-gray-100 text-gray-700 bg-white border border-gray-200"
            )}
          >
            {p}
          </button>
        ))}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500"
          title="الصفحة التالية"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
      
    </div>
  );
}
