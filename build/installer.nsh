!include "LogicLib.nsh"

!ifndef BUILD_UNINSTALLER
Var /GLOBAL recoveryInstallLocation

!macro recoverIncompleteInstall ROOT_KEY
  ${If} ${Errors}
    ReadRegStr $recoveryInstallLocation ${ROOT_KEY} "${INSTALL_REGISTRY_KEY}" InstallLocation

    ${If} $recoveryInstallLocation != ""
      ${IfNot} ${FileExists} "$recoveryInstallLocation\${UNINSTALL_FILENAME}"
        ${IfNot} ${FileExists} "$recoveryInstallLocation\${APP_EXECUTABLE_FILENAME}"
        DeleteRegKey ${ROOT_KEY} "${UNINSTALL_REGISTRY_KEY}"
        DeleteRegKey ${ROOT_KEY} "${INSTALL_REGISTRY_KEY}"
        ClearErrors
        DetailPrint "Removed an incomplete BreakVeil installation registration."
        ${EndIf}
      ${EndIf}
    ${EndIf}
  ${ElseIf} $R0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "$(uninstallFailed): $R0"
    DetailPrint "Uninstall was not successful. Uninstaller error code: $R0."
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend

!macro customUnInstallCheck
  !insertmacro recoverIncompleteInstall SHELL_CONTEXT
!macroend

!macro customUnInstallCheckCurrentUser
  !insertmacro recoverIncompleteInstall HKCU
!macroend
!endif
