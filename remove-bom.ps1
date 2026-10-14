$files = @(
  'g:\dsh-plugins\dsh-file-bookmark\src\project-templates.ts',
  'g:\dsh-plugins\dsh-file-bookmark\src\index.ts',
  'g:\dsh-plugins\dsh-file-bookmark\src\routes\project.ts'
)

foreach ($f in $files) {
  $bytes = [System.IO.File]::ReadAllBytes($f)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    $newBytes = $bytes[3..($bytes.Length-1)]
    [System.IO.File]::WriteAllBytes($f, $newBytes)
    Write-Host "Removed BOM: $f"
  } else {
    Write-Host "No BOM: $f"
  }
}