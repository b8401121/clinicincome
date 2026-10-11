import React from "react";
import { MonthlySummaryData } from "../types";
import { DollarSign, FileText, TrendingUp, CreditCard, PieChart } from "lucide-react";

interface MonthlySummaryProps {
  summary: MonthlySummaryData | null;
  loading?: boolean;
}

export const MonthlySummary: React.FC<MonthlySummaryProps> = ({ summary, loading }) => {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-white rounded-2xl p-5 border border-slate-200 animate-pulse" />
        ))}
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getCategoryColor = (index: number) => {
    const colors = [
      "bg-teal-500 text-teal-600",
      "bg-emerald-500 text-emerald-600",
      "bg-blue-500 text-blue-600",
      "bg-indigo-500 text-indigo-600",
      "bg-amber-500 text-amber-600",
      "bg-rose-500 text-rose-600",
      "bg-slate-500 text-slate-600",
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-6 mb-6">
      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Total Income */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm relative overflow-hidden flex items-center justify-between">
          <div>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {summary.month_str} 當月醫師總收入
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-1 tracking-tight">
              {formatCurrency(summary.total_amount)}
            </div>
            <p className="text-[11px] sm:text-xs text-teal-600 font-medium mt-1">
              各診所實撥薪資入帳總額
            </p>
          </div>
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 flex-shrink-0">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-teal-500/5 rounded-full pointer-events-none" />
        </div>

        {/* Record Count */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm relative overflow-hidden flex items-center justify-between">
          <div>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
              診所撥薪筆數
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-1 tracking-tight">
              {summary.record_count} <span className="text-sm font-normal text-slate-400">次撥款</span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1">
              已確認入帳薪資/診費明細
            </p>
          </div>
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-blue-500/5 rounded-full pointer-events-none" />
        </div>

        {/* Daily Average */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm relative overflow-hidden flex items-center justify-between sm:col-span-2 lg:col-span-1">
          <div>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
              日均折合所得
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-1 tracking-tight">
              {formatCurrency(summary.daily_average)}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1">
              以當月天數均攤
            </p>
          </div>
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-500/5 rounded-full pointer-events-none" />
        </div>
      </div>

      {/* Breakdown Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category Breakdown */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-800">薪資項目分佈 (底薪/PPF/值班等)</h3>
            </div>
            <span className="text-xs text-slate-400">共 {summary.category_breakdown.length} 個項目</span>
          </div>

          {summary.category_breakdown.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">本月尚無薪資數據</div>
          ) : (
            <div className="space-y-3">
              {summary.category_breakdown.map((cat, idx) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${getCategoryColor(idx).split(" ")[0]}`} />
                      {cat.category}
                      <span className="text-slate-400 font-normal">({cat.count} 筆)</span>
                    </span>
                    <span className="font-semibold text-slate-800">
                      {formatCurrency(cat.total)} ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${getCategoryColor(idx).split(" ")[0]}`}
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Method Breakdown */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-800">撥款入帳方式分佈</h3>
            </div>
            <span className="text-xs text-slate-400">共 {summary.payment_breakdown.length} 種方式</span>
          </div>


          {summary.payment_breakdown.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">本月尚無收款方式數據</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {summary.payment_breakdown.map((pay) => (
                <div
                  key={pay.payment_method}
                  className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{pay.payment_method}</span>
                    <span className="px-1.5 py-0.5 rounded bg-white text-slate-500 text-[10px] font-medium border border-slate-200">
                      {pay.percentage}%
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-bold text-slate-800">
                    {formatCurrency(pay.total)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {pay.count} 筆收款
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
