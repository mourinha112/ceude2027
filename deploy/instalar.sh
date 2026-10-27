#!/usr/bin/env bash
# Céu de 2027 · instalação no VPS (rodar UMA vez, como root):
#   bash deploy/instalar.sh ceude2027.com.br https://github.com/SEU_USUARIO/ceu2027.git
# Cria usuário "ceu", banco "ceu2027", baixa o código em /srv/ceu2027/app, builda, cria o serviço systemd e o nginx com HTTPS.
# Não mexe no ViraRua (usa porta, usuário, banco e site do nginx próprios).
set -euo pipefail
DOMINIO="${1:?uso: bash deploy/instalar.sh DOMINIO URL_DO_GIT}"
GIT="${2:?uso: bash deploy/instalar.sh DOMINIO URL_DO_GIT}"
BASE=/srv/ceu2027 APP=/srv/ceu2027/app PORTA=8810

command -v node >/dev/null || { echo "instale o Node 20+ antes"; exit 1; }
command -v psql >/dev/null || { echo "instale o PostgreSQL antes"; exit 1; }
command -v nginx >/dev/null || { echo "instale o nginx antes"; exit 1; }

id ceu >/dev/null 2>&1 || useradd --system --create-home --home-dir "$BASE" --shell /usr/sbin/nologin ceu
mkdir -p "$BASE/backups" && chown -R ceu:ceu "$BASE"

# banco com senha aleatória
SENHA_DB="$(openssl rand -hex 18)"
if ! sudo -u postgres psql -tAc "select 1 from pg_roles where rolname='ceu'" | grep -q 1; then
  sudo -u postgres psql -c "create role ceu login password '$SENHA_DB'"
else
  sudo -u postgres psql -c "alter role ceu password '$SENHA_DB'"
fi
sudo -u postgres psql -tAc "select 1 from pg_database where datname='ceu2027'" | grep -q 1 || sudo -u postgres createdb -O ceu ceu2027

# código
if [ ! -d "$APP/.git" ]; then sudo -u ceu git clone "$GIT" "$APP"; else sudo -u ceu git -C "$APP" pull --ff-only; fi
cd "$APP"
if [ ! -f .env ]; then
  sudo -u ceu cp .env.example .env
  sed -i "s#^DATABASE_URL=.*#DATABASE_URL=postgres://ceu:$SENHA_DB@127.0.0.1:5432/ceu2027#" .env
  sed -i "s#^SITE_URL=.*#SITE_URL=https://$DOMINIO#" .env
  sed -i "s#^CHAVE_SESSAO=.*#CHAVE_SESSAO=$(openssl rand -hex 32)#" .env
  sed -i "s#^ADMIN_SENHA=.*#ADMIN_SENHA=$(openssl rand -base64 18 | tr -d '/+=')#" .env
  chmod 600 .env && chown ceu:ceu .env
else
  sed -i "s#^DATABASE_URL=.*#DATABASE_URL=postgres://ceu:$SENHA_DB@127.0.0.1:5432/ceu2027#" .env
fi
sudo -u ceu npm ci --no-audit --no-fund
sudo -u ceu npm run build

# serviço
cat > /etc/systemd/system/ceu2027.service <<EOF
[Unit]
Description=Céu de 2027
After=network.target postgresql.service
[Service]
User=ceu
WorkingDirectory=$APP
ExecStart=$APP/node_modules/.bin/tsx server/index.ts
Restart=always
RestartSec=3
Environment=NODE_ENV=production
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload && systemctl enable --now ceu2027 && systemctl restart ceu2027

# nginx + HTTPS
cat > /etc/nginx/sites-available/ceu2027 <<EOF
server {
  listen 80;
  server_name $DOMINIO www.$DOMINIO;
  client_max_body_size 1m;
  location / {
    proxy_pass http://127.0.0.1:$PORTA;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Real-IP \$remote_addr;
  }
}
EOF
ln -sf /etc/nginx/sites-available/ceu2027 /etc/nginx/sites-enabled/ceu2027
nginx -t && systemctl reload nginx
command -v certbot >/dev/null && certbot --nginx -d "$DOMINIO" -d "www.$DOMINIO" --non-interactive --agree-tos --redirect -m "admin@$DOMINIO" || echo "⚠ HTTPS: rode o certbot depois que o DNS do domínio apontar pra este servidor"

sleep 2
curl -s "http://127.0.0.1:$PORTA/api/saude" && echo
echo
echo "✅ Céu de 2027 instalado em https://$DOMINIO"
echo "   senha do admin (https://$DOMINIO/admin):"
grep '^ADMIN_SENHA=' "$APP/.env" | cut -d= -f2
echo "   agora preencha o Instagram e o Mercado Pago em $APP/.env e rode: systemctl restart ceu2027"
