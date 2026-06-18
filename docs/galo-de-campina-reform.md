# Reforma completa do Galo-de-campina

> Cole este arquivo (ou diga "implemente a reforma do galo-de-campina conforme docs/galo-de-campina-reform.md")
> quando renovar os créditos. Tudo já está decidido — não precisa explicar de novo.

## Objetivo

Reformular o Galo-de-campina **do zero**. Esquecer a versão antiga por completo (passiva de semente,
ações A/B/C/D antigas, pontuação antiga). Implementar os passos novos abaixo + uma mecânica nova
chamada **"entre turnos"**.

## Ficha nova

```
Galo-de-campina
Valor de população: 7   (totalPieces = 7, já é 7)
Peças iniciais: 3       (initialPieces: mudar de 4 para 3)
Tipo: base

Entre turnos
Locais de campo com algum galo-de-campina geram 1 semente em vez do recurso do local.
Quando outra espécie coletar essa semente, mova 1 galo-de-campina desse local para um
local adjacente, sem coletar recurso.

A. Expanda a floresta. Adicione 1 galo-de-campina em um local de campo.
B. Mova 1 galo-de-campina conforme a carta jogada. Se ele terminar em campo, colete 1 semente extra.
C. Atraia uma peça para um local com galo-de-campina conforme a carta jogada.
D. Marque 3 ⭐. Para cada galo-de-campina que não esteja em um campo -1 ⭐.
```

## Decisões já tomadas (NÃO perguntar de novo)

1. **Geração de semente / "entre turnos"**: um local de campo gera 1 semente em vez do recurso
   **somente quando JÁ existe um galo naquele local**. O **primeiro** galo a entrar num campo vazio
   coleta o **recurso normal** do campo. A partir daí, qualquer peça (de qualquer espécie, inclusive
   outro galo) que entrar e coletar nesse campo coleta **semente**. Vale igual para todas as espécies.

2. **Interrupção (entre turnos)**: dispara **apenas quando uma peça que NÃO é galo (outra espécie)
   coleta a semente** num campo que tem galo. Ao disparar:
   - O turno do jogador ativo é **pausado**.
   - O **dono do galo escolhe** (controle fora-de-turno) mover **1 galo daquele local** para um
     **local adjacente** (mesmo padrão de adjacência das regras), **sem coletar recurso** ao mover.
   - Se não houver local adjacente válido (sem espaço ou inexistente), a interrupção é **pulada**
     (galo fica onde está).
   - Mover o galo na interrupção **não** coleta recurso nem dispara nova semente/interrupção.
   - Depois de resolver (ou pular), o **turno do jogador ativo continua** de onde parou.

3. **Passiva antiga**: **removida por completo**. O bônus de +1 semente agora vem **só da ação B**
   (ao terminar em campo). Não existe mais a passiva "mover para local de semente = +1 semente".

4. **Ação C ("atrair")**: atrai **somente peça PRÓPRIA** (do dono do galo). Mover uma peça própria
   para um local que tenha galo, seguindo o padrão da carta jogada.

## Passos detalhados

- **A**: igual ao fluxo atual de expandir floresta e adicionar 1 galo da reserva num local de **campo**.
  (Reaproveitar a lógica existente de `addGaloForCurrentAction`.)
- **B**: mover 1 galo conforme a carta jogada (padrão por habitat). Se o destino for **campo**,
  ganhar **+1 semente extra**. (Atenção: se o destino-campo já tiver outro galo, a coleta normal vira
  semente pela regra "entre turnos"; o "+1 semente extra" da ação B é adicional a isso. Confirmar
  empilhamento na implementação — default: soma.)
- **C**: mover **peça própria** para um local que **contenha galo**, conforme o padrão da carta jogada.
- **D**: marcar **3 ⭐**; para **cada galo que NÃO estiver em campo**, **−1 ⭐**. (Pode ficar negativo?
  Default: piso em 0 — confirmar na implementação; provavelmente não deixar negativo.)

## Arquivos a tocar (mapa do código)

**Conteúdo**
- `packages/content/src/species.ts` (bloco `galo_de_campina`, ~linha 93): `initialPieces` 4→3.

**Estado compartilhado**
- `packages/shared/src/index.ts` (~linha 273): remover pendings antigos do galo
  (`pendingGaloMovedPiece`, `pendingGaloAdjacentAdd`) que não servirem mais; adicionar
  `pendingGaloInterrupt: { ownerId: string; location: GridPosition; interruptedPlayerId: string } | null`
  e os pendings novos necessários para B (mover) e C (atrair própria peça).

**Motor de regras**
- `packages/rules/src/movementActions.ts`:
  - `collectMovementDestinationResource` (~linha 366) é o ponto central. Lógica nova:
    - Detectar se o campo-destino **já tinha** galo ANTES desta coleta. Se sim → recurso coletado
      vira `seed` (qualquer espécie).
    - Se o coletor **não é galo** e há galo no local → setar `pendingGaloInterrupt` (dono do galo).
    - Primeiro galo entrando em campo vazio → recurso normal, sem semente, sem interrupção.
    - Remover todo o código da passiva antiga (`galoSeedBonus`, logs `galo_seed_bonus`).
- `packages/rules/src/species/galo.ts`: reescrever. Manter/adaptar `addGaloForCurrentAction` (ação A).
  Criar handlers novos: mover galo (B, com +1 semente se terminar em campo), atrair peça própria (C),
  pontuar (D: 3 − nº de galos fora de campo), e `resolveGaloInterruptMove` (dono move 1 galo do
  local da interrupção para adjacente, sem coletar). Remover `scoreGaloSeedCards`, presença em
  sementes, `getGaloAdjacentAddPositions` antigo etc. que não servirem.
- `packages/rules/src/turn.ts`:
  - `advanceActiveAction` e `rotateToNextPlayer`/`finishPlayerTurn`: enquanto `pendingGaloInterrupt`
    estiver setado, **pausar** (igual ao padrão de `caatingaPending`/`cerradoPending` no início de
    `advanceActiveAction`, ~linha 26). Após o dono resolver a interrupção, retomar o turno do
    `interruptedPlayerId`.

**Servidor (ação fora-de-turno)**
- `apps/server/src/speciesAccess.ts`, `apps/server/src/index.ts`, `apps/server/src/rooms.ts`:
  permitir que o **dono do galo** chame `resolveGaloInterruptMove` mesmo **não sendo o jogador ativo**
  (autorização especial quando `pendingGaloInterrupt.ownerId === jogador`).

**UI**
- `apps/web/src/ui/actionDescriptions.ts` (~linha 33): trocar descrições A/B/C/D e a passiva
  (`getPassiveDescription`, ~linha 40) → descrever o "entre turnos".
- `apps/web/src/ui/SpeciesActionHud.tsx`, `SpeciesHudShell.tsx`: prompts dos passos novos +
  prompt da interrupção mostrado ao **dono do galo durante o turno de outro jogador**.
- `apps/web/src/hooks/boardInteractionTargets.ts` / `useBoardInteractionTargets` / handlers
  (`useBoardPieceHandlers.ts`, `useSimpleActionHandlers.ts`): alvos clicáveis dos passos novos +
  alvos da interrupção (locais adjacentes válidos).
- `apps/web/src/hooks/scoringPreview.ts` e `activeScoringState.ts`: preview da pontuação D nova.

**Bots**
- `packages/rules/src/botRandom.ts`, `botSmart.ts`, `botScoring.ts`, `bots.ts`: tratar passos novos
  + resolver a interrupção (mover galo para adjacente quando bot for o dono).

**Testes**
- `packages/rules/src/speciesRules.test.ts`, `setup.test.ts`, `apps/web/src/hooks/scoringPreview.test.ts`,
  `activeScoringState.test.ts`, `useBoardInteractionTargets.test.ts`, `apps/web/src/ui/SpeciesActionHud.test.tsx`,
  `SpeciesHudShell.test.tsx`: remover casos da versão antiga, adicionar:
  - primeiro galo em campo vazio coleta recurso normal;
  - segundo coletor (qualquer espécie) coleta semente;
  - coletor não-galo dispara interrupção; dono move galo p/ adjacente sem coletar;
  - sem adjacente válido → interrupção pulada;
  - turno do jogador ativo retoma após interrupção;
  - ação B +1 semente ao terminar em campo;
  - ação C move só peça própria para local com galo;
  - ação D = 3 − galos fora de campo.

## Estratégia de implementação (2 fases)

1. **Fase 1 — motor**: content + shared + rules + turn + testes de regras. Verificar com
   `typecheck` + testes do pacote `rules`.
2. **Fase 2 — interface/online/bots**: servidor (ação fora-de-turno) + UI/HUD + handlers + bots +
   testes de UI. Verificar boot + typecheck + build (smoke gated por login — ver memória
   `project_oikosapp_smoke`).

## Pontos a confirmar na hora de implementar (decidir default se eu não responder)

- Empilhamento da semente na ação B quando o campo-destino já tem galo (default: somar).
- Pontuação D pode ficar negativa? (default: piso 0).
- Na interrupção, se houver vários galos no local, mover qual? (default: determinístico — escolha do
  dono na UI; bot pega o primeiro por id).
