export default function Loading() {
  return (
    <div
      className="enter-fade mx-auto grid min-h-[55vh] max-w-6xl content-start gap-6 px-4 py-10 sm:px-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="grid gap-2">
        <div className="skeleton h-7 w-48 rounded-lg" />
        <div className="skeleton h-4 w-24 rounded-md" />
      </div>

      <div className="flex gap-2">
        <div className="skeleton h-11 flex-1 rounded-lg" />
        <div className="skeleton h-11 w-32 rounded-lg" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="skeleton aspect-video" />
            <div className="grid gap-2.5 p-4">
              <div className="skeleton h-4 w-2/3 rounded-md" />
              <div className="skeleton h-3 w-1/2 rounded-md" />
              <div className="skeleton mt-1 h-6 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
