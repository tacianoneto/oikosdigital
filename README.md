# Oikos Digital

## Multiplayer online

O multiplayer usa servidor autoritativo com Socket.IO. O navegador envia a jogada, o servidor valida nas regras e todos os jogadores da sala recebem o novo estado.

Para jogar com pessoas em outros locais, suba duas partes:

1. Servidor Node, com WebSocket liberado.
2. Frontend web apontando para a URL publica do servidor.

### Desenvolvimento local

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5187`

Servidor: `http://localhost:4173`

### Mesma rede Wi-Fi

1. Descubra o IP da maquina host, por exemplo `192.168.0.20`.
2. No frontend, configure:

```bash
VITE_SERVER_URL=http://192.168.0.20:4173
```

3. Abra `http://192.168.0.20:5187` nos outros dispositivos.

### Internet (Render + Netlify)

A ordem importa: suba o servidor primeiro, pegue a URL, configure o frontend, depois volte e trave o CORS do servidor.

**1. Servidor no Render**

- O repositorio ja tem `render.yaml` (Blueprint). No Render: New > Blueprint > selecione o repo.
- Plano `free`, sem disco persistente, para publicar sem pagar nada agora.
  Nesse modo o SQLite fica em `/tmp/oikos.db`: funciona para jogar/testar, mas a partida pode sumir se o servidor dormir, reiniciar ou fizer redeploy.
- Variaveis ja definidas no `render.yaml`. `CLIENT_ORIGIN` fica em branco no primeiro deploy.
- Apos o deploy, copie a URL publica do servico (ex.: `https://oikos-server.onrender.com`).

Variaveis do servidor:

```bash
PORT=4173                       # injetado pelo Render
CLIENT_ORIGIN=https://sua-url-do-frontend
DB_PATH=/tmp/oikos.db           # caminho do SQLite no modo gratis/efemero
TURN_TIMEOUT_MS=90000           # pula turno de jogador desconectado
ROOM_MAX_AGE_MS=86400000        # purga salas inativas ha mais de 24h
```

**2. Frontend no Netlify**

- O repositorio ja tem `netlify.toml` (build do monorepo + sync de assets + fallback SPA).
- No Netlify: New site > selecione o repo. O build roda `npm run build -w @oikos/web`,
  que sincroniza os assets (`scripts/sync-assets.mjs`) e gera `apps/web/dist`.
- Defina a variavel de ambiente de build:

```bash
VITE_SERVER_URL=https://sua-url-do-servidor
```

- Apos o deploy, copie a URL do site (ex.: `https://oikos.netlify.app`).

**3. Travar o CORS do servidor**

- No Render, defina `CLIENT_ORIGIN=https://oikos.netlify.app` e redeploy.

Build/start manual (se nao usar os blueprints):

```bash
npm run build -w @oikos/web      # frontend estatico em apps/web/dist
npm run start -w @oikos/server   # servidor Node
```

### Estado atual

- Salas online por codigo, acoes validadas no servidor.
- Jogador reconecta com a mesma identidade do navegador; ao atualizar a pagina volta para a ultima sala.
- Fim de jogo apos 5 rodadas com pontuacao final (maioria de recursos, semente 2:1, limite e desempate).
- Turno de jogador desconectado e pulado automaticamente apos `TURN_TIMEOUT_MS`.
- Salas persistidas em SQLite (`DB_PATH`) enquanto o servidor estiver vivo. No Render gratis, o armazenamento e efemero e pode ser perdido em restart/redeploy/spin-down.

Escala: uma instancia de servidor (SQLite local). Para producao com persistencia real, usar plano com disco persistente ou trocar o store por Redis/Postgres.
