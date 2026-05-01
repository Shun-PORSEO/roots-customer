export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      <header className="bg-surface px-lg py-md shadow-card border-b border-border sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center gap-sm">
          <span className="font-display text-display-md text-primary-70 leading-none">
            Roots
          </span>
          <span className="text-label-caps text-tertiary-70 mt-2xs">
            PLANNER&nbsp;DASHBOARD
          </span>
        </div>
      </header>
      <main className="flex-1 p-md md:p-lg">
        <div className="max-w-4xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
