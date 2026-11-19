"use client";

import React, { useState } from "react";
import { Category, Task } from "@/lib/types";
import { exportTasksToExcel } from "@/lib/excel-export";

interface ExportExcelModalProps {
  isOpen: boolean;
  initialOnlyPresent: boolean;
  tasks: Task[];
  categories: Category[];
  useBuddhistEra: boolean;
  onClose: () => void;
}

export default function ExportExcelModal({
  isOpen,
  initialOnlyPresent,
  tasks,
  categories,
  useBuddhistEra,
  onClose,
}: ExportExcelModalProps) {
  const [monthLabel, setMonthLabel] = useState<string>("พฤศจิกายน 2569 (2026-11)");
  const [onlyPresentFlag, setOnlyPresentFlag] = useState<boolean>(initialOnlyPresent);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [buddhistEra, setBuddhistEra] = useState<boolean>(useBuddhistEra);
  const [exporting, setExporting] = useState<boolean>(false);

  if (!isOpen) return null;

  const matchingCount = tasks.filter((t) => {
    if (onlyPresentFlag && !t.include_in_report) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    return true;
  }).length;

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportTasksToExcel({
        tasks,
        categories,
        monthLabel,
        onlyPresentFlag,
        statusFilter,
        useBuddhistEra: buddhistEra,
      });
      onClose();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-primary-fixed text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">file_download</span>
            </div>
            <div>
              <span className="font-label-sm text-primary uppercase font-bold">
                FR-8.3 & FR-8.4 EXCEL REPORT GENERATOR
              </span>
              <h3 className="font-headline-sm font-bold text-on-surface">
                ส่งออกรายงาน Excel ประจำเดือน (.xlsx)
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-container-low flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
              รอบเดือนที่แสดงในหัวรายงาน
            </label>
            <input
              type="text"
              value={monthLabel}
              onChange={(e) => setMonthLabel(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl bg-surface-container-low text-on-surface font-label-md font-bold"
            />
          </div>

          {/* Present Flag Filter Option */}
          <div className="p-4 rounded-2xl bg-secondary-fixed/50 flex items-center justify-between">
            <div>
              <div className="font-label-md font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-lg">star</span>
                กรองเฉพาะงานที่ติด Present Flag
              </div>
              <div className="font-label-sm text-on-surface-variant">
                ตัดงานประจำที่ไม่ต้องการนำเสนอ (เช่น ส่งประกันสังคม) ออกอัตโนมัติ
              </div>
            </div>
            <input
              type="checkbox"
              checked={onlyPresentFlag}
              onChange={(e) => setOnlyPresentFlag(e.target.checked)}
              className="w-5 h-5 accent-primary rounded"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                สถานะงานที่ต้องการ
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-container-low text-on-surface font-label-md"
              >
                <option value="all">ทุกสถานะ (All)</option>
                <option value="done">เฉพาะเสร็จสมบูรณ์ (Done)</option>
                <option value="in_progress">เฉพาะกำลังทำ (In Progress)</option>
                <option value="todo">เฉพาะรอดำเนินการ (To Do)</option>
              </select>
            </div>

            <div>
              <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                รูปแบบปีวันที่ (FR-8.6)
              </label>
              <select
                value={buddhistEra ? "be" : "ce"}
                onChange={(e) => setBuddhistEra(e.target.value === "be")}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-container-low text-on-surface font-label-md"
              >
                <option value="be">พุทธศักราช (พ.ศ. 2569)</option>
                <option value="ce">คริสต์ศักราช (ค.ศ. 2026)</option>
              </select>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-surface-container-low font-label-sm text-on-surface-variant space-y-1">
            <div className="font-bold text-on-surface">
              โครงสร้างไฟล์ Excel ที่จะได้ ({matchingCount} รายการงาน):
            </div>
            <div>• ชีตที่ 1: สรุปภาพรวมผู้บริหาร (จำนวนงานแต่ละสถานะ/หมวด, % เสร็จตรงเวลา)</div>
            <div>• ชีตที่ 2: รายการงาน HR (ชื่อ, หมวด, สถานะ, วันเริ่ม, ครบกำหนด, เสร็จจริง, ชั่วโมงที่ใช้)</div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-surface-container-low font-label-md font-semibold"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={handleExport}
            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-label-md font-bold shadow-md hover:opacity-95 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            <span>{exporting ? "กำลังสร้างไฟล์..." : `ดาวน์โหลด .xlsx (${matchingCount} งาน)`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
