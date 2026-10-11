import React, { useState, useEffect } from "react";
import { IncomeRecord, DEFAULT_CATEGORIES } from "../types";
import { api } from "../lib/tauri";
import {
  Search,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Receipt,
  Filter,
} from "lucide-react";

interface RecordListProps {
  records: IncomeRecord[];
  loading: boolean;
  onEdit: (record: IncomeRecord) => void;
  onDelete: (id: number) => void;
  onViewPhoto: (photoUrl: string, title: string) => void;
  onAddClick: () => void;
}

export const RecordList: React.FC<RecordListProps> = ({
  records,
  loading,
  onEdit,
  onDelete,
  onViewPhoto,
  onAddClick,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [photoCache, setPhotoCache] = useState<Record<string, string>>({});

  // Load photos for records that have photo_filename
  useEffect(() => {
    records.forEach((r) => {
      if (r.photo_filename && !photoCache[r.photo_filename]) {
        api.getPhotoData(r.photo_filename).then((data) => {
          if (data) {
            setPhotoCache((prev) => ({ ...prev, [r.photo_filename!]: data }));
          }
        });
      }
    });
  }, [records]);

  // Filter records
  const filteredRecords = records.filter((r) => {
    const matchesCategory =
      selectedCategory === "全部" || r.category === selectedCategory;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      r.note.toLowerCase().includes(term) ||
      r.payer_or_patient.toLowerCase().includes(term) ||
      r.category.toLowerCase().includes(term) ||
      r.payment_method.toLowerCase().includes(term) ||
      r.amount.toString().includes(term) ||
      r.entry_date.includes(term);

    return matchesCategory && matchesSearch;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case "保障底薪":
        return "bg-teal-50 text-teal-700 border-teal-200";
      case "PPF績效抽成":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "門診診費/牌費":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "值班/支援費":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "處置/手術費":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "三節/年終獎金":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Search and Filters Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="搜尋發薪診所、薪資項目、備註說明或金額..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1 flex-shrink-0" />
          {["全部", ...DEFAULT_CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                selectedCategory === cat
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table Area */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">
          載入明細中...
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="p-12 text-center">
          <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-700">查無薪資紀錄</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm || selectedCategory !== "全部"
              ? "嘗試變更篩選條件或清除搜尋關鍵字"
              : "本月尚未建立診所發薪紀錄，請點擊上方按鈕新增第一筆薪資入帳"}
          </p>
          {!searchTerm && selectedCategory === "全部" && (
            <button
              onClick={onAddClick}
              className="mt-4 px-4 py-2 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-xl transition-colors"
            >
              + 立即新增薪資入帳
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile Card View (screens < md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredRecords.map((record) => {
              const photoUrl = record.photo_filename
                ? photoCache[record.photo_filename]
                : null;

              return (
                <div key={record.id} className="p-3.5 space-y-2.5 hover:bg-slate-50/60 transition-colors">
                  {/* Top row: Date, Clinic, and Amount */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
                        <span className="font-bold text-slate-800 text-sm">
                          {record.payer_or_patient || "未填寫診所"}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-400 block pl-3.5">
                        {record.entry_date}
                      </span>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-base font-extrabold text-teal-800 tracking-tight">
                        {formatCurrency(record.amount)}
                      </div>
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-medium">
                        {record.payment_method}
                      </span>
                    </div>
                  </div>

                  {/* Middle row: Category badge & Notes */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-md border ${getCategoryBadgeClass(
                        record.category
                      )}`}
                    >
                      {record.category}
                    </span>
                    {record.note && (
                      <span className="text-xs text-slate-600 line-clamp-1 flex-1">
                        {record.note}
                      </span>
                    )}
                  </div>

                  {/* Bottom row: Thumbnail and Action buttons */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                    <div>
                      {photoUrl ? (
                        <button
                          onClick={() =>
                            onViewPhoto(
                              photoUrl,
                              `${record.entry_date} - ${record.payer_or_patient} [${record.category}] (NT$ ${record.amount})`
                            )
                          }
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-700 bg-teal-50/80 hover:bg-teal-100 px-2.5 py-1 rounded-lg transition-colors border border-teal-200/60"
                        >
                          <img
                            src={photoUrl}
                            alt="Slip preview"
                            className="w-4 h-4 object-cover rounded flex-shrink-0"
                          />
                          <span>檢視薪資單憑證</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-300">無照片憑證</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEdit(record)}
                        className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                        title="編輯此筆"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `確定要刪除 ${record.entry_date} [${record.payer_or_patient} - ${record.category}] NT$ ${record.amount} 的紀錄嗎？`
                            )
                          ) {
                            onDelete(record.id);
                          }
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="刪除此筆"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (screens >= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3 px-4">入賬日期</th>
                  <th className="py-3 px-4">發薪診所 / 醫療院所</th>
                  <th className="py-3 px-4">薪資項目</th>
                  <th className="py-3 px-4 text-right">實領金額 (NTD)</th>
                  <th className="py-3 px-4">入帳方式</th>
                  <th className="py-3 px-4">明細與節數備註</th>
                  <th className="py-3 px-4 text-center">薪資條 / 存摺</th>
                  <th className="py-3 px-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredRecords.map((record) => {
                  const photoUrl = record.photo_filename
                    ? photoCache[record.photo_filename]
                    : null;

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Date */}
                      <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                        {record.entry_date}
                      </td>

                      {/* Clinic Name */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
                          <span className="w-2 h-2 rounded-full bg-teal-500" />
                          {record.payer_or_patient || "未填寫診所"}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getCategoryBadgeClass(
                            record.category
                          )}`}
                        >
                          {record.category}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right font-extrabold text-teal-800 text-sm whitespace-nowrap">
                        {formatCurrency(record.amount)}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 text-slate-700">
                          {record.payment_method}
                        </span>
                      </td>

                      {/* Note */}
                      <td className="py-3.5 px-4 text-slate-600 max-w-[220px] truncate">
                        {record.note || "—"}
                      </td>

                      {/* Photo thumbnail */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {photoUrl ? (
                          <button
                            onClick={() =>
                              onViewPhoto(
                                photoUrl,
                                `${record.entry_date} - ${record.payer_or_patient} [${record.category}] (NT$ ${record.amount})`
                              )
                            }
                            className="relative inline-block group/img focus:outline-none"
                            title="點擊放大查看薪資條/存摺截圖"
                          >
                            <img
                              src={photoUrl}
                              alt="Salary slip"
                              className="w-9 h-9 object-cover rounded-lg border border-slate-200 shadow-sm hover:scale-110 transition-transform cursor-zoom-in"
                            />
                            <span className="absolute -top-1 -right-1 flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                            </span>
                          </button>
                        ) : record.photo_filename ? (
                          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                            <ImageIcon className="w-4 h-4 animate-pulse" />
                          </div>
                        ) : (
                          <span className="text-slate-300 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => onEdit(record)}
                            className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                            title="編輯此筆"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `確定要刪除 ${record.entry_date} [${record.payer_or_patient} - ${record.category}] NT$ ${record.amount} 的紀錄嗎？`
                                )
                              ) {
                                onDelete(record.id);
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="刪除此筆"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}


      {/* Table Footer / Summary */}
      <div className="p-3.5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
        <div>
          共顯示 <span className="font-semibold text-slate-700">{filteredRecords.length}</span> 筆符合明細
        </div>
        <div className="font-semibold text-slate-700">
          合計：{" "}
          <span className="text-teal-700 font-bold text-sm">
            {formatCurrency(
              filteredRecords.reduce((acc, cur) => acc + cur.amount, 0)
            )}
          </span>
        </div>
      </div>
    </div>
  );
};
