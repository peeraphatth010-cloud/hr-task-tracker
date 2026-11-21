export type TaskStatus = "todo" | "in_progress" | "waiting" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type UserRole = "admin" | "viewer";
export type RecurrenceType = "none" | "monthly" | "yearly" | "every_n_days";

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  sort_order: number;
}

export interface ChecklistItem {
  id: string;
  task_id: string;
  text: string;
  is_done: boolean;
  sort_order: number;
}

export interface PresetChecklistTemplate {
  text: string;
  order: number;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  items: string[];
  created_at: string;
  updated_at?: string;
}

export interface Preset {
  id: string;
  user_id?: string | null;
  owner_email?: string | null;
  name: string;
  category_id: string | null;
  description: string | null;
  priority: TaskPriority;
  duration_days: number;
  include_in_report_default: boolean;
  recurrence_type: RecurrenceType;
  recurrence_day: number | null;
  recurrence_month: number | null;
  recurrence_interval: number | null;
  create_ahead_days: number;
  checklist: PresetChecklistTemplate[];
  tags: string[];
  is_active: boolean;
  created_at: string;
}

export interface CommentItem {
  id: string;
  task_id: string;
  author_id?: string | null;
  author_name: string;
  body: string;
  is_activity: boolean;
  created_at: string;
}

export interface AttachmentItem {
  id: string;
  task_id: string;
  storage_path: string;
  file_name: string;
  size_bytes: number;
  uploaded_by?: string | null;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  task_id: string;
  user_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  minutes: number;
  note?: string | null;
  created_at: string;
}

export interface TaskDependency {
  task_id: string;
  depends_on_id: string;
}

export interface Task {
  id: string;
  code: string | null;
  parent_id: string | null;
  preset_id: string | null;
  owner_email?: string | null;
  gcal_event_id?: string | null;
  gcal_synced_at?: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category_id: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  include_in_report: boolean;
  visibility: "team" | "admin_only";
  tags: string[];
  position: number;
  assignee_name: string;
  assignee_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  // Computed / joined relations
  category?: Category;
  checklist_items?: ChecklistItem[];
  comments?: CommentItem[];
  attachments?: AttachmentItem[];
  time_entries?: TimeEntry[];
}
