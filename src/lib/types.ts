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
}

export interface ICustomer {
  line_id: string;
  wedding_date: string;
  created_at?: string;
}

export interface IApiResponse<T = any> {
  status: "ok" | "created" | "exists" | "updated" | "deleted" | "error" | "not_found";
  message?: string;
  wedding_date?: string;
  tasks?: ITask[];
  users?: ICustomer[];
  [key: string]: any;
}
