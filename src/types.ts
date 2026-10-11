export interface IncomeRecord {
  id: number;
  entry_date: string;       // YYYY-MM-DD
  amount: number;           // NTD (實領/入帳金額)
  category: string;         // 保障底薪, 門診診費/牌費, PPF績效抽成, 值班/支援費, 處置/手術費, 獎金/年終, 其他
  payment_method: string;   // 銀行薪轉, 現金, 支票, 其他
  payer_or_patient: string; // 發薪診所 / 醫療院所名稱 (如: 仁愛診所、大安醫療院所)
  photo_filename: string | null; // 薪資條 / 存摺 / 網銀明細相片
  note: string;
  created_at: string;
  updated_at: string;
}

export interface CategorySummary {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

export interface PaymentSummary {
  payment_method: string;
  total: number;
  count: number;
  percentage: number;
}

export interface DailySummary {
  date: string;
  total: number;
  count: number;
}

export interface MonthlySummaryData {
  year: number;
  month: number;
  month_str: string;         // "2026-09"
  total_amount: number;
  record_count: number;
  daily_average: number;
  category_breakdown: CategorySummary[];
  payment_breakdown: PaymentSummary[];
  daily_breakdown: DailySummary[];
}

export interface CreateRecordInput {
  entry_date: string;
  amount: number;
  category: string;
  payment_method: string;
  payer_or_patient?: string; // 診所/院所名稱
  note?: string;
  photo_base64?: string | null;
  photo_ext?: string | null;
}

export interface UpdateRecordInput {
  id: number;
  entry_date: string;
  amount: number;
  category: string;
  payment_method: string;
  payer_or_patient?: string;
  note?: string;
  photo_base64?: string | null;
  remove_photo?: boolean;
}

export const DEFAULT_CATEGORIES = [
  "保障底薪",
  "門診診費/牌費",
  "PPF績效抽成",
  "值班/支援費",
  "處置/手術費",
  "三節/年終獎金",
  "其他補貼/加給"
];

export const DEFAULT_PAYMENT_METHODS = [
  "銀行匯款/薪轉",
  "現金發放",
  "支票",
  "其他帳戶"
];

export const DEFAULT_CLINIC_NAME = "吳鎮宇親子耳鼻喉科診所";


