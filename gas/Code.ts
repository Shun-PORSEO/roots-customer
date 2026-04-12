// sheets.ts functions will be available globally in GAS
// types.ts interfaces will be available globally in GAS

const responseJSON = (data: any) => {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
};

function doGet(e: any) {
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
      const hiddenTasks = getHiddenTasks(lineId);

      const tasks: ITaskResponse[] = allTasks
        .filter(task => !task.target_line_id || task.target_line_id === lineId)
        .map(task => {
          const prog = progressData.find(p => p.task_id === task.task_id);
          const isDone = prog ? prog.is_done : false;
          const isVisible = !hiddenTasks.has(task.task_id);
          
          return {
            task_id: task.task_id,
            category: task.category,
            task_content: task.task_content,
            due_formula: task.due_formula,
            due_estimate: task.due_estimate,
            memo: task.memo,
            is_done: isDone,
            is_visible: isVisible,
            is_custom: !!task.target_line_id
          };
      }).filter(t => t.is_visible);

      return responseJSON({ tasks });
    }

    return responseJSON({ status: "error", message: "Invalid action" });
  } catch (error: any) {
    return responseJSON({ status: "error", message: error.message });
  }
};

function doPost(e: any) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = e.parameter.action || postData.action;
    const lineId = postData.line_id;

    if (!lineId) {
      return responseJSON({ status: "error", message: "Unauthorized" });
    }

    if (action === "getUser") {
      const existing = getCustomer(lineId);
      if (existing) {
        return responseJSON({ status: "exists", wedding_date: existing.wedding_date });
      }
      return responseJSON({ status: "not_found" });
    }

    if (action === "register") {
      const weddingDate = postData.wedding_date;
      const existing = getCustomer(lineId);
      if (existing) {
        return responseJSON({ status: "exists", wedding_date: existing.wedding_date });
      }
      createCustomer(lineId, weddingDate);
      return responseJSON({ status: "created", wedding_date: weddingDate });
    }

    if (action === "updateTask") {
      const taskId = postData.task_id;
      const isDone = postData.is_done;
      updateOrCreateTaskProgress(lineId, taskId, isDone);
      return responseJSON({ status: "updated" });
    }

    if (action === "getUsers") {
      const users = getUsers();
      return responseJSON({ status: "ok", users });
    }

    if (action === "getAdminUserTasks") {
      const targetId = postData.target_line_id;
      const allTasks = getActiveTasks();
      const hiddenTasks = getHiddenTasks(targetId);
      const tasks = allTasks
        .filter(task => !task.target_line_id || task.target_line_id === targetId)
        .map(task => ({
          ...task,
          is_visible: !hiddenTasks.has(task.task_id),
          is_custom: !!task.target_line_id
        }));
      return responseJSON({ status: "ok", tasks });
    }

    if (action === "toggleTaskVisibility") {
      const targetId = postData.target_line_id;
      const taskId = postData.task_id;
      const isVisible = postData.is_visible;
      toggleHiddenTask(targetId, taskId, !isVisible);
      return responseJSON({ status: "updated" });
    }

    if (action === "addCustomTask") {
      const targetId = postData.target_line_id;
      const taskData = postData.task;
      const newTaskId = "CUST-" + new Date().getTime();
      addCustomTask({
        task_id: newTaskId,
        category: taskData.category || "追加タスク",
        task_content: taskData.task_content || "",
        due_formula: taskData.due_formula || "",
        due_estimate: taskData.due_estimate || "",
        memo: taskData.memo || "",
        is_active: true,
        target_line_id: targetId
      });
      return responseJSON({ status: "created" });
    }

    if (action === "deleteCustomTask") {
      const taskId = postData.task_id;
      deleteCustomTask(taskId);
      return responseJSON({ status: "deleted" });
    }

    return responseJSON({ status: "error", message: "Invalid action" });
  } catch (error: any) {
    return responseJSON({ status: "error", message: error.message });
  }
};
