/** Skeleton primitives — subtle pulse in the dashboard palette. */
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-sm bg-[#141821]", className)} />;
}

export function StatCardSkeleton() {
  return (
    <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-3">
      <Skeleton className="h-2.5 w-16 mb-2" />
      <Skeleton className="h-6 w-14" />
    </div>
  );
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {Array.from({ length: count }).map((_, i) => <StatCardSkeleton key={i} />)}
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm divide-y divide-[#1a1f29]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_100px_100px] gap-3 p-3 items-center">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-end justify-between border-b border-[#1f2530] pb-4">
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <StatGridSkeleton />
      <TableSkeleton />
    </div>
  );
}
