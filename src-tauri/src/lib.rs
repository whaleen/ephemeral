use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem, Submenu, PredefinedMenuItem};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use serde::{Deserialize, Serialize};

#[derive(Default)]
pub struct ExportDirectory(Mutex<Option<PathBuf>>);

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WindowGeometry {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Debug, Clone, Serialize)]
struct OpenedFile {
    path: String,
    contents: String,
}

#[derive(Default)]
pub struct PendingOpenFile(Mutex<Option<OpenedFile>>);

#[tauri::command]
async fn save_file(export_dir: State<'_, ExportDirectory>, filename: String, content: String) -> Result<String, String> {
    let dir = export_dir.0.lock().unwrap();
    let export_path = dir.as_ref().ok_or("No export directory selected")?;
    let unique_filename = get_unique_filename(export_path, &filename)?;
    let full_path = export_path.join(&unique_filename);
    fs::write(&full_path, content).map_err(|e| e.to_string())?;
    Ok(full_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn select_export_directory(_app: tauri::AppHandle) -> Result<Option<String>, String> {
    if let Some(docs_dir) = dirs::document_dir() {
        Ok(Some(docs_dir.to_string_lossy().to_string()))
    } else {
        Ok(Some("/tmp".to_string()))
    }
}

#[tauri::command]
async fn set_export_directory(export_dir: State<'_, ExportDirectory>, path: String) -> Result<(), String> {
    let mut dir = export_dir.0.lock().unwrap();
    *dir = Some(PathBuf::from(path));
    Ok(())
}

#[tauri::command]
async fn get_export_directory(export_dir: State<'_, ExportDirectory>) -> Result<String, String> {
    let dir = export_dir.0.lock().unwrap();
    match dir.as_ref() {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => {
            if let Some(docs_dir) = dirs::document_dir() {
                Ok(docs_dir.to_string_lossy().to_string())
            } else {
                Err("Unable to determine default export directory".to_string())
            }
        }
    }
}

#[tauri::command]
async fn show_item_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").args(["-R", &path]).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer").args(["/select,", &path]).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(std::path::Path::new(&path).parent().unwrap_or(std::path::Path::new("/"))).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn check_file_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}

#[tauri::command]
async fn read_file(path: String) -> Result<OpenedFile, String> {
    read_opened_file(PathBuf::from(path))
}

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<String, String> {
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(path)
}

#[tauri::command]
async fn consume_pending_open_file(pending: State<'_, PendingOpenFile>) -> Result<Option<OpenedFile>, String> {
    Ok(pending.0.lock().unwrap().take())
}

#[tauri::command]
async fn create_window(app: AppHandle) -> Result<(), String> {
    create_window_internal(&app)
}

#[tauri::command]
async fn quit_app(app: AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

fn read_opened_file(path: PathBuf) -> Result<OpenedFile, String> {
    let contents = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(OpenedFile {
        path: path.to_string_lossy().to_string(),
        contents,
    })
}

fn get_unique_filename(directory: &Path, filename: &str) -> Result<String, String> {
    let path = Path::new(filename);
    let stem = path.file_stem().unwrap_or_default().to_string_lossy();
    let extension = path.extension().map(|ext| format!(".{}", ext.to_string_lossy())).unwrap_or_default();
    let mut final_path = directory.join(filename);
    let mut counter = 1;
    while final_path.exists() {
        let new_name = format!("{} ({}){}", stem, counter, extension);
        final_path = directory.join(&new_name);
        counter += 1;
    }
    Ok(final_path.file_name().unwrap().to_string_lossy().to_string())
}

fn create_window_internal(app: &AppHandle) -> Result<(), String> {
    let geometry = load_window_geometry(app);
    // Unique ID based on nanoseconds to avoid macOS name-clash beeps
    let label = format!("w{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());

    let mut builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App("/".into()))
        .title("Ephemeral")
        .min_inner_size(400.0, 300.0)
        .decorations(true);

    // Overlay title bar is a macOS-only API; Linux/Windows use plain decorations
    #[cfg(target_os = "macos")]
    {
        builder = builder
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true);
    }

    if let Some(geometry) = geometry {
        builder = builder.inner_size(geometry.width as f64, geometry.height as f64).position(geometry.x as f64, geometry.y as f64);
    } else {
        builder = builder.inner_size(800.0, 600.0).center();
    }

    builder.build().map_err(|e| e.to_string())?;

    Ok(())
}

fn window_geometry_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("window-geometry.json"))
}

fn load_window_geometry(app: &AppHandle) -> Option<WindowGeometry> {
    let path = window_geometry_path(app).ok()?;
    let contents = fs::read_to_string(path).ok()?;
    serde_json::from_str(&contents).ok()
}

fn save_window_geometry(app: &AppHandle, geometry: &WindowGeometry) -> Result<(), String> {
    let path = window_geometry_path(app)?;
    let contents = serde_json::to_string(geometry).map_err(|e| e.to_string())?;
    fs::write(path, contents).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ExportDirectory::default())
        .manage(PendingOpenFile::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.app_handle();
            
            // App Menu
            let app_menu = Submenu::with_items(handle, "Ephemeral", true, &[
                &PredefinedMenuItem::about(handle, None, None)?,
                &PredefinedMenuItem::separator(handle)?,
                &PredefinedMenuItem::services(handle, None)?,
                &PredefinedMenuItem::separator(handle)?,
                &PredefinedMenuItem::hide(handle, None)?,
                &PredefinedMenuItem::hide_others(handle, None)?,
                &PredefinedMenuItem::show_all(handle, None)?,
                &PredefinedMenuItem::separator(handle)?,
                &PredefinedMenuItem::quit(handle, None)?,
            ])?;

            let new_window = MenuItem::with_id(handle, "new_window", "New Window", true, Some("CmdOrCtrl+N"))?;
            let close_quit = MenuItem::with_id(handle, "close_quit", "Close", true, Some("CmdOrCtrl+W"))?;
            let quit = MenuItem::with_id(handle, "quit", "Quit Ephemeral", true, Some("CmdOrCtrl+Q"))?;
            let file_menu = Submenu::with_items(handle, "File", true, &[&new_window, &close_quit, &quit])?;

            // Edit Menu
            let edit_menu = Submenu::with_items(handle, "Edit", true, &[
                &PredefinedMenuItem::undo(handle, None)?,
                &PredefinedMenuItem::redo(handle, None)?,
                &PredefinedMenuItem::separator(handle)?,
                &PredefinedMenuItem::cut(handle, None)?,
                &PredefinedMenuItem::copy(handle, None)?,
                &PredefinedMenuItem::paste(handle, None)?,
                &PredefinedMenuItem::select_all(handle, None)?,
            ])?;

            let menu = Menu::with_items(handle, &[&app_menu, &file_menu, &edit_menu])?;
            app.set_menu(menu)?;

            if let Some(path) = std::env::args_os().skip(1).map(PathBuf::from).find(|path| path.is_file()) {
                if let Ok(opened_file) = read_opened_file(path) {
                    let pending = app.state::<PendingOpenFile>();
                    *pending.0.lock().unwrap() = Some(opened_file);
                }
            }

            Ok(())
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "new_window" => { let _ = create_window_internal(app); }
                "close_quit" | "quit" => { let _ = app.emit("request-close", ()); }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![save_file, select_export_directory, set_export_directory, get_export_directory, show_item_in_folder, check_file_exists, read_file, write_file, consume_pending_open_file, create_window, quit_app])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            match event {
                #[cfg(target_os = "macos")]
                tauri::RunEvent::Opened { urls } => {
                    for url in urls {
                        if let Ok(path) = url.to_file_path() {
                            if let Ok(opened_file) = read_opened_file(path) {
                                let pending = app_handle.state::<PendingOpenFile>();
                                *pending.0.lock().unwrap() = Some(opened_file.clone());
                                let _ = app_handle.emit("file-opened", opened_file);
                                break;
                            }
                        }
                    }
                }
                tauri::RunEvent::WindowEvent { label, event, .. } => {
                    match event {
                        tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                            if let Some(window) = app_handle.get_webview_window(&label) {
                                if let (Ok(position), Ok(size)) = (window.outer_position(), window.inner_size()) {
                                    let _ = save_window_geometry(app_handle, &WindowGeometry { x: position.x, y: position.y, width: size.width, height: size.height });
                                }
                            }
                        }
                        _ => {}
                    }
                }
                _ => {}
            }
        });
}
