import ExcelJS from "exceljs";
import { Category, Task } from "./types";

const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

export function formatThaiDate(dateStr: string | null | undefined, useBuddhistEra = true): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const month = THAI_MONTHS_SHORT[d.getMonth()];
  const year = useBuddhistEra ? d.getFullYear() + 543 : d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function getDaysDiffFromToday(dueDateStr: string | null | undefined): number | null {
  if (!dueDateStr) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = dueDateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const due = new Date(y, m - 1, d);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getStatusLabel(status: Task["status"]): string {
  switch (status) {
    case "todo":
      return "To Do (รอดำเนินการ)";
    case "in_progress":
      return "In Progress (กำลังทำ)";
    case "waiting":
      return "Waiting (รอตรวจ/อนุมัติ)";
    case "done":
      return "Done (เสร็จสมบูรณ์)";
    default:
      return status;
  }
}

export function getPriorityLabel(priority: Task["priority"]): string {
  switch (priority) {
    case "urgent":
      return "Urgent (ด่วนที่สุด)";
    case "high":
      return "High (สูง)";
    case "medium":
      return "Medium (ปานกลาง)";
    case "low":
      return "Low (ต่ำ)";
    default:
      return priority;
  }
}

export interface ExportExcelOptions {
  tasks: Task[];
  categories: Category[];
  monthLabel: string;
  onlyPresentFlag: boolean;
  statusFilter: string;
  useBuddhistEra: boolean;
}

export async function exportTasksToExcel(options: ExportExcelOptions) {
  const { tasks, categories, monthLabel, onlyPresentFlag, statusFilter, useBuddhistEra } = options;

  const filtered = tasks.filter((t) => {
    if (onlyPresentFlag && !t.include_in_report) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    return true;
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HR Task Tracker Thailand Edition";
  workbook.created = new Date();

  // ============================================================================
  // SHEET 1: สรุปภาพรวม (Executive Overview)
  // ============================================================================
  const summarySheet = workbook.addWorksheet("1. สรุปภาพรวมผู้บริหาร", {
    views: [{ showGridLines: true }],
  });

  summarySheet.columns = [
    { header: "หัวข้อการสรุป (Metric / Category)", key: "metric", width: 38 },
    { header: "จำนวนงานทั้งหมด", key: "total", width: 18 },
    { header: "เสร็จสมบูรณ์ (Done)", key: "done", width: 20 },
    { header: "กำลังดำเนินการ", key: "in_progress", width: 18 },
    { header: "รอดำเนินการ / รออนุมัติ", key: "pending", width: 22 },
    { header: "ชั่วโมงทำงานรวม (ชม.)", key: "hours", width: 22 },
    { header: "อัตราความสำเร็จ (%)", key: "rate", width: 20 },
  ];

  // Style Header
  const headerRow1 = summarySheet.getRow(1);
  headerRow1.font = { name: "Tahoma", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  headerRow1.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF004AC6" },
  };
  headerRow1.height = 26;

  const totalCount = filtered.length;
  const doneTasks = filtered.filter((t) => t.status === "done");
  const inProgressTasks = filtered.filter((t) => t.status === "in_progress");
  const pendingTasks = filtered.filter((t) => t.status === "todo" || t.status === "waiting");

  const onTimeDone = doneTasks.filter((t) => {
    if (!t.due_date || !t.completed_at) return true;
    return t.completed_at.slice(0, 10) <= t.due_date;
  });

  const getTaskHours = (t: Task) => {
    const mins = (t.time_entries || []).reduce((acc, e) => acc + (e.minutes || 0), 0);
    return Number((mins / 60).toFixed(1));
  };

  const totalHours = filtered.reduce((acc, t) => acc + getTaskHours(t), 0);
  const completionRate = totalCount > 0 ? Math.round((doneTasks.length / totalCount) * 100) : 0;
  const onTimeRate = doneTasks.length > 0 ? Math.round((onTimeDone.length / doneTasks.length) * 100) : 100;

  summarySheet.addRow({
    metric: `สรุปรวมประจำรอบ (${monthLabel}) ${onlyPresentFlag ? "[เฉพาะงาน Present Flag ⭐]" : "[งานทั้งหมด]"}`,
    total: totalCount,
    done: doneTasks.length,
    in_progress: inProgressTasks.length,
    pending: pendingTasks.length,
    hours: Number(totalHours.toFixed(1)),
    rate: `${completionRate}% (ตรงเวลา ${onTimeRate}%)`,
  });

  summarySheet.addRow({});

  // Breakdown by Category
  for (const cat of categories) {
    const catTasks = filtered.filter((t) => t.category_id === cat.id);
    const catDone = catTasks.filter((t) => t.status === "done").length;
    const catInProg = catTasks.filter((t) => t.status === "in_progress").length;
    const catPending = catTasks.filter((t) => t.status === "todo" || t.status === "waiting").length;
    const catHours = catTasks.reduce((acc, t) => acc + getTaskHours(t), 0);
    const catRate = catTasks.length > 0 ? `${Math.round((catDone / catTasks.length) * 100)}%` : "0%";

    summarySheet.addRow({
      metric: `หมวด: ${cat.name}`,
      total: catTasks.length,
      done: catDone,
      in_progress: catInProg,
      pending: catPending,
      hours: Number(catHours.toFixed(1)),
      rate: catRate,
    });
  }

  // ============================================================================
  // SHEET 2: รายการงาน (Master Task List)
  // ============================================================================
  const detailSheet = workbook.addWorksheet("2. รายการงาน HR", {
    views: [{ showGridLines: true }],
  });

  detailSheet.columns = [
    { header: "รหัสงาน", key: "code", width: 12 },
    { header: "Present", key: "present", width: 12 },
    { header: "ชื่องาน (Task Title)", key: "title", width: 42 },
    { header: "หมวดหมู่ (Category)", key: "category", width: 24 },
    { header: "สถานะ (Status)", key: "status", width: 24 },
    { header: "ความสำคัญ", key: "priority", width: 18 },
    { header: "วันเริ่มงาน", key: "start_date", width: 16 },
    { header: "วันครบกำหนด (Due)", key: "due_date", width: 18 },
    { header: "วันเสร็จจริง", key: "completed_at", width: 18 },
    { header: "ความคืบหน้า Checklist", key: "progress", width: 22 },
    { header: "ชั่วโมงที่ใช้ (ชม.)", key: "hours", width: 18 },
    { header: "ผู้รับผิดชอบ", key: "assignee", width: 20 },
    { header: "รายละเอียด / หมายเหตุ", key: "description", width: 45 },
  ];

  const headerRow2 = detailSheet.getRow(1);
  headerRow2.font = { name: "Tahoma", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  headerRow2.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" },
  };
  headerRow2.height = 26;

  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  for (const t of filtered) {
    const items = t.checklist_items || [];
    const doneItems = items.filter((i) => i.is_done).length;
    const progressText =
      items.length > 0
        ? `${doneItems}/${items.length} (${Math.round((doneItems / items.length) * 100)}%)`
        : t.status === "done"
        ? "100%"
        : "0%";

    detailSheet.addRow({
      code: t.code || "-",
      present: t.include_in_report ? "⭐ นำเสนอ" : "-",
      title: t.title,
      category: t.category_id ? catMap.get(t.category_id) || "ทั่วไป" : "ทั่วไป",
      status: getStatusLabel(t.status),
      priority: getPriorityLabel(t.priority),
      start_date: formatThaiDate(t.start_date, useBuddhistEra),
      due_date: formatThaiDate(t.due_date, useBuddhistEra),
      completed_at: t.completed_at ? formatThaiDate(t.completed_at.slice(0, 10), useBuddhistEra) : "-",
      progress: progressText,
      hours: getTaskHours(t),
      assignee: t.assignee_name || "กานดา นวลจันทร์",
      description: t.description || "",
    });
  }

  // Generate Buffer & Trigger Browser Download (FR-8.5)
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const yyyyMm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = `HR_Report_${yyyyMm}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
