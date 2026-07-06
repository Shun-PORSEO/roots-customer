-- ローカル開発シード（supabase db reset で migrations 後に実行される）。
-- 縦スライス #1（getTasksAndUser）が dev バイパス line_id で緑になる最小データ。

-- app_couple にローカル用パスワードを付与（ローカル専用。prod では別途 Vault/Secrets で管理）
alter role app_couple with password 'devpassword';

-- company / venue / customer
insert into companies (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'サンプルウェディング社');

insert into venues (id, company_id, venue_name) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'サンプル式場');

-- dev バイパス用カップル（ALLOW_DEV_LINE_BYPASS=true のとき id_token="dev:Udev123" で入れる）
insert into customers (line_id, company_id, venue_id, wedding_date, name1_kana, name2_kana, is_admin) values
  ('Udev123', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1',
   date '2026-10-10', 'さくら', 'たろう', false);

-- 共有タスク雛形（プロダクトコンテンツ）
insert into task_master (task_id, company_id, category, task_content, due_formula, due_estimate) values
  ('T001', '00000000-0000-0000-0000-000000000001', '会場決定', '会場・日程の決定、お申込書、お内金振込', '挙式日 - 180日', '挙式6ヶ月前'),
  ('T003', '00000000-0000-0000-0000-000000000001', '衣装', 'ドレス試着・決定', '挙式日 - 120日', '挙式4ヶ月前'),
  ('T005', '00000000-0000-0000-0000-000000000001', '招待状', '招待状の準備・発送', '挙式日 - 90日', '挙式3ヶ月前');

-- カップル固有のカスタムタスク
insert into custom_tasks (task_id, company_id, target_line_id, category, task_content, due_formula) values
  ('CUST-1', '00000000-0000-0000-0000-000000000001', 'Udev123', '追加', '両親への挨拶', '挙式日 - 150日');

-- 進捗（T001 は完了、T003 にコメント）
insert into task_progress (line_id, task_id, is_done, comment) values
  ('Udev123', 'T001', true, ''),
  ('Udev123', 'T003', false, 'Takami Bridal で予約検討中');
