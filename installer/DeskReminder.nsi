Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "Sections.nsh"

!define APP_NAME "桌面提醒"
!define APP_ID "DeskReminder"
!define APP_VERSION "1.1.1"
!define APP_PUBLISHER "DeskReminder"
!define APP_EXE "DeskReminder.exe"
!define RUN_KEY "Software\Microsoft\Windows\CurrentVersion\Run"
!define STARTUP_APPROVED "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"
!define APP_REG_KEY "Software\${APP_ID}"
!define WEBVIEW2_GUID "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

; 固定 section 编号：主程序 0、桌面快捷方式 1、开始菜单 2、开机自启 3
!define SEC_MAIN_ID 0
!define SEC_DESKTOP_ID 1
!define SEC_STARTMENU_ID 2
!define SEC_AUTOSTART_ID 3

Name "${APP_NAME}"
OutFile "..\release\DeskReminder-Setup-${APP_VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\DeskReminder"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 32
BrandingText "${APP_NAME} ${APP_VERSION}"
Icon "app.ico"
UninstallIcon "app.ico"

VIProductVersion "1.1.1.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "FileDescription" "${APP_NAME} 安装程序"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"
VIAddVersionKey "CompanyName" "${APP_PUBLISHER}"
VIAddVersionKey "LegalCopyright" "Copyright (C) 2026 DeskReminder"

!define MUI_ABORTWARNING
!define MUI_ICON "app.ico"
!define MUI_UNICON "app.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "welcome.bmp"
!define MUI_WELCOMEPAGE_TITLE "安装 ${APP_NAME}"
!define MUI_WELCOMEPAGE_TEXT "这个向导将引导你安装 ${APP_NAME}。$\r$\n$\r$\n你可以选择安装位置，并决定是否创建桌面/开始菜单快捷方式、是否开机自动启动。$\r$\n$\r$\n默认安装到当前用户目录，无需管理员权限。"
!define MUI_DIRECTORYPAGE_TEXT_TOP "选择 ${APP_NAME} 的安装位置。建议保持默认的当前用户目录，避免管理员权限问题。"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "运行 ${APP_NAME}"
!define MUI_FINISHPAGE_NOREBOOTSUPPORT

Function ValidateInstallDir
  ClearErrors
  CreateDirectory "$INSTDIR"
  IfErrors dir_error
  ClearErrors
  FileOpen $0 "$INSTDIR\.write-test" w
  IfErrors write_error
  FileClose $0
  Delete "$INSTDIR\.write-test"
  Return

  dir_error:
    MessageBox MB_ICONSTOP "无法创建安装目录，请选择其他位置。"
    Abort
  write_error:
    MessageBox MB_ICONSTOP "当前用户没有写入该目录的权限，请选择当前用户可写的目录。"
    Abort
FunctionEnd

!insertmacro MUI_PAGE_WELCOME
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE ValidateInstallDir
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

Section "桌面提醒（必需）" SEC_MAIN
  SectionIn RO
  SetShellVarContext current
  SetRegView 64

  ; 覆盖安装/升级前先结束正在运行的实例
  nsExec::Exec 'taskkill /IM "${APP_EXE}" /F'
  Pop $0

  SetOutPath "$INSTDIR"
  File "..\release\DeskReminder.exe"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  WriteRegStr HKCU "${APP_REG_KEY}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1

  ; 先清掉旧的自启/快捷方式状态，下面选中的 section 会重新创建
  DeleteRegValue HKCU "${RUN_KEY}" "${APP_ID}"
  DeleteRegValue HKCU "${STARTUP_APPROVED}" "${APP_ID}"

  SectionGetFlags ${SEC_DESKTOP_ID} $0
  IntOp $0 $0 & ${SF_SELECTED}
  ${If} $0 == 0
    Delete "$DESKTOP\${APP_NAME}.lnk"
  ${EndIf}

  SectionGetFlags ${SEC_STARTMENU_ID} $0
  IntOp $0 $0 & ${SF_SELECTED}
  ${If} $0 == 0
    Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
    Delete "$SMPROGRAMS\${APP_NAME}\卸载 ${APP_NAME}.lnk"
    RMDir "$SMPROGRAMS\${APP_NAME}"
  ${EndIf}
SectionEnd

Section "创建桌面快捷方式" SEC_DESKTOP
  SetShellVarContext current
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
SectionEnd

Section "创建开始菜单快捷方式" SEC_STARTMENU
  SetShellVarContext current
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\卸载 ${APP_NAME}.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd

Section /o "开机自动启动" SEC_AUTOSTART
  SetRegView 64
  WriteRegStr HKCU "${RUN_KEY}" "${APP_ID}" '"$INSTDIR\${APP_EXE}"'
  WriteRegBin HKCU "${STARTUP_APPROVED}" "${APP_ID}" 020000000000000000000000
SectionEnd

Function .onInit
  SetRegView 64

  ; 读取上次安装路径，升级时沿用
  ReadRegStr $0 HKCU "${APP_REG_KEY}" "InstallDir"
  ${If} $0 != ""
    StrCpy $INSTDIR $0
  ${EndIf}

  ; 检查 WebView2 Runtime；缺失时打开微软下载页并退出
  ReadRegStr $1 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\${WEBVIEW2_GUID}" "pv"
  ${If} $1 == ""
    SetRegView 32
    ReadRegStr $1 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\${WEBVIEW2_GUID}" "pv"
  ${EndIf}
  ${If} $1 == ""
    SetRegView 64
    ReadRegStr $1 HKCU "Software\Microsoft\EdgeUpdate\Clients\${WEBVIEW2_GUID}" "pv"
  ${EndIf}
  ${If} $1 == ""
    SetRegView 32
    ReadRegStr $1 HKCU "Software\Microsoft\EdgeUpdate\Clients\${WEBVIEW2_GUID}" "pv"
  ${EndIf}
  SetRegView 64
  ${If} $1 == ""
    MessageBox MB_ICONEXCLAMATION|MB_YESNO "未检测到 Microsoft Edge WebView2 Runtime。$\r$\n$\r$\n桌面提醒需要它来显示界面。是否打开微软的 WebView2 下载页面？" IDNO +2
    ExecShell "open" "https://developer.microsoft.com/microsoft-edge/webview2/"
    Abort
  ${EndIf}

  ; 已启用自启的用户在升级时默认保留勾选
  ReadRegStr $1 HKCU "${RUN_KEY}" "${APP_ID}"
  ${If} $1 != ""
    SectionSetFlags ${SEC_AUTOSTART_ID} ${SF_SELECTED}
  ${EndIf}
FunctionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_MAIN} "安装桌面提醒主程序和卸载信息。"
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_DESKTOP} "在当前用户桌面创建快捷方式。"
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_STARTMENU} "在开始菜单创建快捷方式和卸载入口。"
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_AUTOSTART} "登录 Windows 后自动在系统托盘运行。"
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Section "Uninstall"
  SetShellVarContext current
  SetRegView 64

  nsExec::Exec 'taskkill /IM "${APP_EXE}" /F'
  Pop $0

  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"

  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\卸载 ${APP_NAME}.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"

  DeleteRegValue HKCU "${RUN_KEY}" "${APP_ID}"
  DeleteRegValue HKCU "${STARTUP_APPROVED}" "${APP_ID}"
  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "${APP_REG_KEY}"

  IfSilent keep_config
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "是否同时删除 ${APP_NAME} 的个人配置和日志？" IDNO keep_config
  RMDir /r "$APPDATA\DeskReminder"
  RMDir /r "$LOCALAPPDATA\com.deskreminder.desktop"
  keep_config:
SectionEnd

!insertmacro MUI_LANGUAGE "SimpChinese"
