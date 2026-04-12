export interface ICustomer {
  line_id: string;
  wedding_date: string;
  created_at?: string;
}

export interface ITaskMaster {
  task_id: string;
  category: string;
  task_content: string;
  due_formula: string;
  due_estimate: string;
  memo: string;
  is_active: boolean;
  target_line_id?: string;
}

export interface ITaskProgress {
  line_id: string;
  task_id: string;
  is_done: boolean;
  updated_at: string;
  is_visible: boolean; // Note: We might phase this out, but keep for type compatibility
}

export interface ITaskResponse {
  task_id: string;
  category: string;
  task_content: string;
  due_formula: string;
  due_estimate: string;
  memo: string;
  is_done: boolean;
  is_visible: boolean;
  is_custom?: boolean;
}
