; Inno Setup script for AegisAi Harness
[Setup]
AppName=AegisAi Harness
AppVersion=0.15.0
DefaultDirName={autopf}\AegisAiHarness
DefaultGroupName=AegisAi Harness
OutputBaseFilename=AegisAi-Harness-Setup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=lowest

[Files]
Source: "..\*.js"; DestDir: "{app}"; Flags: recursesubdirs
Source: "..\package.json"; DestDir: "{app}"
Source: "..\public\*"; DestDir: "{app}\public"; Flags: recursesubdirs
Source: "..\README.md"; DestDir: "{app}"

[Icons]
Name: "{group}\AegisAi Harness"; Filename: "{app}\aegisai-harness.cmd"
Name: "{autodesktop}\AegisAi Harness"; Filename: "{app}\aegisai-harness.cmd"
