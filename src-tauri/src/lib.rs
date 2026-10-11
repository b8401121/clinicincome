pub mod commands;
pub mod db;

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub db: Mutex<db::Database>,
    pub photos_dir: PathBuf,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Get user app data directory
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("無法取得應用程式專屬資料目錄");
            
            std::fs::create_dir_all(&app_data_dir)
                .expect("無法建立應用程式資料目錄");

            let photos_dir = app_data_dir.join("receipt_photos");
            std::fs::create_dir_all(&photos_dir)
                .expect("無法建立憑證照片儲存目錄");

            let db_path = app_data_dir.join("clinic_income.db");
            let database = db::Database::new(&db_path)
                .expect("無法初始化 SQLite 資料庫");

            app.manage(AppState {
                db: Mutex::new(database),
                photos_dir,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_monthly_summary,
            commands::get_records,
            commands::add_record,
            commands::update_record,
            commands::delete_record,
            commands::get_photo_data,
            commands::export_csv,
        ])
        .run(tauri::generate_context!())
        .expect("執行 Tauri 應用程式時發生錯誤");
}
