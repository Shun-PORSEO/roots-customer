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

export type RegisterStatus = "created" | "exists";

export interface IRegisterResponse {
  status: RegisterStatus | "error";
  nickname?: string;
  message?: string;
}

export interface ITasksResponse {
  tasks?: ITask[];
  status?: "error";
  message?: string;
}

export interface IUpdateTaskResponse {
  status: "updated" | "error";
  message?: string;
}
