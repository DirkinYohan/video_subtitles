export default function Loading() {
  return (
    <div
      className="mx-auto grid min-h-[55vh] max-w-7xl animate-pulse content-start gap-5 px-4 py-8 sm:px-6"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Encabezado */}
      <div className="h-6 w-40 rounded-md bg-surface-2" />

      {/* Filtros */}
      <div className="flex gap-2">
        <div className="h-10 flex-1 rounded-md bg-surface-2" />
        <div className="h-10 w-28 rounded-md bg-surface-2" />
      </div>

      {/* Tarjetas con la forma del contenido real */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="aspect-video bg-surface-2" />
            <div className="grid gap-2 p-3.5">
              <div className="h-3.5 w-2/3 rounded bg-surface-2" />
              <div className="h-3 w-1/2 rounded bg-surface-2" />
              <div className="mt-1 h-5 w-20 rounded-sm bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
