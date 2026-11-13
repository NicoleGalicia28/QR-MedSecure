' Start the QR-MedSecure services hidden at logon.
' Only the Express API is auto-started. The Vite website is started manually
' with `npm run dev` so it can own port 5173 without a conflict.
' Output goes to logs\api.log.
Option Explicit
Dim sh, fso, base, logDir

Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

base = fso.GetParentFolderName(WScript.ScriptFullName)
logDir = base & "\logs"
If Not fso.FolderExists(logDir) Then fso.CreateFolder(logDir)

' Express API (port 5000)
sh.CurrentDirectory = base & "\server"
sh.Run "cmd /c npm start > """ & logDir & "\api.log"" 2>&1", 0, False
