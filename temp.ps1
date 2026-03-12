$content = Get-Content frontend/src/pages/hrms/Attendance.jsx
$start = [Math]::Max(0, $content.Count - 80)
for ($i = $start; $i -lt $content.Count; $i++) {
  Write-Host ("{0}: {1}" -f ($i+1), $content[$i])
}
