export function AdminAccessDenied() {
  return (
    <div className="pb-2xl animate-fade-in p-lg text-center">
      <h2 className="font-display text-display-md text-on-surface mb-sm">アクセス権がありません</h2>
      <p className="text-body-md text-neutral-50">
        式場管理は管理者のみ利用できます。<br />
        管理者権限が必要な場合は担当者にお問い合わせください。
      </p>
    </div>
  );
}
