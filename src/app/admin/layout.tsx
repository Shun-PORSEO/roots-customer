export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell min-h-screen bg-surface-page flex flex-col">
      <header className="bg-surface border-b border-border sticky top-0 z-20 shadow-card">
        <div className="px-lg md:px-xl py-md flex items-center gap-sm">
          <span className="font-display text-display-md text-primary-70 leading-none">
            Roots
          </span>
          <span className="text-label-caps text-tertiary-70 mt-2xs">
            PLANNER&nbsp;DASHBOARD
          </span>
        </div>
      </header>
      <main className="flex-1 px-lg md:px-xl py-lg md:py-xl">{children}</main>
    </div>
  );
}
