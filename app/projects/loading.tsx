import { Skeleton } from "@/components/kit";

export default function Loading() {
  return (
    <div className="enter-fade mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 sm:py-10" aria-busy="true">
      <div className="flex items-end justify-between gap-4">
        <div className="grid gap-2.5">
          <Skeleton className="h-8 w-52 rounded-lg" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-80 rounded-[10px]" />
        <Skeleton className="ml-auto h-9 w-64 rounded-lg" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <Skeleton className="aspect-video rounded-none" />
            <div className="grid gap-3 p-4">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex justify-between">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-14" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
