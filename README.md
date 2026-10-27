# Céu de 2027

Comente seu desejo no post → receba o link no direct → escolha a lanterna (grátis, dourada ou de casal) → ela sobe no céu.
Na virada (31/12, meia-noite de Brasília), todas viram fogos.

## Fluxo do Instagram
1. A pessoa comenta no post: `Recife - casa própria`.
2. O servidor cria uma **lanterna pendente** (ainda não aparece no céu) e acha a cidade no texto.
3. O perfil responde **no comentário** (público): "seu desejo tá pronto pra subir! te mandei o link no direct".
4. O perfil manda **no direct** (resposta privada ao comentário) o link pessoal `https://SITE/l/CODIGO`.
5. No link ela ajusta o desejo e escolhe: grátis (sobe na hora) ou paga (Pix do Mercado Pago → sobe quando o pagamento cai).
6. Se não abrir o link em 24h, a lanterna sobe grátis sozinha.
Quem comenta de novo antes de escolher só atualiza o desejo (não recebe outro direct). Quem já tem lanterna no céu e comenta de novo deixa a lanterna dele mais forte.

## Rodar no PC
```
npm install
npm run server     # API em http://localhost:8810 (precisa de um Postgres; veja .env.example)
npm run dev        # site em http://localhost:5310  (http://localhost:5310/?demo funciona sem servidor)
```
Teste sem a Meta: `POST /api/dev/comentario {"username":"teste","texto":"Recife - casa própria"}` (só fora de produção).

## Subir no VPS
```
bash deploy/instalar.sh ceude2027.com.br https://github.com/SEU_USUARIO/ceu2027.git   # uma vez
bash /srv/ceu2027/app/deploy/atualizar.sh                                              # a cada atualização
```
Admin: `https://SITE/admin` (a senha aparece no fim da instalação e fica em `/srv/ceu2027/app/.env`).

## Instagram (Meta)
Perfil do Céu: conta **profissional** (criador ou empresa). No app da Meta (pode ser o mesmo do ViraRua), produto **Instagram › API com login do Instagram**:
- Permissões: `instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages`.
- Webhook: URL `https://SITE/webhook/instagram`, token de verificação = `IG_VERIFY_TOKEN` do `.env`, assinar o campo **comments**.
- `.env`: `IG_CONTA_ID` (id da conta do Instagram), `IG_APP_SECRET` (chave secreta do app), `IG_TOKEN` (token de longa duração; renova sozinho a cada 7 dias).
- Até o app ser aprovado na análise da Meta, só funciona com contas que têm papel no app (testadores).

## Mercado Pago (Pix)
- Credenciais de produção › Access Token → `MP_ACCESS_TOKEN` no `.env`.
- Webhook (Notificações › Webhooks): `https://SITE/webhook/mercadopago`, evento **Pagamentos**.
- Sem token, o site mostra as lanternas pagas como "em breve" e tudo continua grátis.
- O servidor só libera a lanterna depois de confirmar o pagamento na própria API do Mercado Pago.

Preços: dourada R$ 4,90 · casal R$ 7,90 · presente R$ 4,90 (em `server/config.ts`).
