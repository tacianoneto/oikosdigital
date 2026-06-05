# Oikos Digital

## Multiplayer online

O multiplayer usa servidor autoritativo com Socket.IO. O navegador envia a jogada, o servidor valida nas regras e todos os jogadores da sala recebem o novo estado.

## Regra de paridade local/online

Toda regra, acao, objetivo, cenario, ameaca, bot e fluxo de fim de jogo precisa funcionar no teste local e no multiplayer online.

- O teste local pode aplicar as regras direto no navegador para acelerar validacao.
- O online precisa ter o mesmo comportamento validado pelo servidor autoritativo.
- Sempre que uma acao nova for criada no teste local, crie tambem o evento Socket.IO, a funcao em `apps/server/src/rooms.ts` e a chamada em `apps/web/src/socket.ts`.
- Antes de considerar uma mudanca pronta, verifique os dois caminhos: teste local e sala online.

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
SUPABASE_URL=                   # URL do projeto Supabase
SUPABASE_SECRET_KEY=            # secret key/service role do Supabase; nunca vai no frontend
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

### Producao com login Supabase

O frontend exige login Supabase antes de mostrar o jogo. Para salas online funcionarem em producao, o backend publico em `https://api.oikosdigital.com.br` tambem precisa validar o token Supabase.

Frontend (Netlify):

```bash
VITE_SERVER_URL=https://api.oikosdigital.com.br
VITE_SUPABASE_URL=https://ysqpiutokbxpcwlieqax.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_T7q_lGCQkA2P2IvSh03geA_6PEgjUCW
```

Backend (`api.oikosdigital.com.br`):

```bash
CLIENT_ORIGIN=https://oikosdigital.com.br
SUPABASE_URL=https://ysqpiutokbxpcwlieqax.supabase.co
SUPABASE_SECRET_KEY=<secret key do Supabase>
```

`SUPABASE_SECRET_KEY` fica somente no backend. Nao coloque essa chave no Netlify do frontend.

### Especies extras

As 6 especies base (`jaguar`, `maned_wolf`, `armadillo`, `macaw`, `capuchin`, `coati`) ficam liberadas para todos.

Qualquer especie futura fora da lista base so pode ser escolhida se a tabela `entitlements` tiver uma linha do usuario com um destes formatos:

```text
user_id = auth user id
type/item_type/entitlement_type/kind/category = species
key/item_key/entitlement_key/species_id/item_id = <speciesId>
```

Tambem sao aceitos valores `species:<speciesId>`, `species_<speciesId>` ou `species-<speciesId>`. Linhas com `active=false`, `enabled=false` ou `revoked=true` sao ignoradas.

### Estado atual

- Salas online por codigo, acoes validadas no servidor.
- Jogador reconecta com a identidade da conta Supabase; ao atualizar a pagina volta para a ultima sala.
- Fim de jogo apos 5 rodadas com pontuacao final (maioria de recursos, semente 2:1, limite e desempate).
- Turno de jogador desconectado e pulado automaticamente apos `TURN_TIMEOUT_MS`.
- Salas persistidas em SQLite (`DB_PATH`) enquanto o servidor estiver vivo.

Escala: uma instancia de servidor (SQLite local). Para producao com persistencia real, usar disco dedicado ou trocar o store por Redis/Postgres.
