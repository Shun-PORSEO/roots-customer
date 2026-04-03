export interface ICustomerRow {
  line_id: string;
  nickname: string;
  created_at: string;
}

export interface ITaskMasterRow {
  task_id: string;
  title: string;
  description: string;
  manual_url: string;
  due_offset_days: number;
  is_active: boolean;
}

export interface ITaskProgressRow {
  line_id: string;
  task_id: string;
  is_done: boolean;
  updated_at: string;
  is_visible: boolean;
}

export interface ITaskForClient {
  task_id: string;
  title: string;
  description: string;
  manual_url: string;
  due_offset_days: number;
  is_done: boolean;
  is_visible: boolean;
}

export type ApiResponse =
  | { status: "created"; nickname: string }
  | { status: "exists"; nickname: string }
  | { status: "updated" }
  | { tasks: ITaskForClient[] }
  | { status: "error"; message: string };
