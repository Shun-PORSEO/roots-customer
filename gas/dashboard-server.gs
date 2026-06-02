// ─── doGet ───────────────────────────────────────────────────────────────────

function doGet() {
  return HtmlService.createHtmlOutputFromFile('dashboard')
    .setTitle('Roots DB ダッシュボード')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function _s(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

// Build header→columnIndex map for a sheet
function _colMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const m = {};
  headers.forEach(function (h, i) { if (h) m[String(h).trim()] = i; });
  return m;
}

function _isoDate(v) {
  if (v instanceof Date) {
    const y = v.getFullYear();
    const mo = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return y + '-' + mo + '-' + d;
  }
  return String(v || '');
}

function _bool(v) {
  return v === true || String(v).toLowerCase() === 'true';
}

// ─── Task Master internal reader (handles old 8-col and new 11-col schema) ───

function _readTaskSheet(includeInactive) {
  const sheet = _s('task_master');
  if (!sheet) return [];
  const m = _colMap(sheet);
  const data = sheet.getDataRange().getValues();
  const tasks = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r[0]) continue;
    const isActive = m['is_active'] !== undefined ? _bool(r[m['is_active']]) : true;
    if (!includeInactive && !isActive) continue;
    tasks.push({
      task_id:          String(r[m['task_id']]          || r[0]),
      venue_id:         m['venue_id']         !== undefined ? String(r[m['venue_id']]         || '') : '',
      category:         m['category']         !== undefined ? String(r[m['category']]         || '') : '',
      task_content:     m['task_content']     !== undefined ? String(r[m['task_content']]     || '') : '',
      due_formula:      m['due_formula']      !== undefined ? String(r[m['due_formula']]      || '') : '',
      due_estimate:     m['due_estimate']     !== undefined ? String(r[m['due_estimate']]     || '') : '',
      memo:             m['memo']             !== undefined ? String(r[m['memo']]             || '') : '',
      is_active:        isActive,
      target_line_id:   m['target_line_id']   !== undefined ? String(r[m['target_line_id']]   || '') : '',
      manual_url:       m['manual_url']       !== undefined ? String(r[m['manual_url']]       || '') : '',
      reminder_message: m['reminder_message'] !== undefined ? String(r[m['reminder_message']] || '') : '',
    });
  }
  return tasks;
}

// Append a task row respecting whether the sheet has the new schema (venue_id present) or old
function _appendTaskRow(sheet, m, task) {
  if (m['venue_id'] !== undefined) {
    const maxCol = Math.max.apply(null, Object.values(m));
    const row = new Array(maxCol + 1).fill('');
    row[m['task_id']]        = task.task_id;
    row[m['venue_id']]       = task.venue_id || '';
    row[m['category']]       = task.category || '';
    row[m['task_content']]   = task.task_content || '';
    row[m['due_formula']]    = task.due_formula || '';
    row[m['due_estimate']]   = task.due_estimate || '';
    row[m['memo']]           = task.memo || '';
    row[m['is_active']]      = task.is_active !== false;
    row[m['target_line_id']] = task.target_line_id || '';
    if (m['manual_url']       !== undefined) row[m['manual_url']]       = task.manual_url || '';
    if (m['reminder_message'] !== undefined) row[m['reminder_message']] = task.reminder_message || '';
    sheet.appendRow(row);
  } else {
    // Old 8-column schema
    sheet.appendRow([
      task.task_id,
      task.category || '',
      task.task_content || '',
      task.due_formula || '',
      task.due_estimate || '',
      task.memo || '',
      task.is_active !== false,
      task.target_line_id || '',
    ]);
  }
}

// ─── setupDefaultTaskMaster (copy base tasks to a venue) ─────────────────────

function _setupDefaultTaskMaster(venueId) {
  const sheet = _s('task_master');
  if (!sheet) return { added: 0, skipped: 0 };
  const m = _colMap(sheet);
  const all = _readTaskSheet(true);
  const baseTasks = all.filter(function (t) { return !t.venue_id && !t.target_line_id; });

  // Collect which base task_ids already have a copy for this venue
  const copiedSuffixes = new Set();
  all.filter(function (t) { return t.venue_id === venueId; }).forEach(function (t) {
    // RC001-T001 → "T001"; also handles RC001-CUST-001
    const idx = t.task_id.indexOf('-');
    if (idx !== -1) copiedSuffixes.add(t.task_id.slice(idx + 1));
  });

  let added = 0, skipped = 0;
  baseTasks.forEach(function (base) {
    if (copiedSuffixes.has(base.task_id)) { skipped++; return; }
    _appendTaskRow(sheet, m, Object.assign({}, base, {
      task_id: venueId + '-' + base.task_id,
      venue_id: venueId,
    }));
    added++;
  });
  CacheService.getScriptCache().remove('activeTasks');
  return { added: added, skipped: skipped };
}

function _syncAllVenuesWithBaseTasks() {
  const venues = getVenues();
  let totalAdded = 0, totalSkipped = 0;
  venues.forEach(function (v) {
    const r = _setupDefaultTaskMaster(v.venue_id);
    totalAdded   += r.added;
    totalSkipped += r.skipped;
  });
  return { venues: venues.length, added: totalAdded, skipped: totalSkipped };
}

// ─── Customer internal reader ─────────────────────────────────────────────────

function _readCustomers(venueId) {
  const sheet = _s('customers');
  if (!sheet) return [];
  const m = _colMap(sheet);
  const data = sheet.getDataRange().getValues();
  const results = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r[0]) continue;
    const isAdmin = m['is_admin'] !== undefined ? _bool(r[m['is_admin']]) : false;
    if (isAdmin) continue;
    const c = {
      line_id:      String(r[m['line_id']] || r[0]),
      venue_id:     m['venue_id']     !== undefined ? String(r[m['venue_id']]     || '') : '',
      wedding_date: m['wedding_date'] !== undefined ? _isoDate(r[m['wedding_date']]) : '',
      created_at:   m['created_at']   !== undefined ? String(r[m['created_at']]   || '') : '',
      name1_kana:   m['name1_kana']   !== undefined ? String(r[m['name1_kana']]   || '') : '',
      name2_kana:   m['name2_kana']   !== undefined ? String(r[m['name2_kana']]   || '') : '',
    };
    if (venueId && c.venue_id !== venueId) continue;
    results.push(c);
  }
  return results;
}

// ─── Draft internal reader ────────────────────────────────────────────────────

function _readDrafts(venueId, dateStr) {
  const sheet = _s('message_drafts');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const drafts = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const d = {
      draft_id:      String(data[i][0]),
      venue_id:      String(data[i][1] || ''),
      couple_id:     String(data[i][2] || ''),
      task_id:       String(data[i][3] || ''),
      draft_message: String(data[i][4] || ''),
      status:        String(data[i][5] || ''),
      created_at:    String(data[i][6] || ''),
      sent_at:       String(data[i][7] || ''),
    };
    if (venueId && d.venue_id !== venueId) continue;
    if (dateStr && !d.created_at.startsWith(dateStr)) continue;
    drafts.push(d);
  }
  return drafts;
}

// ─── Venue functions ──────────────────────────────────────────────────────────

function getDashboardVenues() {
  try {
    const venues = getVenues();
    const allCustomers = _readCustomers(null);
    const drafts = _readDrafts(null, null);
    return venues.map(function (v) {
      const coupleCount   = allCustomers.filter(function (c) { return c.venue_id === v.venue_id; }).length;
      const pendingDrafts = drafts.filter(function (d) { return d.venue_id === v.venue_id && d.status === 'pending'; }).length;
      return {
        venue_id:                v.venue_id,
        venue_name:              v.venue_name,
        planner_line_user_id:    v.planner_line_user_id   || '',
        line_channel_access_token: v.line_channel_access_token || '',
        line_liff_id:            v.line_liff_id            || '',
        active:                  v.active,
        created_at:              v.created_at              || '',
        couple_count:            coupleCount,
        pending_drafts:          pendingDrafts,
      };
    });
  } catch (e) { throw new Error(e.message); }
}

function createDashboardVenue(data) {
  try {
    createVenue({
      venue_id:                  data.venue_id,
      venue_name:                data.venue_name,
      planner_line_user_id:      data.planner_line_user_id      || '',
      line_channel_access_token: data.line_channel_access_token || '',
      line_liff_id:              data.line_liff_id              || '',
      active: true,
    });
    const result = _setupDefaultTaskMaster(data.venue_id);
    return { ok: true, added: result.added, skipped: result.skipped };
  } catch (e) { throw new Error(e.message); }
}

function toggleVenueActive(venueId, active) {
  try {
    updateVenueStatus(venueId, active);
    return { ok: true };
  } catch (e) { throw new Error(e.message); }
}

// ─── Task Master functions ────────────────────────────────────────────────────

function getDashboardTasks(venueId) {
  try {
    const all = _readTaskSheet(true);
    if (!venueId) return all;
    return all.filter(function (t) { return t.venue_id === venueId; });
  } catch (e) { throw new Error(e.message); }
}

function updateTaskField(taskId, field, value) {
  try {
    const allowed = ['category', 'task_content', 'due_formula', 'due_estimate',
                     'memo', 'reminder_message', 'manual_url', 'is_active'];
    if (allowed.indexOf(field) < 0) throw new Error('Invalid field: ' + field);
    const sheet = _s('task_master');
    if (!sheet) throw new Error('task_master not found');
    const m = _colMap(sheet);
    if (m[field] === undefined) {
      // Column doesn't exist yet — skip silently (old schema)
      return { ok: true, skipped: true };
    }
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === taskId) {
        sheet.getRange(i + 1, m[field] + 1).setValue(value);
        CacheService.getScriptCache().remove('activeTasks');
        return { ok: true };
      }
    }
    throw new Error('Task not found: ' + taskId);
  } catch (e) { throw new Error(e.message); }
}

function addBaseTask(data) {
  try {
    const sheet = _s('task_master');
    if (!sheet) throw new Error('task_master not found');
    const m = _colMap(sheet);
    const taskId = 'T' + String(Date.now()).slice(-6);
    _appendTaskRow(sheet, m, {
      task_id:          taskId,
      venue_id:         '',
      category:         data.category         || '',
      task_content:     data.task_content     || '',
      due_formula:      data.due_formula      || '',
      due_estimate:     data.due_estimate     || '',
      memo:             data.memo             || '',
      is_active:        true,
      target_line_id:   '',
      manual_url:       data.manual_url       || '',
      reminder_message: data.reminder_message || '',
    });
    CacheService.getScriptCache().remove('activeTasks');
    return { ok: true, task_id: taskId };
  } catch (e) { throw new Error(e.message); }
}

function addVenueTask(venueId, data) {
  try {
    const sheet = _s('task_master');
    if (!sheet) throw new Error('task_master not found');
    const m = _colMap(sheet);
    const taskId = venueId + '-CUST-' + String(Date.now()).slice(-6);
    _appendTaskRow(sheet, m, {
      task_id:          taskId,
      venue_id:         venueId,
      category:         data.category         || '',
      task_content:     data.task_content     || '',
      due_formula:      data.due_formula      || '',
      due_estimate:     data.due_estimate     || '',
      memo:             data.memo             || '',
      is_active:        true,
      target_line_id:   '',
      manual_url:       data.manual_url       || '',
      reminder_message: data.reminder_message || '',
    });
    CacheService.getScriptCache().remove('activeTasks');
    return { ok: true, task_id: taskId };
  } catch (e) { throw new Error(e.message); }
}

function toggleTaskActive(taskId, active) {
  try {
    return updateTaskField(taskId, 'is_active', active);
  } catch (e) { throw new Error(e.message); }
}

function testLineSend(taskId, venueId) {
  try {
    const venue = getVenue(venueId);
    if (!venue) throw new Error('Venue not found: ' + venueId);
    if (!venue.planner_line_user_id)    throw new Error('planner_line_user_id が未設定です');
    if (!venue.line_channel_access_token) throw new Error('line_channel_access_token が未設定です');

    const tasks = _readTaskSheet(true);
    const task  = tasks.filter(function (t) { return t.task_id === taskId; })[0];
    if (!task) throw new Error('Task not found: ' + taskId);

    const text = '[テスト送信]\nタスク: ' + task.task_content + '\n期限目安: ' + task.due_estimate;
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + venue.line_channel_access_token },
      payload: JSON.stringify({
        to: venue.planner_line_user_id,
        messages: [{ type: 'text', text: text }],
      }),
      muteHttpExceptions: true,
    };
    const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', options);
    const ok  = res.getResponseCode() === 200;
    return { ok: ok, message: ok ? '送信しました' : res.getContentText() };
  } catch (e) { throw new Error(e.message); }
}

function syncBaseTasks() {
  try {
    return _syncAllVenuesWithBaseTasks();
  } catch (e) { throw new Error(e.message); }
}

// ─── Customer functions ───────────────────────────────────────────────────────

function getDashboardCustomers(venueId) {
  try {
    const customers = _readCustomers(venueId || null);
    const allTasks  = _readTaskSheet(false);
    const progSheet = _s('task_progress');
    const progData  = progSheet ? progSheet.getDataRange().getValues() : [];

    return customers.map(function (c) {
      const relevant = allTasks.filter(function (t) {
        return !t.target_line_id || t.target_line_id === c.line_id;
      });
      const doneSet = new Set();
      for (let i = 1; i < progData.length; i++) {
        if (progData[i][0] === c.line_id && _bool(progData[i][2])) {
          doneSet.add(String(progData[i][1]));
        }
      }
      const doneCount = relevant.filter(function (t) { return doneSet.has(t.task_id); }).length;
      return Object.assign({}, c, { total_tasks: relevant.length, done_tasks: doneCount });
    });
  } catch (e) { throw new Error(e.message); }
}

function addCustomer(data) {
  try {
    const sheet = _s('customers');
    if (!sheet) throw new Error('customers sheet not found');
    const m = _colMap(sheet);
    if (m['venue_id'] !== undefined) {
      const maxCol = Math.max.apply(null, Object.values(m));
      const row = new Array(maxCol + 1).fill('');
      row[m['line_id']]      = data.line_id;
      row[m['venue_id']]     = data.venue_id     || '';
      row[m['wedding_date']] = data.wedding_date || '';
      row[m['created_at']]   = new Date().toISOString();
      row[m['name1_kana']]   = data.name1_kana   || '';
      row[m['name2_kana']]   = data.name2_kana   || '';
      if (m['is_admin'] !== undefined) row[m['is_admin']] = false;
      sheet.appendRow(row);
    } else {
      // Old schema — no venue_id column
      createCustomer(data.line_id, data.wedding_date, data.name1_kana || '', data.name2_kana || '');
    }
    return { ok: true };
  } catch (e) { throw new Error(e.message); }
}

function updateCustomer(lineId, data) {
  try {
    const sheet = _s('customers');
    if (!sheet) throw new Error('customers sheet not found');
    const m = _colMap(sheet);
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) !== lineId) continue;
      if (data.name1_kana   !== undefined && m['name1_kana']   !== undefined)
        sheet.getRange(i + 1, m['name1_kana']   + 1).setValue(data.name1_kana);
      if (data.name2_kana   !== undefined && m['name2_kana']   !== undefined)
        sheet.getRange(i + 1, m['name2_kana']   + 1).setValue(data.name2_kana);
      if (data.wedding_date !== undefined && m['wedding_date'] !== undefined)
        sheet.getRange(i + 1, m['wedding_date'] + 1).setValue(data.wedding_date);
      if (data.venue_id     !== undefined && m['venue_id']     !== undefined)
        sheet.getRange(i + 1, m['venue_id']     + 1).setValue(data.venue_id);
      return { ok: true };
    }
    throw new Error('Customer not found: ' + lineId);
  } catch (e) { throw new Error(e.message); }
}

function resetCustomerProgress(lineId) {
  try {
    const sheet = _s('task_progress');
    if (!sheet) return { ok: true, deleted: 0 };
    const data = sheet.getDataRange().getValues();
    const toDelete = [];
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]) === lineId) toDelete.push(i + 1);
    }
    toDelete.forEach(function (r) { sheet.deleteRow(r); });
    CacheService.getScriptCache().remove('progress_' + lineId);
    return { ok: true, deleted: toDelete.length };
  } catch (e) { throw new Error(e.message); }
}

function getCustomerTasks(lineId, venueId) {
  try {
    const allTasks  = _readTaskSheet(true);
    const progSheet = _s('task_progress');
    const progData  = progSheet ? progSheet.getDataRange().getValues() : [];
    const hidSheet  = _s('user_hidden_tasks');
    const hidData   = hidSheet  ? hidSheet.getDataRange().getValues()  : [];

    const doneMap = {};
    for (let i = 1; i < progData.length; i++) {
      if (progData[i][0] === lineId) doneMap[String(progData[i][1])] = _bool(progData[i][2]);
    }
    const hiddenSet = new Set();
    for (let i = 1; i < hidData.length; i++) {
      if (String(hidData[i][0]) === lineId) hiddenSet.add(String(hidData[i][1]));
    }

    return allTasks
      .filter(function (t) {
        if (t.target_line_id && t.target_line_id !== lineId) return false;
        // Include base tasks (no venue_id) and venue-specific tasks for this venue
        if (!t.target_line_id && t.venue_id && venueId && t.venue_id !== venueId) return false;
        return true;
      })
      .map(function (t) {
        return Object.assign({}, t, {
          is_done:    doneMap[t.task_id] === true,
          is_visible: !hiddenSet.has(t.task_id),
          is_custom:  !!t.target_line_id,
        });
      });
  } catch (e) { throw new Error(e.message); }
}

function addTaskToCustomer(lineId, venueId, taskData) {
  try {
    const sheet = _s('task_master');
    if (!sheet) throw new Error('task_master not found');
    const m      = _colMap(sheet);
    const taskId = 'CUST-' + Date.now();
    _appendTaskRow(sheet, m, {
      task_id:          taskId,
      venue_id:         venueId  || '',
      category:         taskData.category     || '追加タスク',
      task_content:     taskData.task_content || '',
      due_formula:      taskData.due_formula  || '',
      due_estimate:     taskData.due_estimate || '',
      memo:             taskData.memo         || '',
      is_active:        true,
      target_line_id:   lineId,
      manual_url:       '',
      reminder_message: '',
    });
    CacheService.getScriptCache().remove('activeTasks');
    return { ok: true, task_id: taskId };
  } catch (e) { throw new Error(e.message); }
}

function removeCustomTaskFromCustomer(taskId) {
  try {
    deleteCustomTask(taskId);
    return { ok: true };
  } catch (e) { throw new Error(e.message); }
}

function toggleCustomerTaskVisibility(lineId, taskId, isVisible) {
  try {
    toggleHiddenTask(lineId, taskId, !isVisible);
    return { ok: true };
  } catch (e) { throw new Error(e.message); }
}

// ─── Draft functions ──────────────────────────────────────────────────────────

function getDashboardDrafts(venueId, dateStr) {
  try {
    const drafts    = _readDrafts(venueId || null, dateStr || null);
    const customers = _readCustomers(null);
    const nameMap   = {};
    customers.forEach(function (c) {
      nameMap[c.line_id] = [c.name1_kana, c.name2_kana].filter(Boolean).join(' & ') || c.line_id;
    });
    return drafts.map(function (d) {
      return Object.assign({}, d, { couple_name: nameMap[d.couple_id] || d.couple_id });
    });
  } catch (e) { throw new Error(e.message); }
}

function editDraftMessage(draftId, message) {
  try {
    const sheet = _s('message_drafts');
    if (!sheet) throw new Error('message_drafts not found');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === draftId) {
        sheet.getRange(i + 1, 5).setValue(message);
        return { ok: true };
      }
    }
    throw new Error('Draft not found: ' + draftId);
  } catch (e) { throw new Error(e.message); }
}

function changeDraftStatus(draftId, status) {
  try {
    const sheet = _s('message_drafts');
    if (!sheet) throw new Error('message_drafts not found');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === draftId) {
        sheet.getRange(i + 1, 6).setValue(status);
        if (status === 'sent') sheet.getRange(i + 1, 8).setValue(new Date().toISOString());
        return { ok: true };
      }
    }
    throw new Error('Draft not found: ' + draftId);
  } catch (e) { throw new Error(e.message); }
}

// ─── System functions ─────────────────────────────────────────────────────────

function runSendReminders() {
  try {
    sendReminders();
    return { ok: true };
  } catch (e) { throw new Error(e.message); }
}

function runSetupEnvironment() {
  try {
    setupEnvironment();
    return { ok: true };
  } catch (e) { throw new Error(e.message); }
}

function runSetupRemindTrigger() {
  try {
    setupRemindTrigger();
    return { ok: true };
  } catch (e) { throw new Error(e.message); }
}
