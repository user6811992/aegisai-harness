; Inno Setup script for AegisAi Harness
; Build with: iscc packaging\windows\installer.iss
[Setup]
AppName=AegisAi Harness
AppVersion=0.67.3
AppPublisher=AegisAi
AppPublisherURL=https://github.com/user6811992/aegisai-harness
DefaultDirName={autopf}\AegisAiHarness
DefaultGroupName=AegisAi Harness
OutputDir=..\..\dist
OutputBaseFilename=AegisAi-Harness-0.67.3-Setup
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
Source: "..\..\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\ROADMAP.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\HARNESS_DOCS.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\llms.txt"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "aegisai-harness.cmd"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\AegisAi Harness (CLI)"; Filename: "{app}\aegisai-harness.cmd"; WorkingDir: "{app}"
Name: "{group}\AegisAi Harness (Web UI)"; Filename: "{app}\aegisai-harness.cmd"; Parameters: "--web"; WorkingDir: "{app}"
Name: "{autodesktop}\AegisAi Harness"; Filename: "{app}\aegisai-harness.cmd"; WorkingDir: "{app}"

[Run]
Filename: "{app}\aegisai-harness.cmd"; Description: "Launch AegisAi Harness"; Flags: nowait postinstall skipifsilent

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;
