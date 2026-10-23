import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Stand-in for an admin data table. The header band and the row rhythm match
 * the real tables (`px-3 py-3` cells, two-line first column, pill before the
 * action buttons), so the grid does not resize when the rows arrive.
 */
export function TableSkeleton({
  columns = 6,
  rows = 5,
  withCheckbox = false,
}: {
  columns?: number;
  rows?: number;
  withCheckbox?: boolean;
}) {
  const titleColumn = withCheckbox ? 1 : 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index} className="px-3 py-3 text-left">
                {withCheckbox && index === 0 ? (
                  <Skeleton className="h-4 w-4 rounded-sm" />
                ) : (
                  <Skeleton className="h-3 w-20" />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, row) => (
            <tr key={row} className="border-b border-border last:border-0">
              {Array.from({ length: columns }).map((_, column) => (
                <td key={column} className="px-3 py-3">
                  {withCheckbox && column === 0 ? (
                    <Skeleton className="h-4 w-4 rounded-sm" />
                  ) : column === titleColumn ? (
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-36 max-w-full" />
                    </div>
                  ) : column === columns - 1 ? (
                    <div className="flex justify-end gap-1">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  ) : column === columns - 2 ? (
                    <Skeleton className="h-6 w-16 rounded-full" />
                  ) : (
                    <Skeleton className="h-4 w-20" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Generic rows for an in-panel list (dropdown options, admin name lists). The
 * thumbnail and trailing pill are optional because those lists differ.
 */
export function ListRowsSkeleton({
  rows = 4,
  withThumb = false,
  withTrailing = true,
  className,
}: {
  rows?: number;
  withThumb?: boolean;
  withTrailing?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="glass-field flex items-center gap-3 rounded-lg p-3">
          {withThumb && <Skeleton className="size-10 shrink-0 rounded-md" />}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3 min-w-24" />
            <Skeleton className="h-3 w-2/3 max-w-72" />
          </div>
          {withTrailing && <Skeleton className="h-6 w-16 shrink-0 rounded-full" />}
        </div>
      ))}
    </div>
  );
}
