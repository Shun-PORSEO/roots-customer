// sheets.ts functions will be available globally in GAS
// types.ts interfaces will be available globally in GAS
const responseJSON = (data) => {
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
};
function doGetLiff(e) {
    try {
        const action = e.parameter.action;
        const lineId = e.parameter.line_id;
        const venueId = e.parameter.venue_id || "";
        if (!lineId) {
            return responseJSON({ status: "error", message: "Unauthorized" });
        }
        if (action === "getTasks" || action === "getTasksAndUser") {
            const customer = getCustomer(lineId);
            if (!customer) {
                return responseJSON({ status: "error", message: "Customer not found" });
            }
            // venue_id はカスタマーから取得（URLパラメータは補助）
            const effectiveVenueId = customer.venue_id || venueId;
            const allTasks = getActiveTasks(effectiveVenueId || undefined);
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
                    is_custom: !!task.target_line_id,
                    manual_url: task.manual_url || "",
                    comment: prog ? (prog.comment || "") : "",
                };
            }).filter(t => t.is_visible);
            if (action === "getTasksAndUser") return responseJSON({ status: "ok", tasks, wedding_date: customer.wedding_date, name1_kana: customer.name1_kana || "", name2_kana: customer.name2_kana || "", is_admin: customer.is_admin || false });
            return responseJSON({ tasks });
        }
        if (action === "getVenues") {
            // 未認証（LIFFの登録画面など）からも呼ばれる公開エンドポイントなので、
            // line_channel_access_token などの秘密は絶対に含めない。必要な項目だけ返す。
            const venues = getVenues().map((v) => ({
                venue_id: v.venue_id,
                venue_name: v.venue_name,
                planner_line_user_id: v.planner_line_user_id,
                line_liff_id: v.line_liff_id,
                active: v.active,
                created_at: v.created_at,
            }));
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
        const venueId = postData.venue_id || "";
        if (!lineId) {
            return responseJSON({ status: "error", message: "Unauthorized" });
        }
        // 管理系の action は customers.is_admin が立っている呼び出し元だけに許可する。
        // このゲートは Code.ts にはあったが .js に取り込まれておらず、本番では
        // line_id を名乗るだけで管理系が叩ける状態になっていた（2026-08-15 修正）。
        const ADMIN_ACTIONS = [
            "getUsers", "getUsersWithProgress", "getAdminUserTasks",
            "toggleTaskVisibility", "addCustomTask", "deleteCustomTask",
            "getMessageDrafts", "updateDraftStatus", "updateDraftMessage",
            "getVenueDetail", "updateTaskManualUrl", "getVenueTasks",
            "updateTaskMaster", "addTaskMaster",
            "getTaskItemTemplates", "addTaskItemTemplate",
        ];
        if (ADMIN_ACTIONS.indexOf(action) >= 0) {
            const caller = getCustomer(lineId);
            if (!caller || !caller.is_admin) {
                return responseJSON({ status: "error", message: "Forbidden" });
            }
        }
        if (action === "getUser") {
            const existing = getCustomer(lineId);
            if (existing) {
                return responseJSON({
                    status: "exists",
                    venue_id: existing.venue_id || "",
                    wedding_date: existing.wedding_date,
                    name1_kana: existing.name1_kana || "",
                    name2_kana: existing.name2_kana || "",
                    is_admin: existing.is_admin || false,
                });
            }
            // プランナーかどうかチェック
            const venue = venueId ? null : getVenueByPlannerId(lineId);
            if (venue) {
                return responseJSON({ status: "planner", venue_id: venue.venue_id, venue_name: venue.venue_name });
            }
            return responseJSON({ status: "not_found" });
        }
        if (action === "register") {
            const weddingDate = postData.wedding_date;
            const name1Kana = postData.name1_kana || "";
            const name2Kana = postData.name2_kana || "";
            const existing = getCustomer(lineId);
            if (existing) {
                if ((!existing.name1_kana || !existing.name2_kana) && (name1Kana || name2Kana)) {
                    updateCustomerNames(lineId, name1Kana, name2Kana);
                }
                return responseJSON({
                    status: "exists",
                    venue_id: existing.venue_id || venueId,
                    wedding_date: existing.wedding_date,
                    name1_kana: name1Kana || existing.name1_kana || "",
                    name2_kana: name2Kana || existing.name2_kana || "",
                });
            }
            // 新規 customer 作成時、同じ line_id の過去の進捗が残っていれば一掃する。
            // テストや LINE 再ログインで「新ペアなのに完了済みタスクが見える」という事象の原因なので、
            // ここで履歴をリセットして真っさらな状態から始められるようにする。
            deleteAllTaskProgress(lineId);
            createCustomer(lineId, weddingDate, name1Kana, name2Kana, venueId);
            return responseJSON({ status: "created", venue_id: venueId, wedding_date: weddingDate });
        }
        if (action === "updateTask") {
            const taskId = postData.task_id;
            const isDone = postData.is_done;
            updateOrCreateTaskProgress(lineId, taskId, isDone);
            return responseJSON({ status: "updated" });
        }
        // カップルがタスクごとにコメントを保存する（自分の line_id のみ）
        if (action === "updateTaskComment") {
            const taskId = postData.task_id;
            const comment = String(postData.comment || "");
            if (!taskId)
                return responseJSON({ status: "error", message: "task_id is required" });
            updateTaskComment(lineId, taskId, comment);
            return responseJSON({ status: "updated" });
        }
        // ─── プランナー向けアクション ─────────────────────────────────────
        if (action === "getUsers") {
            const users = getUsers(venueId || undefined);
            return responseJSON({ status: "ok", users });
        }
        if (action === "getUsersWithProgress") {
            const users = getUsersWithProgress(venueId || undefined);
            return responseJSON({ status: "ok", users });
        }
        if (action === "getAdminUserTasks") {
            const targetId = postData.target_line_id;
            const customer = getCustomer(targetId);
            const effectiveVenueId = (customer === null || customer === void 0 ? void 0 : customer.venue_id) || venueId || undefined;
            const allTasks = getActiveTasks(effectiveVenueId);
            const hiddenTasks = getHiddenTasks(targetId);
            const progressData = getTaskProgress(targetId);
            const tasks = allTasks
                .filter(task => !task.target_line_id || task.target_line_id === targetId)
                .map(task => {
                const prog = progressData.find(p => p.task_id === task.task_id);
                return {
                    ...task,
                    is_visible: !hiddenTasks.has(task.task_id),
                    is_custom: !!task.target_line_id,
                    is_done: prog ? prog.is_done : false,
                    comment: prog ? (prog.comment || "") : "", // カップルが残したコメントをプランナーに見せる
                };
            });
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
                venue_id: venueId,
                category: taskData.category || "追加タスク",
                task_content: taskData.task_content || "",
                due_formula: taskData.due_formula || "",
                due_estimate: taskData.due_estimate || "",
                memo: taskData.memo || "",
                is_active: true,
                target_line_id: targetId,
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
                return responseJSON({ status: "error", message: "target_line_id is required" });
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
                return responseJSON({ status: "error", message: "target_line_id / task_id / item_name は必須" });
            }
            const item = addTaskItem(taskId, targetId, itemName, quantity, memo);
            return responseJSON({ status: "created", item });
        }
        if (action === "updateTaskItem") {
            const itemId = postData.item_id;
            const patch = postData.patch || {};
            if (!itemId) {
                return responseJSON({ status: "error", message: "item_id is required" });
            }
            const cleanPatch = {};
            if (patch.item_name !== undefined) cleanPatch.item_name = String(patch.item_name);
            if (patch.quantity !== undefined) cleanPatch.quantity = Math.max(1, parseInt(patch.quantity, 10) || 1);
            if (patch.is_done !== undefined) cleanPatch.is_done = !!patch.is_done;
            if (patch.memo !== undefined) cleanPatch.memo = String(patch.memo);
            const ok = updateTaskItem(itemId, cleanPatch);
            if (!ok) return responseJSON({ status: "error", message: "Item not found" });
            // 手配物を「確定」(is_done=true) にしたとき、カップルへLINEで確定案内を送る。
            // notify フラグが立っているリクエストのみ送信（チェックを外す/数量変更などでは送らない）。
            // LINE送信に失敗しても更新自体は成功扱いにする（通知はベストエフォート）。
            if (cleanPatch.is_done === true && postData.notify) {
                try {
                    const targetLineId = postData.target_line_id || getTaskItemLineId(itemId);
                    if (targetLineId) {
                        const itemName = String(postData.item_name || "");
                        const taskContent = String(postData.task_content || "");
                        const customer = getCustomer(targetLineId);
                        const venue = customer && customer.venue_id ? getVenue(customer.venue_id) : null;
                        const token = venue ? venue.line_channel_access_token : "";
                        const label = taskContent ? `「${taskContent}」のタスクの手配物` : "手配物";
                        const namePart = itemName ? `「${itemName}」` : "";
                        const msg = `${label}${namePart}が確定しました。\n確定後24時間は変更できませんのでご了承ください。`;
                        pushLineMessage(targetLineId, msg, token);
                    }
                }
                catch (e) {
                    console.error("確定通知の送信に失敗:", e);
                }
            }
            return responseJSON({ status: "updated" });
        }
        if (action === "deleteTaskItem") {
            const itemId = postData.item_id;
            if (!itemId) {
                return responseJSON({ status: "error", message: "item_id is required" });
            }
            const ok = deleteTaskItem(itemId);
            if (!ok) return responseJSON({ status: "error", message: "Item not found" });
            return responseJSON({ status: "deleted" });
        }
        if (action === "getTaskItemTemplates") {
            const taskId = postData.task_id;
            if (!taskId) {
                return responseJSON({ status: "error", message: "task_id is required" });
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
                return responseJSON({ status: "error", message: "task_id / item_name は必須" });
            }
            const item = addTaskItem(taskId, "", itemName, quantity, memo);
            return responseJSON({ status: "created", item });
        }
        // ─── メッセージドラフト管理 ──────────────────────────────────────
        if (action === "getMessageDrafts") {
            const status = postData.status || undefined;
            const drafts = getMessageDrafts(venueId, status);
            return responseJSON({ status: "ok", drafts });
        }
        if (action === "updateDraftStatus") {
            const draftId = postData.draft_id;
            const draftStatus = postData.draft_status;
            updateDraftStatus(draftId, draftStatus);
            return responseJSON({ status: "updated" });
        }
        if (action === "updateDraftMessage") {
            const draftId = postData.draft_id;
            const message = postData.message;
            updateDraftMessage(draftId, message);
            return responseJSON({ status: "updated" });
        }
        if (action === "getVenueDetail") {
            const venue = getVenue(postData.venue_id);
            if (!venue) return responseJSON({ status: "error", message: "Venue not found" });
            const users = getUsersWithProgress(postData.venue_id);
            const pendingDrafts = getMessageDrafts(postData.venue_id, "pending");
            return responseJSON({ status: "ok", venue, users, pending_drafts_count: pendingDrafts.length });
        }
        // ─── タスクマスター（Next.js 管理画面 /admin/tasks 用）────────────────
        // 実装は GAS ダッシュボード側（dashboard-server.js）と共有する。
        // あちらは列をヘッダー名で解決する（_colMap）ので task_master の列が
        // 増減しても壊れない。ここで列番号を直書きしないこと。
        if (action === "getVenueTasks") {
            // venue_id 未指定 = base（共通）タスクのみ。停止中も含めて返す（画面側で絞る）。
            const tasks = getDashboardTasks(venueId || null);
            return responseJSON({ status: "ok", tasks });
        }
        if (action === "updateTaskMaster") {
            const taskId = String(postData.task_id || "");
            const patch = postData.patch || {};
            if (!taskId) {
                return responseJSON({ status: "error", message: "task_id is required" });
            }
            // venue_id は編集させない（式場の紐づけが壊れるとタスクが一覧から消えるため）
            const fields = [
                "category", "task_content", "due_formula", "due_estimate",
                "memo", "reminder_message", "manual_url", "is_active",
            ];
            let applied = 0;
            for (let fi = 0; fi < fields.length; fi++) {
                const f = fields[fi];
                if (patch[f] === undefined) continue;
                updateTaskField(taskId, f, patch[f]);
                applied++;
            }
            if (!applied) {
                return responseJSON({ status: "error", message: "更新対象の項目がありません" });
            }
            return responseJSON({ status: "updated" });
        }
        if (action === "addTaskMaster") {
            const task = postData.task || {};
            if (!String(task.task_content || "").trim()) {
                return responseJSON({ status: "error", message: "task_content は必須です" });
            }
            const r = venueId ? addVenueTask(venueId, task) : addBaseTask(task);
            return responseJSON({ status: "created", task_id: r.task_id });
        }
        if (action === "updateTaskManualUrl") {
            const taskId = String(postData.task_id || "");
            const manualUrl = String(postData.manual_url || "");
            if (!taskId) return responseJSON({ status: "error", message: "task_id is required" });
            if (manualUrl && !/^https?:\/\//.test(manualUrl)) {
                return responseJSON({ status: "error", message: "URLは http(s):// で始めてください" });
            }
            const ok = updateTaskManualUrl(taskId, manualUrl);
            if (!ok) return responseJSON({ status: "error", message: "Task not found" });
            return responseJSON({ status: "updated" });
        }
        return responseJSON({ status: "error", message: "Invalid action" });
    }
    catch (error) {
        return responseJSON({ status: "error", message: error.message });
    }
}
;
