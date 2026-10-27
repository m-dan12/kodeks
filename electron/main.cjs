const { app, BrowserWindow, session, shell, Menu, ipcMain } = require("electron");
const path = require("node:path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: "#cfd6dc",
    title: "Кодекс",
    icon: path.join(__dirname, "..", "dist", "icon.ico"),
    frame: false,
    webPreferences: { contextIsolation: true, sandbox: true, plugins: true, preload: path.join(__dirname, "preload.cjs") },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  const mine = (e) => BrowserWindow.fromWebContents(e.sender);
  ipcMain.on("win:minimize", (e) => mine(e)?.minimize());
  ipcMain.on("win:toggle-maximize", (e) => {
    const w = mine(e);
    if (w) w.isMaximized() ? w.unmaximize() : w.maximize();
  });
  ipcMain.on("win:close", (e) => mine(e)?.close());
  // Ссылка на новую версию: открываем только страницы и файлы нашего репозитория
  ipcMain.on("open-external", (_e, url) => {
    if (typeof url === "string" && /^https:\/\/(github\.com\/m-dan12\/kodeks\/|objects\.githubusercontent\.com\/)/.test(url)) void shell.openExternal(url);
  });
  // буфер обмена нужен для кнопок «Вставить из буфера» и «Скопировать»
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(["clipboard-read", "clipboard-sanitized-write"].includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) =>
    ["clipboard-read", "clipboard-sanitized-write"].includes(permission),
  );
  createWindow();
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on("window-all-closed", () => app.quit());
