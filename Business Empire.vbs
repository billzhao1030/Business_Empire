' ════════════════════════════════════════════════════════════
'  Business Empire —— Windows 无窗口启动器
'  没启动就启动，已启动就直接打开网页
'  用法：右键本文件 → 发送到 → 桌面快捷方式，即可获得一个桌面图标
' ════════════════════════════════════════════════════════════
Option Explicit
Dim sh, fso, proj, port, url, logDir, logFile, i, node

Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

port    = 8020
url     = "http://127.0.0.1:" & port & "/"
proj    = fso.GetParentFolderName(WScript.ScriptFullName)
logDir  = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\BusinessEmpire"
logFile = logDir & "\server.log"

Sub Alert(msg)
  MsgBox msg, 48, "Business Empire"
End Sub

' 服务是否已在运行（严格校验返回内容）
Function IsRunning()
  Dim http
  IsRunning = False
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.SetTimeouts 800, 800, 1000, 1500
  http.Open "GET", url & "api/health", False
  http.Send
  If Err.Number = 0 And http.Status = 200 Then
    If InStr(http.responseText, """ok"":true") > 0 Then IsRunning = True
  End If
  Err.Clear
  On Error GoTo 0
End Function

' 找项目目录（万一快捷方式指向的位置被挪走）
If Not fso.FileExists(proj & "\server.js") Then
  Dim cands, c
  cands = Array(proj, _
                sh.SpecialFolders("Desktop") & "\Business Empire", _
                sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\business-empire", _
                sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\Documents\Business Empire", _
                sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\Downloads\Business Empire")
  For Each c In cands
    If fso.FileExists(c & "\server.js") Then proj = c : Exit For
  Next
End If
If Not fso.FileExists(proj & "\server.js") Then
  Alert "找不到游戏文件 server.js。" & vbCrLf & vbCrLf & _
        "请确认 Business Empire 文件夹完整，并把本快捷方式指向文件夹内的 Business Empire.vbs。"
  WScript.Quit 1
End If

' 已在运行 → 直接开网页
If IsRunning() Then
  sh.Run url, 1, False
  WScript.Quit 0
End If

' 找 node
node = ""
On Error Resume Next
Dim exec
Set exec = sh.Exec("cmd /c where node")
If Err.Number = 0 Then
  node = Trim(Split(exec.StdOut.ReadAll(), vbCrLf)(0))
End If
Err.Clear
On Error GoTo 0
If node = "" Or Not fso.FileExists(node) Then
  Dim guesses, g
  guesses = Array("C:\Program Files\nodejs\node.exe", "C:\Program Files (x86)\nodejs\node.exe", _
                  sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\nodejs\node.exe")
  For Each g In guesses
    If fso.FileExists(g) Then node = g : Exit For
  Next
End If
If node = "" Then
  Alert "没有找到 Node.js。" & vbCrLf & vbCrLf & _
        "请先安装 Node.js v24 LTS：" & vbCrLf & _
        "  PowerShell 执行  winget install OpenJS.NodeJS.LTS" & vbCrLf & _
        "  或访问 https://nodejs.org 下载 LTS 安装包" & vbCrLf & vbCrLf & _
        "装完请重新双击本图标。"
  sh.Run "https://nodejs.org", 1, False
  WScript.Quit 1
End If

' 准备存档与日志目录
If Not fso.FolderExists(proj & "\data") Then
  On Error Resume Next
  fso.CreateFolder proj & "\data"
  If Err.Number <> 0 Then
    Alert "无法在以下位置创建存档目录：" & vbCrLf & proj & "\data" & vbCrLf & vbCrLf & "请检查该文件夹的写入权限。"
    WScript.Quit 1
  End If
  On Error GoTo 0
End If
If Not fso.FolderExists(logDir) Then fso.CreateFolder logDir

' 后台无窗口启动（0 = 隐藏，False = 不等待）
sh.CurrentDirectory = proj
sh.Run "cmd /c """"" & node & """ server.js >> """ & logFile & """ 2>&1""", 0, False

For i = 1 To 40
  WScript.Sleep 250
  If IsRunning() Then
    sh.Run url, 1, False
    WScript.Quit 0
  End If
Next

Alert "服务启动失败。" & vbCrLf & vbCrLf & "日志文件：" & vbCrLf & logFile
sh.Run "notepad """ & logFile & """", 1, False
WScript.Quit 1
