interface IVenue {
  venue_id: string;
  venue_name: string;
  planner_line_user_id: string;
  line_channel_access_token: string;
  line_liff_id: string;
  active: boolean;
  created_at: string;
}

interface IMessageDraft {
  draft_id: string;
  venue_id: string;
  couple_id: string;
  task_id: string;
  draft_message: string;
  status: "pending" | "approved" | "rejected" | "sent";
  created_at: string;
  sent_at: string;
}

interface ICustomer {
  line_id: string;
  venue_id?: string;
  wedding_date: string;
  created_at?: string;
  name1_kana?: string;
  name2_kana?: string;
  is_admin?: boolean;
}

interface IUserProgress extends ICustomer {
  total_tasks: number;
  done_tasks: number;
}

interface ITaskMaster {
  task_id: string;
  category: string;
  task_content: string;
  due_formula: string;
  due_estimate: string;
  memo: string;
  is_active: boolean;
  target_line_id?: string;
  manual_url?: string;
  reminder_message?: string; // 期限前/当日にカップルへ送るLINE通知の本文。task_master の K 列。
}

interface ITaskProgress {
  line_id: string;
  task_id: string;
  is_done: boolean;
  updated_at: string;
  is_visible: boolean; // Note: We might phase this out, but keep for type compatibility
  comment?: string; // カップルがタスクごとに残すコメント（task_progress F列）。プランナーが管理画面で閲覧する。
}

interface IVenue {
  venue_id: string;
  venue_name: string;
  planner_line_user_id?: string;
  line_channel_access_token?: string;
  line_liff_id?: string;
  active: boolean;
  created_at?: string;
}

interface IMessageDraft {
  draft_id: string;
  venue_id: string;
  couple_id: string;
  task_id: string;
  draft_message: string;
  status: string;
  created_at: string;
  sent_at?: string;
}

interface ITaskItem {
  item_id: string;
  task_id: string;
  line_id: string;
  item_name: string;
  quantity: number;
  is_done: boolean;
  memo?: string;
  created_at?: string;
}

interface ITaskResponse {
  task_id: string;
  category: string;
  task_content: string;
  due_formula: string;
  due_estimate: string;
  memo: string;
  is_done: boolean;
  is_visible: boolean;
  is_custom?: boolean;
  venue_id?: string;
  manual_url?: string;
  comment?: string; // カップルがそのタスクに残したコメント
}
