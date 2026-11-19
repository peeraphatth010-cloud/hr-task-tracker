"use client";

import React, { useState } from "react";
import { Category, Task } from "@/lib/types";

interface CalendarViewProps {
  tasks: Task[];
  categories: Category[];
  useBuddhistEra: boolean;
  onSelectTask: (task: Task) => void;
}

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

export default function CalendarView({
  tasks,
  categories,
  useBuddhistEra,
  onSelectTask,
}: CalendarViewProps) {
  const [year, setYear] = useState<number>(2026);
  const [monthIdx, setMonthIdx] = useState<number>(10); // 10 = November

  const firstDayOfWeek = new Date(year, monthIdx, 1).getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

  const prevMonth = () => {
    if (monthIdx === 0) {
      setMonthIdx(11);
      setYear(year - 1);
    } else {
      setMonthIdx(monthIdx - 1);
    }
  };

  const nextMonth = () => {
    if (monthIdx === 11) {
      setMonthIdx(0);
      setYear(year + 1);
    } else {
      setMonthIdx(monthIdx + 1);
    }
  };

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDayOfWeek }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const getTasksForDay = (day: number): Task[] => {
    const mm = String(monthIdx + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const dateStr = `${year}-${mm}-${dd}`;
    return tasks.filter((t) => t.due_date === dateStr);
  };

  return (
    <div className="flex flex-col w-full pb-space-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-space-lg">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            ปฏิทินกำหนดส่งงาน HR (Monthly Schedule)
          </h1>
        </div>

        <div className="flex items-center gap-3 bg-surface-container-lowest px-4 py-2 rounded-full shadow-sm">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-full hover:bg-surface-container-low flex items-center justify-center"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <span className="font-title-md font-bold text-on-surface min-w-[150px] text-center">
            {THAI_MONTHS[monthIdx]} {useBuddhistEra ? year + 543 : year}
          </span>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-full hover:bg-surface-container-low flex items-center justify-center"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Category Color Legend */}
      <div className="flex items-center gap-4 flex-wrap mb-4 px-2">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center gap-1.5 font-label-sm text-on-surface">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></span>
            <span>{cat.name}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="bg-surface-container-lowest rounded-3xl p-space-lg shadow-[0_12px_32px_-8px_rgba(37,99,235,0.07)] border border-white/80">
        <div className="grid grid-cols-7 gap-2 mb-2 text-center font-label-md font-bold text-on-surface-variant">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {cells.map((day, idx) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[115px] rounded-2xl bg-surface-container-low/25"
                />
              );
            }

            const dayTasks = getTasksForDay(day);
            const isToday = year === 2026 && monthIdx === 10 && day === 19;

            return (
              <div
                key={day}
                className={`min-h-[115px] rounded-2xl p-2.5 flex flex-col justify-between transition-all border ${
                  isToday
                    ? "bg-primary-fixed/40 border-primary-container"
                    : "bg-surface-container-low/50 border-transparent hover:bg-surface-container-low"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-label-md font-bold ${
                      isToday
                        ? "bg-primary-container text-white"
                        : "text-on-surface"
                    }`}
                  >
                    {day}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="font-label-sm text-primary font-bold">
                      {dayTasks.length} งาน
                    </span>
                  )}
                </div>

                <div className="space-y-1 flex-1 overflow-y-auto">
                  {dayTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => onSelectTask(t)}
                      style={{
                        backgroundColor: `${t.category?.color || "#2563eb"}18`,
                        borderLeft: `3px solid ${t.category?.color || "#2563eb"}`,
                      }}
                      className="px-2 py-1 rounded-lg text-[12px] font-bold text-on-surface cursor-pointer hover:opacity-80 truncate flex items-center justify-between gap-1"
                      title={t.title}
                    >
                      <span className="truncate">{t.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
