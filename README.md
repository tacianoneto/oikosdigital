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

### Internet (backend local via Cloudflare tunnel + Netlify)

O backend roda na sua maquina e e exposto por um quick tunnel do Cloudflare. O frontend estatico fica no Netlify e aponta para o tunnel pela query `?server=`.

**1. Servidor local**

```bash
npm run dev:server      # sobe o servidor na porta 4173
```

Variaveis do servidor (opcionais, ver `apps/server/.env.example`):

```bash
PORT=4173
CLIENT_ORIGIN=                  # vazio = libera qualquer origem (CORS)
DB_PATH=./data/oikos.db         # caminho do SQLite local
TURN_TIMEOUT_MS=90000           # pula turno de jogador desconectado
BOT_TURN_DELAY_MS=2500          # intervalo entre passos dos bots
AUTO_SCORE_DELAY_MS=1500        # intervalo antes de pontuacoes automaticas
ROOM_MAX_AGE_MS=86400000        # purga salas inativas ha mais de 24h
```

**2. Cloudflare tunnel**

```bash
npm run tunnel          # sobe o quick tunnel no 4173 e imprime o link de teste
```

O script usa `.tools/cloudflared.exe` (ou `cloudflared` do PATH). O quick tunnel gera uma URL `*.trycloudflare.com` **diferente a cada execucao**: o link vale enquanto o processo do tunnel e o servidor estiverem vivos.

**3. Frontend no Netlify**

- O repositorio tem `netlify.toml`. No push, o Netlify roda `npm run build -w @oikos/web` e publica `apps/web/dist`.
- **Nao** defina `VITE_SERVER_URL` no painel do Netlify (deixe sem essa variavel): cada link de teste informa o servidor pela query `?server=`.
- Compartilhe o link que o `npm run tunnel` imprime, no formato:

```
https://oikosdigital.netlify.app/?server=https://<sub>.trycloudflare.com
```

O `?server=` sobrescreve o servidor padrao e fica salvo no navegador do jogador. Para limpar, abra com `?clearServer=1`.

### Estado atual

- Salas online por codigo, acoes validadas no servidor.
- Jogador reconecta com a mesma identidade do navegador; ao atualizar a pagina volta para a ultima sala.
- Fim de jogo apos 5 rodadas com pontuacao final (maioria de recursos, semente 2:1, limite e desempate).
- Turno de jogador desconectado e pulado automaticamente apos `TURN_TIMEOUT_MS`.
- Salas persistidas em SQLite (`DB_PATH`) enquanto o servidor estiver vivo.

Escala: uma instancia de servidor (SQLite local). Para producao com persistencia real, usar disco dedicado ou trocar o store por Redis/Postgres.
