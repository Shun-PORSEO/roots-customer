export default function LoadingSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/20 z-50">
      <div className="flex flex-col items-center gap-3 bg-white rounded-card px-8 py-6 shadow-card">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-text-sub">読み込み中...</p>
      </div>
    </div>
  );
}
