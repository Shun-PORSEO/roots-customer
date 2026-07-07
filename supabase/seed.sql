-- ローカル開発シード（supabase db reset で migrations 後に実行される）。
-- 縦スライス #1（getTasksAndUser）〜 #3（管理経路）が dev バイパス line_id で緑になる最小データ。
--   カップル:  id_token="dev:Udev123"
--   管理者:    id_token="dev:Uadmin123"（/admin 一式を叩ける）

-- app_couple にローカル用パスワードを付与（ローカル専用。prod では別途 Vault/Secrets で管理）
alter role app_couple with password 'devpassword';

-- company / venue
insert into companies (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'サンプルウェディング社');

insert into venues (id, company_id, code, venue_name, planner_line_user_id, line_liff_id) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001',
   'RC001', 'サンプル式場', 'Uplanner123', '');

-- dev バイパス用カップル + 管理者
insert into customers (line_id, company_id, venue_id, wedding_date, name1_kana, name2_kana, is_admin) values
  ('Udev123', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1',
   date '2026-10-10', 'さくら', 'たろう', false),
  ('Uadmin123', '00000000-0000-0000-0000-000000000001', null,
   null, 'プランナー', 'さん', true);

-- 共有タスク雛形（プロダクトコンテンツ。venue_id null = base 共通）
insert into task_master (task_id, company_id, category, task_content, due_formula, due_estimate, reminder_message) values
  ('T001', '00000000-0000-0000-0000-000000000001', '会場決定', '会場・日程の決定、お申込書、お内金振込', '挙式日 - 180日', '挙式6ヶ月前', ''),
  ('T003', '00000000-0000-0000-0000-000000000001', '衣装', 'ドレス試着・決定', '挙式日 - 120日', '挙式4ヶ月前', 'ドレス試着のご案内です。お手隙の際にご確認・ご対応をお願いいたします🙇'),
  ('T005', '00000000-0000-0000-0000-000000000001', '招待状', '招待状の準備・発送', '挙式日 - 90日', '挙式3ヶ月前', '');

-- カップル固有のカスタムタスク
insert into custom_tasks (task_id, company_id, target_line_id, category, task_content, due_formula) values
  ('CUST-1', '00000000-0000-0000-0000-000000000001', 'Udev123', '追加', '両親への挨拶', '挙式日 - 150日');

-- 進捗（T001 は完了、T003 にコメント）
insert into task_progress (line_id, task_id, is_done, comment) values
  ('Udev123', 'T001', true, ''),
  ('Udev123', 'T003', false, 'Takami Bridal で予約検討中');

-- 手配物（Udev123 の実物 + T003 のテンプレ）
insert into task_items (item_id, company_id, task_id, line_id, item_name, quantity, is_done, memo) values
  ('ITEM-dev-1', '00000000-0000-0000-0000-000000000001', 'T003', 'Udev123', 'メインドレス', 1, true,  'Takami Bridal で予約済み'),
  ('ITEM-dev-2', '00000000-0000-0000-0000-000000000001', 'T003', 'Udev123', 'お色直し用ドレス', 1, false, ''),
  ('ITEM-tpl-1', '00000000-0000-0000-0000-000000000001', 'T003', null,      'メインドレス', 1, false, '');

-- 配信ログ（管理画面 /admin/messages の表示確認用）
insert into message_drafts (draft_id, company_id, venue_id, couple_id, task_id, draft_message, status, sent_at) values
  ('DRAFT-dev-1', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1',
   'Udev123', 'T003', '「ドレス試着・決定」のご案内です。' || E'\n' || 'お手隙の際にご確認・ご対応をお願いいたします🙇', 'sent', now());
