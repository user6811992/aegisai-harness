; Inno Setup script for AegisAi Harness
; Build with: .\packaging\build.ps1 -Installer
; Version strings are checked by scripts/check-version-consistency.js (CI).
[Setup]
AppId={{8F3D1B2A-6C4E-4B9A-9D21-AE615A010001}}
AppName=AegisAi Harness
AppVersion=1.0.34
AppPublisher=AegisAi
AppPublisherURL=https://github.com/user6811992/aegisai-harness
DefaultDirName={autopf}\AegisAiHarness
DefaultGroupName=AegisAi Harness
OutputDir=..\..\dist
OutputBaseFilename=AegisAi-Harness-1.0.34-Setup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\aegisai-harness.cmd
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\..\src\*"; DestDir: "{app}\src"; Flags: recursesubdirs ignoreversion
Source: "..\..\public\*"; DestDir: "{app}\public"; Flags: recursesubdirs ignoreversion
Source: "..\..\scripts\*"; DestDir: "{app}\scripts"; Flags: recursesubdirs ignoreversion
Source: "..\..\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\ROADMAP.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\HARNESS_DOCS.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\CHANGELOG.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\llms.txt"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\THIRD_PARTY_NOTICES.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "aegisai-harness.cmd"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\AegisAi Harness (CLI)"; Filename: "{app}\aegisai-harness.cmd"; WorkingDir: "{app}"
Name: "{group}\AegisAi Harness (Web UI)"; Filename: "{app}\aegisai-harness.cmd"; Parameters: "--web"; WorkingDir: "{app}"
Name: "{autodesktop}\AegisAi Harness"; Filename: "{app}\aegisai-harness.cmd"; WorkingDir: "{app}"

[Run]
Filename: "{app}\aegisai-harness.cmd"; Description: "Launch AegisAi Harness"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Generated at first launch by the launcher, not installed by Setup.
; Removing them prevents an old dependency tree being reused after an upgrade.
Type: filesandordirs; Name: "{app}\node_modules"
Type: files; Name: "{app}\package-lock.json"
Type: files; Name: "{app}\.deps-ok"
; {app}\data is intentionally preserved so user sessions/memories survive uninstall.

[Code]
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;

  if not Exec(ExpandConstant('{cmd}'), '/c where node >nul 2>&1', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) or (ResultCode <> 0) then
  begin
    MsgBox(
      'AegisAi Harness needs Node.js 22.13 or newer, but ''node'' was not found on PATH.' + #13#10 +
      '1. Download the LTS installer from https://nodejs.org' + #13#10 +
      '2. Install it and reopen this installer (a terminal restart is required).' + #13#10 +
      '3. Verify with: node -v',
      mbError, MB_OK);
    Result := False;
    Exit;
  end;

  if not Exec(ExpandConstant('{cmd}'),
       '/c node -e "const v=process.versions.node.split(''.'').map(Number);process.exit(v[0]>22||(v[0]===22&&v[1]>=13)?0:1)"',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode) or (ResultCode <> 0) then
  begin
    MsgBox(
      'AegisAi Harness needs Node.js 22.13 or newer.' + #13#10 +
      'The installed version is too old (or not runnable).' + #13#10 +
      'Upgrade from https://nodejs.org and rerun this installer.',
      mbError, MB_OK);
    Result := False;
  end;
end;
