import React from "react";
import { User } from "firebase/auth";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Plus,
  FileSpreadsheet,
  Lock,
  Shield,
  Cloud,
} from "lucide-react";


interface HeaderProps {
  currentYear: number;
  currentMonth: number;
  onMonthChange: (year: number, month: number) => void;
  onOpenAddModal: () => void;
  onExportCsv: () => void;
  currentUser: User | null;
  onLockVault: () => void;
  onOpenSecurityModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentYear,
  currentMonth,
  onMonthChange,
  onOpenAddModal,
  onExportCsv,
  currentUser,
  onLockVault,
  onOpenSecurityModal,
}) => {
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      onMonthChange(currentYear - 1, 12);
    } else {
      onMonthChange(currentYear, currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      onMonthChange(currentYear + 1, 1);
    } else {
      onMonthChange(currentYear, currentMonth + 1);
    }
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    onMonthChange(now.getFullYear(), now.getMonth() + 1);
  };

  const monthStr = `${currentYear}年 ${String(currentMonth).padStart(2, "0")}月`;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20 flex-shrink-0">
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-base sm:text-lg lg:text-xl font-bold text-slate-800 tracking-tight">
                受雇醫師收入記帳
              </h1>
              <span className="text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                AES-256 加密
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500">
              <span className="hidden sm:inline">診所薪資、PPF抽成與支援診費</span>
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                <Cloud className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                {currentUser ? "雲端已同步" : "本地加密"}
              </span>
            </div>
          </div>
        </div>

        {/* Month Selector */}
        <div className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-xl border border-slate-200 order-3 sm:order-2">
          <button
            onClick={handlePrevMonth}
            className="p-1 sm:p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors shadow-sm"
            title="上個月"
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <div className="flex items-center px-2 sm:px-3 gap-1 sm:gap-1.5 text-xs sm:text-sm font-semibold text-slate-800 select-none">
            <Calendar className="w-3.5 h-3.5 text-teal-600 hidden xs:inline" />
            <span>{monthStr}</span>
          </div>

          <button
            onClick={handleNextMonth}
            className="p-1 sm:p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors shadow-sm"
            title="下個月"
          >
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={handleCurrentMonth}
            className="ml-0.5 sm:ml-1 text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-slate-600 hover:text-teal-700 hover:bg-teal-50 transition-colors font-medium"
          >
            今月
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 order-2 sm:order-3">
          {/* Security & Lock buttons */}
          <button
            onClick={onOpenSecurityModal}
            className="p-1.5 sm:p-2 text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded-xl border border-slate-200 bg-white transition-colors"
            title="安全與隱私設定 (變更密碼 / 備份 / 匯入)"
          >
            <Shield className="w-4 h-4" />
          </button>

          <button
            onClick={onLockVault}
            className="p-1.5 sm:p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 bg-white transition-colors"
            title="立即上鎖記帳簿"
          >
            <Lock className="w-4 h-4" />
          </button>

          {/* Export CSV button */}
          <button
            onClick={onExportCsv}
            className="inline-flex items-center gap-1 p-1.5 sm:px-3 sm:py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
            title="匯出報表 CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden md:inline">匯出報表</span>
          </button>

          {/* Add Income button */}
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-white bg-gradient-to-r from-teal-600 to-teal-500 rounded-xl hover:from-teal-700 hover:to-teal-600 shadow-md shadow-teal-600/25 transition-all transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>新增收入</span>
          </button>
        </div>
      </div>
    </header>
  );
};
