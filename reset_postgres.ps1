# Requires Run as Administrator

try {
    $ErrorActionPreference = "Stop"
    $pgHba = "C:\Program Files\PostgreSQL\16\data\pg_hba.conf"
    $psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"

    Write-Host "Stopping PostgreSQL Service..."
    Stop-Service -Name postgresql-x64-16 -Force

    Write-Host "Modifying pg_hba.conf to trust..."
    $content = Get-Content $pgHba
    $content = $content -replace "127\.0\.0\.1/32\s+scram-sha-256", "127.0.0.1/32            trust"
    $content = $content -replace "::1/128\s+scram-sha-256", "::1/128                 trust"
    Set-Content -Path $pgHba -Value $content

    Write-Host "Starting PostgreSQL Service..."
    Start-Service -Name postgresql-x64-16

    Write-Host "Resetting postgres user password..."
    & $psql -U postgres -c "ALTER USER postgres WITH PASSWORD '123@Mudrek!';"

    Write-Host "Restoring pg_hba.conf to scram-sha-256..."
    $content = Get-Content $pgHba
    $content = $content -replace "127\.0\.0\.1/32\s+trust", "127.0.0.1/32            scram-sha-256"
    $content = $content -replace "::1/128\s+trust", "::1/128                 scram-sha-256"
    Set-Content -Path $pgHba -Value $content

    Write-Host "Restarting PostgreSQL Service..."
    Restart-Service -Name postgresql-x64-16 -Force

    Write-Host "Done! The password is now successfully set to: 123@Mudrek!"
} catch {
    Write-Host "An error occurred: $_"
    Write-Host "Please ensure you are running this PowerShell script as Administrator."
}

Write-Host "Press any key to exit..."
$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null
