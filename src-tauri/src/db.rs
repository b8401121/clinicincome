use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncomeRecord {
    pub id: i64,
    pub entry_date: String,
    pub amount: f64,
    pub category: String,
    pub payment_method: String,
    pub payer_or_patient: String,
    pub photo_filename: Option<String>,
    pub note: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategorySummary {
    pub category: String,
    pub total: f64,
    pub count: i64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentSummary {
    pub payment_method: String,
    pub total: f64,
    pub count: i64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailySummary {
    pub date: String,
    pub total: f64,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonthlySummaryData {
    pub year: i32,
    pub month: u32,
    pub month_str: String,
    pub total_amount: f64,
    pub record_count: i64,
    pub daily_average: f64,
    pub category_breakdown: Vec<CategorySummary>,
    pub payment_breakdown: Vec<PaymentSummary>,
    pub daily_breakdown: Vec<DailySummary>,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(path)?;
        let db = Database { conn };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<()> {
        self.conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS income_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_date TEXT NOT NULL,
                amount REAL NOT NULL,
                category TEXT NOT NULL,
                payment_method TEXT NOT NULL,
                payer_or_patient TEXT NOT NULL DEFAULT '',
                photo_filename TEXT,
                note TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_income_entry_date ON income_records(entry_date);
            CREATE INDEX IF NOT EXISTS idx_income_category ON income_records(category);
            ",
        )?;
        Ok(())
    }

    pub fn add_record(
        &mut self,
        entry_date: &str,
        amount: f64,
        category: &str,
        payment_method: &str,
        payer_or_patient: &str,
        photo_filename: Option<String>,
        note: &str,
    ) -> Result<IncomeRecord> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO income_records (entry_date, amount, category, payment_method, payer_or_patient, photo_filename, note, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                entry_date,
                amount,
                category,
                payment_method,
                payer_or_patient,
                photo_filename,
                note,
                now,
                now,
            ],
        )?;

        let id = self.conn.last_insert_rowid();
        Ok(IncomeRecord {
            id,
            entry_date: entry_date.to_string(),
            amount,
            category: category.to_string(),
            payment_method: payment_method.to_string(),
            payer_or_patient: payer_or_patient.to_string(),
            photo_filename,
            note: note.to_string(),
            created_at: now.clone(),
            updated_at: now,
        })
    }

    pub fn get_record(&self, id: i64) -> Result<Option<IncomeRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, entry_date, amount, category, payment_method, payer_or_patient, photo_filename, note, created_at, updated_at
             FROM income_records WHERE id = ?1",
        )?;
        let mut rows = stmt.query(params![id])?;

        if let Some(row) = rows.next()? {
            Ok(Some(IncomeRecord {
                id: row.get(0)?,
                entry_date: row.get(1)?,
                amount: row.get(2)?,
                category: row.get(3)?,
                payment_method: row.get(4)?,
                payer_or_patient: row.get(5)?,
                photo_filename: row.get(6)?,
                note: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_records(
        &self,
        month: Option<String>,
        search: Option<String>,
        category: Option<String>,
    ) -> Result<Vec<IncomeRecord>> {
        let mut query = String::from(
            "SELECT id, entry_date, amount, category, payment_method, payer_or_patient, photo_filename, note, created_at, updated_at
             FROM income_records WHERE 1=1"
        );
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(m) = month {
            if !m.is_empty() {
                query.push_str(" AND entry_date LIKE ?");
                params.push(Box::new(format!("{}%", m)));
            }
        }

        if let Some(cat) = category {
            if !cat.is_empty() && cat != "全部" {
                query.push_str(" AND category = ?");
                params.push(Box::new(cat));
            }
        }

        if let Some(s) = search {
            if !s.is_empty() {
                let term = format!("%{}%", s);
                query.push_str(" AND (note LIKE ? OR payer_or_patient LIKE ? OR category LIKE ? OR payment_method LIKE ? OR CAST(amount AS TEXT) LIKE ?)");
                params.push(Box::new(term.clone()));
                params.push(Box::new(term.clone()));
                params.push(Box::new(term.clone()));
                params.push(Box::new(term.clone()));
                params.push(Box::new(term));
            }
        }

        query.push_str(" ORDER BY entry_date DESC, id DESC");

        let mut stmt = self.conn.prepare(&query)?;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|b| b.as_ref()).collect();
        let rows = stmt.query_map(param_refs.as_slice(), |row| {
            Ok(IncomeRecord {
                id: row.get(0)?,
                entry_date: row.get(1)?,
                amount: row.get(2)?,
                category: row.get(3)?,
                payment_method: row.get(4)?,
                payer_or_patient: row.get(5)?,
                photo_filename: row.get(6)?,
                note: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        let mut records = Vec::new();
        for r in rows {
            records.push(r?);
        }
        Ok(records)
    }

    pub fn get_monthly_summary(&self, year: i32, month: u32) -> Result<MonthlySummaryData> {
        let month_str = format!("{:04}-{:02}", year, month);
        let prefix = format!("{}%", month_str);

        // 1. Total & count
        let mut stmt = self.conn.prepare(
            "SELECT COALESCE(SUM(amount), 0.0), COUNT(*) FROM income_records WHERE entry_date LIKE ?1",
        )?;
        let (total_amount, record_count): (f64, i64) =
            stmt.query_row(params![prefix], |row| Ok((row.get(0)?, row.get(1)?)))?;

        // Calculate days in this month
        let days_in_month = match month {
            1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
            4 | 6 | 9 | 11 => 30,
            2 => {
                if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) {
                    29
                } else {
                    28
                }
            }
            _ => 30,
        };
        let daily_average = if days_in_month > 0 {
            (total_amount / days_in_month as f64).round()
        } else {
            0.0
        };

        // 2. Category breakdown
        let mut cat_stmt = self.conn.prepare(
            "SELECT category, COALESCE(SUM(amount), 0.0), COUNT(*) 
             FROM income_records 
             WHERE entry_date LIKE ?1 
             GROUP BY category 
             ORDER BY SUM(amount) DESC",
        )?;
        let cat_rows = cat_stmt.query_map(params![prefix], |row| {
            let cat: String = row.get(0)?;
            let sum: f64 = row.get(1)?;
            let cnt: i64 = row.get(2)?;
            let pct = if total_amount > 0.0 {
                ((sum / total_amount) * 1000.0).round() / 10.0
            } else {
                0.0
            };
            Ok(CategorySummary {
                category: cat,
                total: sum,
                count: cnt,
                percentage: pct,
            })
        })?;

        let mut category_breakdown = Vec::new();
        for c in cat_rows {
            category_breakdown.push(c?);
        }

        // 3. Payment method breakdown
        let mut pay_stmt = self.conn.prepare(
            "SELECT payment_method, COALESCE(SUM(amount), 0.0), COUNT(*) 
             FROM income_records 
             WHERE entry_date LIKE ?1 
             GROUP BY payment_method 
             ORDER BY SUM(amount) DESC",
        )?;
        let pay_rows = pay_stmt.query_map(params![prefix], |row| {
            let method: String = row.get(0)?;
            let sum: f64 = row.get(1)?;
            let cnt: i64 = row.get(2)?;
            let pct = if total_amount > 0.0 {
                ((sum / total_amount) * 1000.0).round() / 10.0
            } else {
                0.0
            };
            Ok(PaymentSummary {
                payment_method: method,
                total: sum,
                count: cnt,
                percentage: pct,
            })
        })?;

        let mut payment_breakdown = Vec::new();
        for p in pay_rows {
            payment_breakdown.push(p?);
        }

        // 4. Daily breakdown
        let mut day_stmt = self.conn.prepare(
            "SELECT entry_date, COALESCE(SUM(amount), 0.0), COUNT(*) 
             FROM income_records 
             WHERE entry_date LIKE ?1 
             GROUP BY entry_date 
             ORDER BY entry_date ASC",
        )?;
        let day_rows = day_stmt.query_map(params![prefix], |row| {
            Ok(DailySummary {
                date: row.get(0)?,
                total: row.get(1)?,
                count: row.get(2)?,
            })
        })?;

        let mut daily_breakdown = Vec::new();
        for d in day_rows {
            daily_breakdown.push(d?);
        }

        Ok(MonthlySummaryData {
            year,
            month,
            month_str,
            total_amount,
            record_count,
            daily_average,
            category_breakdown,
            payment_breakdown,
            daily_breakdown,
        })
    }

    pub fn update_record(
        &mut self,
        id: i64,
        entry_date: &str,
        amount: f64,
        category: &str,
        payment_method: &str,
        payer_or_patient: &str,
        photo_filename: Option<String>,
        note: &str,
    ) -> Result<IncomeRecord> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE income_records 
             SET entry_date = ?1, amount = ?2, category = ?3, payment_method = ?4, payer_or_patient = ?5, photo_filename = ?6, note = ?7, updated_at = ?8
             WHERE id = ?9",
            params![
                entry_date,
                amount,
                category,
                payment_method,
                payer_or_patient,
                photo_filename,
                note,
                now,
                id,
            ],
        )?;

        let created_at = self.get_record(id)?
            .map(|r| r.created_at)
            .unwrap_or_else(|| now.clone());

        Ok(IncomeRecord {
            id,
            entry_date: entry_date.to_string(),
            amount,
            category: category.to_string(),
            payment_method: payment_method.to_string(),
            payer_or_patient: payer_or_patient.to_string(),
            photo_filename,
            note: note.to_string(),
            created_at,
            updated_at: now,
        })
    }

    pub fn delete_record(&mut self, id: i64) -> Result<Option<String>> {
        // Get photo filename if any before deleting
        let photo_file: Option<String> = self
            .conn
            .query_row(
                "SELECT photo_filename FROM income_records WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .ok()
            .flatten();

        self.conn.execute("DELETE FROM income_records WHERE id = ?1", params![id])?;
        Ok(photo_file)
    }

    pub fn export_csv(&self, month: &str) -> Result<String> {
        let records = self.get_records(Some(month.to_string()), None, None)?;
        let mut csv = String::from("\u{FEFF}入賬日期,實領金額(NTD),薪資項目,入帳方式,發薪診所/醫療院所,備註說明,薪資條/存摺相片\n");
        for r in records {

            let has_photo = if r.photo_filename.is_some() { "有" } else { "無" };
            let safe_patient = r.payer_or_patient.replace('"', "\"\"");
            let safe_note = r.note.replace('"', "\"\"");
            csv.push_str(&format!(
                "\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\"\n",
                r.entry_date, r.amount, r.category, r.payment_method, safe_patient, safe_note, has_photo
            ));
        }
        Ok(csv)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_crud_and_monthly_summary() {
        // Use in-memory SQLite database for testing
        let mut db = Database::new(":memory:").expect("Failed to create in-memory db");

        // 1. Add records
        let r1 = db.add_record(
            "2026-09-01",
            3000.0,
            "掛號費",
            "現金",
            "王先生",
            None,
            "門診掛號",
        ).unwrap();
        assert_eq!(r1.amount, 3000.0);

        let r2 = db.add_record(
            "2026-09-05",
            12000.0,
            "自費門診",
            "信用卡",
            "李小姐",
            Some("receipt_01.jpg".to_string()),
            "微整型療程",
        ).unwrap();
        assert_eq!(r2.amount, 12000.0);

        // Different month record (should not count in 2026-09)
        let _r3 = db.add_record(
            "2026-08-20",
            5000.0,
            "掛號費",
            "現金",
            "趙小姐",
            None,
            "上月明細",
        ).unwrap();

        // 2. Test get_records for 2026-09
        let recs_sep = db.get_records(Some("2026-09".to_string()), None, None).unwrap();
        assert_eq!(recs_sep.len(), 2);

        // 3. Test monthly summary for 2026-09
        let summary = db.get_monthly_summary(2026, 9).unwrap();
        assert_eq!(summary.total_amount, 15000.0);
        assert_eq!(summary.record_count, 2);
        assert_eq!(summary.daily_average, 500.0); // 15000 / 30 days = 500
        assert_eq!(summary.category_breakdown.len(), 2);
        assert_eq!(summary.payment_breakdown.len(), 2);

        // 4. Test Update
        let updated = db.update_record(
            r1.id,
            "2026-09-02",
            3500.0,
            "掛號費",
            "現金",
            "王先生",
            None,
            "調整掛號費",
        ).unwrap();
        assert_eq!(updated.amount, 3500.0);

        let new_summary = db.get_monthly_summary(2026, 9).unwrap();
        assert_eq!(new_summary.total_amount, 15500.0);

        // 5. Test Delete
        let deleted_photo = db.delete_record(r2.id).unwrap();
        assert_eq!(deleted_photo, Some("receipt_01.jpg".to_string()));

        let after_delete = db.get_monthly_summary(2026, 9).unwrap();
        assert_eq!(after_delete.total_amount, 3500.0);
        assert_eq!(after_delete.record_count, 1);

        // 6. Test CSV Export
        let csv = db.export_csv("2026-09").unwrap();
        assert!(csv.contains("入賬日期"));
        assert!(csv.contains("3500"));
    }
}

