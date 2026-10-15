export default function Loading() {
  return (
    <div className="mx-auto grid min-h-[55vh] max-w-7xl animate-pulse content-start gap-6 px-4 py-10 sm:px-6" aria-busy="true">
      <div className="h-4 w-32 rounded-full bg-line" />
      <div className="h-9 w-64 max-w-full rounded-xl bg-line" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="overflow-hidden rounded-3xl border border-line bg-white">
            <div className="aspect-video bg-paper" />
            <div className="grid gap-3 p-4">
              <div className="h-4 w-2/3 rounded-full bg-line" />
              <div className="h-3 w-1/2 rounded-full bg-line" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
