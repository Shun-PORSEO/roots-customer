"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { ICustomer } from "@/lib/types";
import { Spinner } from "@/components/Spinner";
import { ErrorMessage } from "@/components/ErrorMessage";

export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<ICustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simple hardcoded auth for demo/MVP
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === (process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "roots2026")) {
      setAuthed(true);
    } else {
      alert("Invalid password");
    }
  };

  useEffect(() => {
    if (!authed) return;
    
    const fetchUsers = async () => {
      try {
        const res = await apiClient.post({ action: "getUsers", line_id: "admin" });
        if (res.users) {
          setUsers(res.users);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [authed]);

  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-full max-w-sm">
          <h2 className="text-xl font-bold mb-6 text-center text-[var(--colorText)]">プランナーログイン</h2>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input 
              type="password" 
              placeholder="パスワードを入力" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg outline-none focus:border-[var(--colorPrimary)]"
            />
            <button type="submit" className="px-6 py-3 bg-[var(--colorPrimary)] text-white font-bold rounded-lg hover:opacity-90">
              ログイン
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) return <Spinner fullScreen />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div>
      <h2 className="text-2xl font-bold text-[var(--colorText)] mb-6">お客様一覧</h2>
      
      {users.length === 0 ? (
        <div className="bg-white p-8 rounded-xl text-center text-gray-500 border border-gray-200">
          登録されているお客様がいません
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-3 bg-gray-50 p-4 border-b border-gray-200 font-semibold text-sm text-gray-600">
            <div>LINE ID</div>
            <div>挙式予定日</div>
            <div>操作</div>
          </div>
          {users.map((user) => (
            <div key={user.line_id} className="grid grid-cols-3 p-4 border-b border-gray-100 items-center hover:bg-gray-50 transition-colors">
              <div className="text-sm text-gray-800 font-mono truncate px-2">{user.line_id}</div>
              <div className="text-md font-semibold text-[var(--colorText)]">{user.wedding_date}</div>
              <div>
                <button 
                  onClick={() => router.push(`/admin/${user.line_id}`)}
                  className="px-4 py-2 bg-[var(--colorSecondary)] text-[var(--colorPrimary)] text-sm font-bold rounded-lg hover:opacity-80"
                >
                  タスクを編集する
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
