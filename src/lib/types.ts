export interface IVenue {
  venue_id: string;
  venue_name: string;
  planner_line_user_id?: string;
  line_channel_access_token?: string;
  line_liff_id?: string;
  active: boolean;
  created_at?: string;
}

export interface IMessageDraft {
  draft_id: string;
  venue_id: string;
  couple_id: string;
  task_id: string;
  draft_message: string;
  status: string;
  created_at: string;
  sent_at?: string;
}

export interface ITaskItem {
  item_id: string;
  task_id: string;
  line_id: string;
  item_name: string;
  quantity: number;
  is_done: boolean;
  memo?: string;
  created_at?: string;
}

export interface ITask {
  task_id: string;
  category: string;
  task_content: string;
  due_formula: string;
  due_estimate: string;
  memo: string;
  is_done: boolean;
  is_visible: boolean;
  is_custom?: boolean;
  comment?: string; // カップルがそのタスクに残したコメント（プランナーが管理画面で閲覧）
}

export interface ITaskMaster {
  task_id: string;
  category: string;
  task_content: string;
  due_formula: string;
  due_estimate: string;
  memo: string;
  is_active?: boolean;
  manual_url?: string;
  reminder_message?: string;
  target_line_id?: string;
  venue_id?: string;
}

export interface ICustomer {
  line_id: string;
  wedding_date: string;
  created_at?: string;
  name1_kana?: string;
  name2_kana?: string;
  is_admin?: boolean;
}

export interface IUserProgress extends ICustomer {
  total_tasks: number;
  done_tasks: number;
}

export interface IApiResponse {
  status: "ok" | "created" | "exists" | "updated" | "deleted" | "error" | "not_found";
  message?: string;
  wedding_date?: string;
  name1_kana?: string;
  name2_kana?: string;
  tasks?: ITask[];
  users?: ICustomer[] | IUserProgress[];
  venues?: IVenue[];
  venue?: IVenue;
  drafts?: IMessageDraft[];
  pending_drafts_count?: number;
  items?: ITaskItem[];
  item?: ITaskItem;
  [key: string]: any;
}
