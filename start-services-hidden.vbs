' Start the QR-MedSecure services hidden at logon.
' Output goes to logs\api.log and logs\web.log.
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

' Vite website (port 5173)
sh.CurrentDirectory = base
sh.Run "cmd /c npm run dev > """ & logDir & "\web.log"" 2>&1", 0, False
