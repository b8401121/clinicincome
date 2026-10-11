import React, { useState, useEffect, useRef } from "react";
import {
  IncomeRecord,
  CreateRecordInput,
  UpdateRecordInput,
  DEFAULT_CATEGORIES,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_CLINIC_NAME,
} from "../types";
import { api } from "../lib/tauri";
import { X, Upload, Image as ImageIcon, Trash2, Calendar, DollarSign, Tag, CreditCard, User, AlignLeft } from "lucide-react";

interface RecordFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  recordToEdit?: IncomeRecord | null;
  defaultDate?: string;
}

export const RecordFormModal: React.FC<RecordFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  recordToEdit,
  defaultDate,
}) => {
  const [entryDate, setEntryDate] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [paymentMethod, setPaymentMethod] = useState(DEFAULT_PAYMENT_METHODS[0]);
  const [payerOrPatient, setPayerOrPatient] = useState(DEFAULT_CLINIC_NAME);
  const [note, setNote] = useState("");

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoExt, setPhotoExt] = useState<string>("png");
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form state
  useEffect(() => {
    if (recordToEdit) {
      setEntryDate(recordToEdit.entry_date);
      setAmount(recordToEdit.amount.toString());
      setCategory(recordToEdit.category);
      setPaymentMethod(recordToEdit.payment_method);
      setPayerOrPatient(recordToEdit.payer_or_patient || "");
      setNote(recordToEdit.note || "");
      setRemoveExistingPhoto(false);
      setPhotoBase64(null);

      if (recordToEdit.photo_filename) {
        // Load photo data
        api.getPhotoData(recordToEdit.photo_filename).then((data) => {
          if (data) {
            setPhotoPreview(data);
          }
        });
      } else {
        setPhotoPreview(null);
      }
    } else {
      const today = defaultDate || new Date().toISOString().split("T")[0];
      setEntryDate(today);
      setAmount("");
      setCategory(DEFAULT_CATEGORIES[0]);
      setPaymentMethod(DEFAULT_PAYMENT_METHODS[0]);
      setPayerOrPatient(DEFAULT_CLINIC_NAME);
      setNote("");
      setPhotoPreview(null);
      setPhotoBase64(null);
      setRemoveExistingPhoto(false);
    }
    setErrorMsg("");
  }, [recordToEdit, defaultDate, isOpen]);

  // Handle image file selection
  const processImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("請選擇有效的圖片檔案 (JPG, PNG, WebP)");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    setPhotoExt(ext);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPhotoPreview(result);
      setPhotoBase64(result);
      setRemoveExistingPhoto(false);
      setErrorMsg("");
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // Support pasting image from clipboard
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processImageFile(file);
          break;
        }
      }
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoBase64(null);
    setRemoveExistingPhoto(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg("請輸入大於 0 的有效金額");
      return;
    }
    if (!entryDate) {
      setErrorMsg("請選擇入賬日期");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg("");

      if (recordToEdit) {
        const updateInput: UpdateRecordInput = {
          id: recordToEdit.id,
          entry_date: entryDate,
          amount: numAmount,
          category,
          payment_method: paymentMethod,
          payer_or_patient: payerOrPatient.trim(),
          note: note.trim(),
          photo_base64: photoBase64,
          remove_photo: removeExistingPhoto,
        };
        await api.updateRecord(updateInput);
      } else {
        const createInput: CreateRecordInput = {
          entry_date: entryDate,
          amount: numAmount,
          category,
          payment_method: paymentMethod,
          payer_or_patient: payerOrPatient.trim(),
          note: note.trim(),
          photo_base64: photoBase64,
          photo_ext: photoExt,
        };
        await api.addRecord(createInput);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "儲存失敗，請檢查輸入資料");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      onPaste={handlePaste}
    >
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {recordToEdit ? "編輯醫師薪資紀錄" : "新增醫師薪資收入"}
            </h2>
            <p className="text-xs text-slate-500">
              記錄各診所發放之底薪、診費、PPF業績提成或值班支援費
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* Date & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                入賬日期 <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-teal-600" />
                實領入賬金額 (NTD) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="1"
                min="1"
                required
                placeholder="例如: 160000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-bold text-slate-800 text-right tracking-wide"
              />
            </div>
          </div>

          {/* Clinic Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-teal-600" />
              發薪診所 / 醫療院所名稱 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="例如：大安安康診所、仁愛專科診所、博愛醫院支援"
              value={payerOrPatient}
              onChange={(e) => setPayerOrPatient(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-slate-800 font-medium"
            />
          </div>

          {/* Category Quick Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-teal-600" />
              薪資項目類別
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                    category === cat
                      ? "bg-teal-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method Quick Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-teal-600" />
              撥款入帳方式
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_PAYMENT_METHODS.map((method) => (
                <button
                  type="button"
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                    paymentMethod === method
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <AlignLeft className="w-3.5 h-3.5 text-teal-600" />
              備註說明 (選填)
            </label>
            <textarea
              rows={2}
              placeholder="例如：門診總節數、PPF自費提成細目、扣除勞健保或預扣所得稅等..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-slate-800 resize-none"
            />
          </div>

          {/* Photo / Receipt Attachment */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-teal-600" />
                薪資條 / 存摺 / 網銀明細相片憑證
              </span>
              <span className="text-[11px] text-slate-400">
                可點選上傳或直接以 Ctrl+V 貼上截圖
              </span>
            </label>


            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {photoPreview ? (
              <div className="relative group rounded-xl border border-slate-200 overflow-hidden bg-slate-900/5 p-2 flex items-center justify-between">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <img
                    src={photoPreview}
                    alt="Receipt preview"
                    className="w-14 h-14 object-cover rounded-lg border border-white shadow-sm flex-shrink-0"
                  />
                  <div className="text-xs truncate">
                    <p className="font-semibold text-slate-800">已選取憑證照片</p>
                    <p className="text-slate-400">儲存時將自動同步至本地專屬資料庫</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-xs text-teal-700 hover:bg-teal-50 rounded-lg transition-colors font-medium"
                  >
                    更換
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="移除照片"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-teal-400 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-teal-50/20"
              >
                <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-700">
                  點擊上傳憑證相片 或 拖曳至此處
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  支援 JPG, PNG, WebP（亦可直接剪貼簿貼上截圖）
                </p>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 rounded-xl shadow-md shadow-teal-600/20 transition-all disabled:opacity-50"
            >
              {submitting ? "處理中..." : recordToEdit ? "更新紀錄" : "儲存入帳"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
