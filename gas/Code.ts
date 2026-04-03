import { createCustomer, getActiveTasks, getCustomer, getTaskProgress, updateOrCreateTaskProgress } from "./sheets";
import { ITaskResponse } from "./types";

const responseJSON = (data: any) => {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
};

export const doGet = (e: any) => {
  try {
    const action = e.parameter.action;
    const lineId = e.parameter.line_id;

    if (!lineId) {
      return responseJSON({ status: "error", message: "Unauthorized" });
    }

    if (action === "getTasks") {
      // 顧客が存在するか確認
      const customer = getCustomer(lineId);
      if (!customer) {
         return responseJSON({ status: "error", message: "Customer not found" });
      }

      const allTasks = getActiveTasks();
      const progressData = getTaskProgress(lineId);

      const tasks: ITaskResponse[] = allTasks.map(task => {
        const prog = progressData.find(p => p.task_id === task.task_id);
        const isDone = prog ? prog.is_done : false;
        const isVisible = prog ? prog.is_visible : true;
        
        return {
          task_id: task.task_id,
          title: task.title,
          description: task.description,
          manual_url: task.manual_url,
          due_offset_days: task.due_offset_days,
          is_done: isDone,
          is_visible: isVisible
        };
      }).filter(t => t.is_visible);

      return responseJSON({ tasks });
    }

    return responseJSON({ status: "error", message: "Invalid action" });
  } catch (error: any) {
    return responseJSON({ status: "error", message: error.message });
  }
};

export const doPost = (e: any) => {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = e.parameter.action || postData.action;
    const lineId = postData.line_id;

    if (!lineId) {
      return responseJSON({ status: "error", message: "Unauthorized" });
    }

    if (action === "register") {
      const nickname = postData.nickname;
      const existing = getCustomer(lineId);
      if (existing) {
        return responseJSON({ status: "exists", nickname: existing.nickname });
      }
      createCustomer(lineId, nickname);
      return responseJSON({ status: "created", nickname });
    }

    if (action === "updateTask") {
      const taskId = postData.task_id;
      const isDone = postData.is_done;
      updateOrCreateTaskProgress(lineId, taskId, isDone);
      return responseJSON({ status: "updated" });
    }

    return responseJSON({ status: "error", message: "Invalid action" });
  } catch (error: any) {
    return responseJSON({ status: "error", message: error.message });
  }
};
