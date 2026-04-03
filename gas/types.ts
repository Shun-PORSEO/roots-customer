export interface ICustomer {
  line_id: string;
  nickname: string;
  created_at?: string;
}

export interface ITaskMaster {
  task_id: string;
  title: string;
  description: string;
  manual_url: string;
  due_offset_days: number;
  is_active: boolean;
}

export interface ITaskProgress {
  line_id: string;
  task_id: string;
  is_done: boolean;
  updated_at: string;
  is_visible: boolean;
}

export interface ITaskResponse {
  task_id: string;
  title: string;
  description: string;
  manual_url: string;
  due_offset_days: number;
  is_done: boolean;
  is_visible: boolean;
}
