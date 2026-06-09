# Script de déploiement Jux-Music
# Usage : .\deploy.ps1

$SERVER = "jux@192.168.1.223"
$REMOTE_PATH = "/Jux-Music/dist"

Write-Host "Build en cours..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Erreur lors du build" -ForegroundColor Red; exit 1 }

Write-Host "Compression du dossier dist..." -ForegroundColor Cyan
Compress-Archive -Path dist/* -DestinationPath dist.zip -Force

Write-Host "Envoi sur le serveur..." -ForegroundColor Cyan
scp dist.zip "${SERVER}:~/dist.zip"
if ($LASTEXITCODE -ne 0) { Write-Host "Erreur lors de l'envoi" -ForegroundColor Red; exit 1 }

Write-Host "Mise a jour sur le serveur..." -ForegroundColor Cyan
ssh $SERVER "rm -rf $REMOTE_PATH/* && unzip -o ~/dist.zip -d $REMOTE_PATH && rm ~/dist.zip && sudo docker restart jux-music-front"

Remove-Item dist.zip -ErrorAction SilentlyContinue

Write-Host "Deploiement termine ! Le site est a jour." -ForegroundColor Green
