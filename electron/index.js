"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const ipcHandlers_1 = require("./ipcHandlers");
const db_1 = require("./db");
function createWindow() {
    console.log('createWindow() called');
    const win = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    win.webContents.on('did-finish-load', () => {
        win.webContents.send('main-process-message', new Date().toLocaleString());
    });
    // Charge l'URL du serveur de dev ou le fichier HTML local
    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
    }
    else {
        win.loadFile(path_1.default.join(__dirname, '..', 'dist', 'index.html'));
    }
    if (!electron_1.app.isPackaged) {
        win.webContents.openDevTools();
    }
}
electron_1.app.whenReady().then(() => __awaiter(void 0, void 0, void 0, function* () {
    // Set a Content Security Policy
    electron_1.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: Object.assign(Object.assign({}, details.responseHeaders), { 'Content-Security-Policy': [
                    "default-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-eval' 'unsafe-inline' data:"
                ] })
        });
    });
    try {
        (0, db_1.initializeDatabase)();
        (0, ipcHandlers_1.initializeIpcHandlers)();
        createWindow();
        electron_1.app.on('activate', () => {
            if (electron_1.BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    }
    catch (error) {
        console.error('[Main] Failed to initialize application:', error);
        electron_1.app.quit(); // Quit on critical error
    }
}));
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        (0, db_1.getDb)().close();
        electron_1.app.quit();
    }
});
