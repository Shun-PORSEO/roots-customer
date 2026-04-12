interface ICustomer {
  line_id: string;
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
}

interface ITaskProgress {
  line_id: string;
  task_id: string;
  is_done: boolean;
  updated_at: string;
  is_visible: boolean; // Note: We might phase this out, but keep for type compatibility
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
}
