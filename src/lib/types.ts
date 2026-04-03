export interface ITask {
  task_id: string;
  title: string;
  description: string;
  manual_url: string;
  due_offset_days: number;
  is_done: boolean;
  is_visible: boolean;
}

export interface ICustomer {
  line_id: string;
  nickname: string;
}

export interface IApiResponse<T = any> {
  status: "ok" | "created" | "exists" | "updated" | "error";
  message?: string;
  nickname?: string;
  tasks?: ITask[];
  [key: string]: any;
}
