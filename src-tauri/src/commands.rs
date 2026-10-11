use crate::db::{IncomeRecord, MonthlySummaryData};
use crate::AppState;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::Deserialize;
use std::fs;
use std::path::PathBuf;
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateRecordDto {
    pub entry_date: String,
    pub amount: f64,
    pub category: String,
    pub payment_method: String,
    pub payer_or_patient: Option<String>,
    pub note: Option<String>,
    pub photo_base64: Option<String>,
    pub photo_ext: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRecordDto {
    pub id: i64,
    pub entry_date: String,
    pub amount: f64,
    pub category: String,
    pub payment_method: String,
    pub payer_or_patient: Option<String>,
    pub note: Option<String>,
    pub photo_base64: Option<String>,
    pub remove_photo: Option<bool>,
}

#[tauri::command]
pub fn get_monthly_summary(
    state: State<'_, AppState>,
    year: i32,
    month: u32,
) -> Result<MonthlySummaryData, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_monthly_summary(year, month).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_records(
    state: State<'_, AppState>,
    month: Option<String>,
    search: Option<String>,
    category: Option<String>,
) -> Result<Vec<IncomeRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_records(month, search, category).map_err(|e| e.to_string())
}

fn save_base64_photo(photos_dir: &PathBuf, base64_str: &str, ext: &str) -> Result<String, String> {
    // Strip data URL prefix if present (e.g. "data:image/png;base64,")
    let raw_b64 = if let Some(idx) = base64_str.find(";base64,") {
        &base64_str[idx + 8..]
    } else {
        base64_str
    };

    let bytes = BASE64.decode(raw_b64).map_err(|e| format!("Base64 解碼失敗: {}", e))?;
    let safe_ext = match ext.to_lowercase().as_str() {
        "jpg" | "jpeg" => "jpg",
        "png" => "png",
        "webp" => "webp",
        _ => "png",
    };
    let filename = format!("{}.{}", Uuid::new_v4(), safe_ext);
    let target_path = photos_dir.join(&filename);

    fs::write(&target_path, bytes).map_err(|e| format!("儲存照片檔案失敗: {}", e))?;
    Ok(filename)
}

#[tauri::command]
pub fn add_record(
    state: State<'_, AppState>,
    input: CreateRecordDto,
) -> Result<IncomeRecord, String> {
    let mut photo_filename = None;
    if let Some(ref b64) = input.photo_base64 {
        if !b64.trim().is_empty() {
            let ext = input.photo_ext.as_deref().unwrap_or("png");
            let saved_name = save_base64_photo(&state.photos_dir, b64, ext)?;
            photo_filename = Some(saved_name);
        }
    }

    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    db.add_record(
        &input.entry_date,
        input.amount,
        &input.category,
        &input.payment_method,
        input.payer_or_patient.as_deref().unwrap_or(""),
        photo_filename,
        input.note.as_deref().unwrap_or(""),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_record(
    state: State<'_, AppState>,
    input: UpdateRecordDto,
) -> Result<IncomeRecord, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;

    // Check existing record
    let existing = db.get_record(input.id).map_err(|e| e.to_string())?
        .ok_or_else(|| "找不到指定的記錄".to_string())?;

    let mut photo_filename = existing.photo_filename;

    // Handle photo removal
    if input.remove_photo.unwrap_or(false) {
        if let Some(ref old_file) = photo_filename {
            let path = state.photos_dir.join(old_file);
            let _ = fs::remove_file(path);
        }
        photo_filename = None;
    }

    // Handle new photo
    if let Some(ref b64) = input.photo_base64 {
        if !b64.trim().is_empty() {
            // Remove old file if present
            if let Some(ref old_file) = photo_filename {
                let path = state.photos_dir.join(old_file);
                let _ = fs::remove_file(path);
            }
            let saved_name = save_base64_photo(&state.photos_dir, b64, "png")?;
            photo_filename = Some(saved_name);
        }
    }

    db.update_record(
        input.id,
        &input.entry_date,
        input.amount,
        &input.category,
        &input.payment_method,
        input.payer_or_patient.as_deref().unwrap_or(""),
        photo_filename,
        input.note.as_deref().unwrap_or(""),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_record(state: State<'_, AppState>, id: i64) -> Result<bool, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    let photo_file = db.delete_record(id).map_err(|e| e.to_string())?;
    if let Some(filename) = photo_file {
        let path = state.photos_dir.join(filename);
        let _ = fs::remove_file(path);
    }
    Ok(true)
}

#[tauri::command]
pub fn get_photo_data(
    state: State<'_, AppState>,
    filename: String,
) -> Result<Option<String>, String> {
    // Sanitize filename to prevent directory traversal
    let safe_filename = match std::path::Path::new(&filename).file_name() {
        Some(name) => name.to_string_lossy().to_string(),
        None => return Ok(None),
    };

    let path = state.photos_dir.join(safe_filename);
    if !path.exists() {
        return Ok(None);
    }

    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("png");
    let mime = match ext.to_lowercase().as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        _ => "image/png",
    };

    let b64 = BASE64.encode(bytes);
    Ok(Some(format!("data:{};base64,{}", mime, b64)))
}

#[tauri::command]
pub fn export_csv(state: State<'_, AppState>, month: String) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.export_csv(&month).map_err(|e| e.to_string())
}
