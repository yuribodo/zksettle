import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

export function TableSkeleton({ columns, rows = 5 }: Readonly<TableSkeletonProps>) {
  return (
    <tbody>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr
          key={rowIndex}
          className="border-b border-border-subtle last:border-b-0"
        >
          {Array.from({ length: columns }, (_, colIndex) => {
            let maxWidth = 100;
            if (colIndex === 0) maxWidth = 80;
            else if (colIndex === 4) maxWidth = 60;
            return (
              <td key={colIndex} className="px-3 py-3 first:pl-5 last:pr-5">
                <Skeleton
                  className="h-4 w-full"
                  style={{ maxWidth }}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  );
}
