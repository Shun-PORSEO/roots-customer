// sheets.ts functions will be available globally in GAS
// types.ts interfaces will be available globally in GAS
const responseJSON = (data) => {
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
};
function doGet(e) {
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
            const tasks = allTasks
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
        if (action === "getVenues") {
            const venues = getVenues();
            return responseJSON({ status: "ok", venues });
        }
        return responseJSON({ status: "error", message: "Invalid action" });
    }
    catch (error) {
        return responseJSON({ status: "error", message: error.message });
    }
}
;
function doPost(e) {
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
                return responseJSON({
                    status: "exists",
                    wedding_date: existing.wedding_date,
                    name1_kana: existing.name1_kana || "",
                    name2_kana: existing.name2_kana || "",
                    is_admin: existing.is_admin || false,
                });
            }
            return responseJSON({ status: "not_found" });
        }
        if (action === "register") {
            const weddingDate = postData.wedding_date;
            const name1Kana = postData.name1_kana || "";
            const name2Kana = postData.name2_kana || "";
            const existing = getCustomer(lineId);
            if (existing) {
                // 既存ユーザーでも名前が未登録の場合は更新する
                if ((!existing.name1_kana || !existing.name2_kana) && (name1Kana || name2Kana)) {
                    updateCustomerNames(lineId, name1Kana, name2Kana);
                }
                return responseJSON({
                    status: "exists",
                    wedding_date: existing.wedding_date,
                    name1_kana: name1Kana || existing.name1_kana || "",
                    name2_kana: name2Kana || existing.name2_kana || "",
                });
            }
            createCustomer(lineId, weddingDate, name1Kana, name2Kana);
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
        if (action === "getUsersWithProgress") {
            const users = getUsersWithProgress();
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
        // ─── task_items（手配物）──────────────────────────────
        if (action === "getTaskItems") {
            const targetId = postData.target_line_id;
            if (!targetId) {
                return responseJSON({
                    status: "error",
                    message: "target_line_id is required",
                });
            }
            const items = getTaskItems(targetId);
            return responseJSON({ status: "ok", items });
        }
        if (action === "addTaskItem") {
            const targetId = postData.target_line_id;
            const taskId = postData.task_id;
            const itemName = String(postData.item_name || "").trim();
            const quantity = Math.max(1, parseInt(postData.quantity, 10) || 1);
            const memo = postData.memo || "";
            if (!targetId || !taskId || !itemName) {
                return responseJSON({
                    status: "error",
                    message: "target_line_id / task_id / item_name は必須",
                });
            }
            const item = addTaskItem(taskId, targetId, itemName, quantity, memo);
            return responseJSON({ status: "created", item });
        }
        if (action === "updateTaskItem") {
            const itemId = postData.item_id;
            const patch = postData.patch || {};
            if (!itemId) {
                return responseJSON({
                    status: "error",
                    message: "item_id is required",
                });
            }
            const cleanPatch = {};
            if (patch.item_name !== undefined)
                cleanPatch.item_name = String(patch.item_name);
            if (patch.quantity !== undefined)
                cleanPatch.quantity = Math.max(1, parseInt(patch.quantity, 10) || 1);
            if (patch.is_done !== undefined)
                cleanPatch.is_done = !!patch.is_done;
            if (patch.memo !== undefined)
                cleanPatch.memo = String(patch.memo);
            const ok = updateTaskItem(itemId, cleanPatch);
            if (!ok)
                return responseJSON({ status: "error", message: "Item not found" });
            return responseJSON({ status: "updated" });
        }
        if (action === "deleteTaskItem") {
            const itemId = postData.item_id;
            if (!itemId) {
                return responseJSON({
                    status: "error",
                    message: "item_id is required",
                });
            }
            const ok = deleteTaskItem(itemId);
            if (!ok)
                return responseJSON({ status: "error", message: "Item not found" });
            return responseJSON({ status: "deleted" });
        }
        // ─── テンプレ手配物（line_id="" の task_items）──────────
        if (action === "getTaskItemTemplates") {
            const taskId = postData.task_id;
            if (!taskId) {
                return responseJSON({
                    status: "error",
                    message: "task_id is required",
                });
            }
            const items = getTaskItemTemplates(taskId);
            return responseJSON({ status: "ok", items });
        }
        if (action === "addTaskItemTemplate") {
            const taskId = postData.task_id;
            const itemName = String(postData.item_name || "").trim();
            const quantity = Math.max(1, parseInt(postData.quantity, 10) || 1);
            const memo = postData.memo || "";
            if (!taskId || !itemName) {
                return responseJSON({
                    status: "error",
                    message: "task_id / item_name は必須",
                });
            }
            const item = addTaskItem(taskId, "", itemName, quantity, memo);
            return responseJSON({ status: "created", item });
        }
        // ─── venues ─────────────────────────────────────────────
        if (action === "getVenues") {
            const venues = getVenues();
            return responseJSON({ status: "ok", venues });
        }
        if (action === "createVenue") {
            const venueId = String(postData.venue_id || "").trim();
            const venueName = String(postData.venue_name || "").trim();
            if (!venueId || !venueName) {
                return responseJSON({
                    status: "error",
                    message: "venue_id / venue_name は必須",
                });
            }
            createVenue({
                venue_id: venueId,
                venue_name: venueName,
                planner_line_user_id: postData.planner_line_user_id || "",
                line_channel_access_token: postData.line_channel_access_token || "",
                line_liff_id: postData.line_liff_id || "",
                active: true,
            });
            return responseJSON({ status: "created", venue_id: venueId });
        }
        if (action === "updateVenue") {
            const venueId = postData.venue_id;
            const patch = postData.patch || {};
            if (!venueId) {
                return responseJSON({
                    status: "error",
                    message: "venue_id is required",
                });
            }
            const cleanPatch = {};
            if (patch.venue_name !== undefined)
                cleanPatch.venue_name = String(patch.venue_name);
            if (patch.planner_line_user_id !== undefined)
                cleanPatch.planner_line_user_id = String(patch.planner_line_user_id);
            if (patch.line_channel_access_token !== undefined)
                cleanPatch.line_channel_access_token = String(patch.line_channel_access_token);
            if (patch.line_liff_id !== undefined)
                cleanPatch.line_liff_id = String(patch.line_liff_id);
            if (patch.active !== undefined)
                cleanPatch.active = !!patch.active;
            const ok = updateVenue(venueId, cleanPatch);
            if (!ok)
                return responseJSON({ status: "error", message: "Venue not found" });
            return responseJSON({ status: "updated" });
        }
        if (action === "updateVenueStatus") {
            const venueId = postData.venue_id;
            const active = !!postData.active;
            if (!venueId) {
                return responseJSON({
                    status: "error",
                    message: "venue_id is required",
                });
            }
            updateVenueStatus(venueId, active);
            return responseJSON({ status: "updated" });
        }
        if (action === "getVenueTasks") {
            const allTasks = getActiveTasks();
            const tasks = allTasks.filter((t) => !t.target_line_id);
            return responseJSON({ status: "ok", tasks });
        }
        // ─── task_master の編集 / 追加 ─────────────────────────
        if (action === "updateTaskMaster") {
            const taskId = postData.task_id;
            const patch = postData.patch || {};
            if (!taskId) {
                return responseJSON({
                    status: "error",
                    message: "task_id is required",
                });
            }
            const cleanPatch = {};
            if (patch.category !== undefined)
                cleanPatch.category = String(patch.category);
            if (patch.task_content !== undefined)
                cleanPatch.task_content = String(patch.task_content);
            if (patch.due_formula !== undefined)
                cleanPatch.due_formula = String(patch.due_formula);
            if (patch.due_estimate !== undefined)
                cleanPatch.due_estimate = String(patch.due_estimate);
            if (patch.memo !== undefined)
                cleanPatch.memo = String(patch.memo);
            if (patch.is_active !== undefined)
                cleanPatch.is_active = !!patch.is_active;
            const ok = updateTaskMaster(taskId, cleanPatch);
            if (!ok)
                return responseJSON({ status: "error", message: "Task not found" });
            return responseJSON({ status: "updated" });
        }
        if (action === "addTaskMaster") {
            const taskData = postData.task || {};
            const newId = addTaskMaster({
                task_id: "",
                category: taskData.category || "",
                task_content: taskData.task_content || "",
                due_formula: taskData.due_formula || "",
                due_estimate: taskData.due_estimate || "",
                memo: taskData.memo || "",
                is_active: true,
                target_line_id: "",
            });
            return responseJSON({ status: "created", task_id: newId });
        }
        // ─── message_drafts ─────────────────────────────────────
        if (action === "getMessageDrafts") {
            const venueId = postData.venue_id || undefined;
            const status = postData.status || undefined;
            const drafts = getMessageDrafts(venueId, status);
            return responseJSON({ status: "ok", drafts });
        }
        // ─── テスト送信（プレースホルダ：将来 LINE Push 実装） ─
        if (action === "testSendTask") {
            // 実装はあとで（LINE Messaging API の Push）。
            // 今は単に ok を返してUIを動かす。
            return responseJSON({ status: "ok", message: "Not implemented yet" });
        }
        return responseJSON({ status: "error", message: "Invalid action" });
    }
    catch (error) {
        return responseJSON({ status: "error", message: error.message });
    }
}
;
