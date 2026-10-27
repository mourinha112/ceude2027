#!/usr/bin/env bash
# Céu de 2027 · atualizar no VPS (como root): bash /srv/ceu2027/app/deploy/atualizar.sh
# Faz backup do banco antes, baixa o código, builda e reinicia. O esquema do banco se atualiza sozinho ao subir.
set -euo pipefail
APP=/srv/ceu2027/app
cd "$APP"
sudo -u postgres pg_dump ceu2027 | gzip > "/srv/ceu2027/backups/ceu2027-$(date +%Y%m%d-%H%M%S).sql.gz"
ls -1t /srv/ceu2027/backups/*.sql.gz | tail -n +15 | xargs -r rm --
sudo -u ceu git pull --ff-only
sudo -u ceu npm ci --no-audit --no-fund
sudo -u ceu npm run build
systemctl restart ceu2027
sleep 2
curl -s http://127.0.0.1:8810/api/saude && echo && echo "✅ atualizado"
