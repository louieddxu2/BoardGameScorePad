# Antigravity Wrapper

Use `scripts\agy.cmd` to send a task to the local Antigravity wrapper without typing the long `agy_wrapper.py` path.

```powershell
scripts\agy.cmd "請分析目前 repo 的測試失敗原因"
```

The PowerShell implementation auto-detects the newest wrapper at:

```text
%USERPROFILE%\.gemini\antigravity\brain\*\scratch\agy_wrapper.py
```

If Antigravity changes the active brain directory, the script should keep working because it does not hardcode the UUID.

## Useful Commands

List detected wrappers:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\agy.ps1 -ListWrappers
```

Preview the command without running Antigravity:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\agy.ps1 -DryRun "請做一次架構 review"
```

Use a specific wrapper:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\agy.ps1 -WrapperPath "C:\path\to\agy_wrapper.py" "請做一次架構 review"
```

Use a specific workspace directory:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\agy.ps1 -WorkspaceDir "C:\board-game-score-pad" "請做一次架構 review"
```

Or set `AGY_WRAPPER` in your shell/profile when you want to pin a specific wrapper.

## Optional Personal Alias

For an even shorter command, add this to your PowerShell profile:

```powershell
function agy {
  & "C:\board-game-score-pad\scripts\agy.cmd" @args
}
```

Then call:

```powershell
agy "請檢查這次改動是否有風險"
```
