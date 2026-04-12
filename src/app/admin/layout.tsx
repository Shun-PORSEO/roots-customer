export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white px-6 py-4 shadow-sm border-b border-gray-200">
        <h1 className="text-xl font-bold text-[var(--colorPrimary)] tracking-wide">
          Roots AI <span className="text-sm font-semibold text-gray-500 ml-2">Planner Dashboard</span>
        </h1>
      </header>
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
