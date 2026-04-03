export default function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 p-4 bg-white rounded-card border border-border shadow-card animate-pulse">
      <div className="w-6 h-6 min-w-[24px] rounded-md bg-secondary" />
      <div className="flex-1 h-4 bg-secondary rounded" />
    </div>
  );
}
