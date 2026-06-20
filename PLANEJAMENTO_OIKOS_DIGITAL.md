# Planejamento de Desenvolvimento - Oikos Digital Multiplayer

Fonte principal atualizada: `C:/Users/Everton/Downloads/GDD_Oikos_Digital_6_Especies_atualizado_movimentos.docx`

Data do levantamento: 2026-05-13

## 0. Diretrizes de Fluxo de Trabalho

- **Sempre subir as alterações para o GitHub.** Após cada modificação/atualização concluída, fazer `git commit` e em seguida `git push` para `main`, sem aguardar confirmação. O repositório remoto deve refletir o estado local a todo momento.
- Mensagens de commit em formato Conventional Commits (`feat`, `fix`, `refactor`, `test`, `docs`...).
- Rodar `npm run typecheck` e `npm run test` antes de subir, quando aplicável.
- Nunca usar `--no-verify` nem pular hooks; corrigir a causa raiz de falhas.

## 1. Objetivo do Projeto

Criar um port digital multiplayer fiel ao jogo de tabuleiro Oikos, seguindo 100% o GDD fornecido e sem adicionar regras, modos, espécies, cartas ou efeitos que não estejam documentados ou aprovados.

O produto final deve entregar:

- Partidas online por turnos para 2 a 6 jogadores.
- Seis espécies jogáveis: Onça-pintada, Lobo-guará, Tatu-bola, Arara-azul, Macaco-prego e Quati.
- Floresta central expansível por cartas.
- Setup inicial 3x3.
- Ações obrigatórias em ordem alfabética por espécie.
- Validação automática de regras.
- Servidor autoritativo.
- Interface bonita, intuitiva e clara, mas sempre subordinada às regras do GDD.
- Tutorial e feedback visual para reduzir erros de interpretação.
- Pontuação final com maioria de recursos e desempate por recursos restantes.

Fora do escopo inicial, conforme o GDD:

- Cartas de objetivo.
- Cartas de cenário.
- Cartas de ameaça.
- Modo Todos contra 1.
- Predador compartilhado.
- Espécies além das seis listadas.
- Compra de cartas durante a partida.
- Descarte voluntário, troca de cartas ou reposição.
- Fim antecipado por baralho, pontuação, eliminação, recursos ou tamanho da floresta.

## 2. Inventário Atual de Assets

Pasta analisada: `C:/Users/Everton/Desktop/oikos digital`

Assets encontrados:

- `boards`: 6 PNGs de tabuleiros individuais, todos com 1906x858.
- `cartas floresta`: 40 PNGs de cartas, todos com 886x886.
- `meeples`: 6 PNGs, um por espécie.
- `recursos`: 5 PNGs: Carne, Fruta, Ovo, Pinha e Ponto.

Detalhe importante das cartas:

- 36 cartas são cartas comuns de floresta: 12 `bosque`, 12 `campos`, 12 `rios`. Suficiente para distribuir 6 cartas para cada uma das 5 espécies que usam cartas em uma partida de 6 jogadores (5 × 6 = 30, sobram 6).
- A floresta inicial usa 9 cartas: 3 rios de face dupla (ovo, pinha, carne) + 6 de terra (bosque/campo). Cada rio é frente/verso da mesma carta física, então a frente e o verso de um rio nunca aparecem juntos; toda floresta inicial sempre tem exatamente 1 rio de ovo, 1 de pinha e 1 de carne. As 12 definições de carta inicial em `packages/content/src/cards.ts` cobrem essas 9 cartas (3 frentes de rio + 3 versos + 6 de terra).
- A partida começa montando a grade 3x3 a partir de uma das 18 mesas de rio pré-validadas em `packages/rules/src/initialForest.ts` (`FOREST_TEMPLATES`), sorteada no início. Cada mesa garante que toda boca de rio conecta com outra boca ou sai pela borda do grid, nunca encosta em mata, e usa exatamente uma face de cada rio (validado na carga do módulo). A posição das 6 cartas de terra também é sorteada por partida (6! = 720 arranjos por mesa), dando 18 × 720 = 12.960 florestas iniciais possíveis.

Status dos manifestos:

- Manifestos de cartas, espécies, recursos e padrões de movimento já estão transcritos em `packages/content/src` e `packages/rules/src`.
- Sites internos por carta ainda são modelados como `main` único; sublocais finos por carta entram em iteração posterior se confirmados pelo GDD.

## 2.1 Movimentos Conferidos

O GDD atualizado inclui o Apêndice A com a transcrição dos padrões de movimento. A transcrição foi conferida visualmente contra os tabuleiros em `boards` e bate com as imagens.

Tipos de movimento:

- `adjacent`: adjacente.
- `diagonal`: diagonal.
- `straight_jump`: salto reto.
- `knight_jump`: salto em curva.

Tabela validada por espécie:

| Espécie | Bosque / Floresta | Campo | Rio / Água |
| --- | --- | --- | --- |
| Onça-pintada | Salto em curva | Diagonal | Salto reto |
| Lobo-guará | Salto reto | Adjacente | Diagonal |
| Tatu-bola | Adjacente | Diagonal | Salto reto |
| Arara-azul | Salto em curva | Adjacente | Salto reto |
| Macaco-prego | Salto reto | Salto em curva | Diagonal |
| Quati | Salto reto | Diagonal | Adjacente |

Regra especial:

- A Onça-pintada não usa carta de floresta. Na Ação B, o habitat usado é o da carta onde a Onça está localizada antes do movimento.

## 3. Princípios de Fidelidade

1. O servidor é a fonte da verdade.
2. O cliente envia intenções, nunca altera estado definitivo sozinho.
3. Toda regra implementada deve estar rastreada para uma seção do GDD ou para uma confirmação posterior.
4. O cliente pode pré-visualizar movimentos e pontos, mas o servidor confirma e aplica.
5. Ações obrigatórias não podem ser puladas se forem possíveis.
6. Ações impossíveis são registradas no histórico e puladas automaticamente.
7. Informações privadas, como mão de cartas, nunca são enviadas para outros jogadores.
8. Recursos são marcadores dos jogadores e nunca saem das cartas.
9. Não há limite de ocupação por carta.
10. Espécies ausentes não contam para setup, turno, pontuação ou efeitos.

## 4. Stack Técnico Recomendado

Decisão técnica proposta, sem alterar regra de jogo:

- Monorepo em TypeScript.
- `apps/web`: React + Vite para lobby, HUD, painéis, tutorial, pontuação final e controles.
- `apps/web`: Phaser 3 para a floresta central, cartas, meeples, câmera, drag/hover, destaques e animações 2D.
- `apps/server`: Node.js + Fastify + Socket.IO para salas multiplayer por turnos.
- `packages/rules`: motor de regras puro em TypeScript, sem dependência de UI.
- `packages/content`: definições JSON de espécies, cartas, recursos, assets e movimentos.
- `packages/shared`: tipos compartilhados entre cliente e servidor.
- Testes: Vitest para regras, Playwright para fluxos multiplayer e UI.

Motivo:

- O jogo é 2D, baseado em cartas e peças.
- O GDD exige muita UI textual e validação, então React é melhor para painéis e tutorial.
- Phaser é adequado para manipulação visual da floresta, peças, destaques e animações.
- O motor de regras separado garante fidelidade, testes e servidor autoritativo.

## 4.1 Autenticacao, Perfil e Monetizacao

Estado implementado em junho de 2026:

- O jogo exige login antes de qualquer tela jogavel. A entrada passa por `AuthGate` e usa Supabase Auth com email/senha.
- A confirmacao de email fica ligada. A tela de login/criacao mostra erro quando o email nao foi confirmado e oferece reenvio de confirmacao.
- O redirect de confirmacao usa `window.location.origin`, entao funciona em `http://localhost:5187`, `https://oikosdigital.com.br` e dominio de deploy.
- O frontend usa Supabase project URL `https://ysqpiutokbxpcwlieqax.supabase.co` e publishable key publica.
- A secret key fica somente no backend/local env. Nunca colocar `service_role` no frontend nem em arquivo publico.
- O Socket.IO envia o access token do Supabase e o backend valida o usuario antes de aceitar eventos do jogo.
- Link publico fixo do jogo: `https://oikosdigital.com.br/`.
- Em producao, `https://oikosdigital.com.br/` usa `https://api.oikosdigital.com.br` como servidor.
- Links `*.trycloudflare.com` sao somente backend temporario de teste quando este PC precisa servir uma sessao local. Quando usados, entram apenas como query `?server=` em `https://oikosdigital.com.br/`.
- O backend `/health` da API de producao ja foi validado.

Arquivos principais:

- `apps/web/src/auth/AuthGate.tsx`: tela obrigatoria de entrar/criar conta, confirmacao e reenvio.
- `apps/web/src/auth/supabase.ts`: cliente Supabase do frontend.
- `apps/web/src/auth/ProfilePanel.tsx`: tela de perfil do jogador.
- `apps/web/src/socket.ts`: conexao Socket.IO com token e URL de producao.
- `apps/server/src/supabaseAuth.ts`: validacao do access token no backend.
- `apps/server/src/index.ts`: conexao autenticada e eventos do servidor.
- `apps/server/src/progressStore.ts`: leitura/escrita de progresso por usuario.
- `apps/server/src/speciesAccess.ts`: validacao de especies base e especies liberadas.
- `supabase/user_progress.sql`: tabela para progresso persistente.
- `supabase/entitlements_permissions.sql`: grants/policies para liberar leitura server-side de entitlements.

Dados persistidos agora:

- Perfil basico do jogador (`profiles` no Supabase).
- Progresso por jogador em `user_progress`, incluindo tutorial feito e preferencias futuras.
- Portrait escolhido no perfil via chave `profile_portrait_species`.
- Especies liberadas por conta via `entitlements`.

Regras atuais de especies:

- Todo jogador tem 6 especies base de graca: `jaguar`, `maned_wolf`, `armadillo`, `macaw`, `capuchin`, `coati`.
- Especies extras sao uso individual. Se um jogador comprou, somente ele pode selecionar.
- Ter especie extra nao da vantagem mecanica; serve para variedade.
- Ao selecionar especie, o backend confere se ela e base ou se existe entitlement ativo para aquele usuario.
- Skins e portraits seguem a mesma logica futura: ficam vinculados a conta, nao a sala.

Pendencias importantes:

- Rodar `supabase/entitlements_permissions.sql` no SQL Editor caso ainda exista erro `permission denied for table entitlements`.
- Criar fluxo real de compra/liberacao: pagamento -> webhook/backend -> insert em `entitlements`.
- Definir catalogo de especies extras, skins de meeple e portraits.
- Criar loja dentro do jogo usando apenas dados que o backend confirma como liberados.
- Criar missoes diarias, passe de batalha e pontos gratuitos usando `user_progress`/novas tabelas.
- Melhorar email transacional do Supabase com dominio/remetente proprio quando sair de teste.

## 5. Arquitetura de Estado

O modelo deve seguir o GDD:

- `GameState`
- `PlayerState`
- `SpeciesDefinition`
- `PieceState`
- `ForestCardState`

Camadas principais:

- `ContentRegistry`: carrega espécies, cartas, recursos, assets e padrões de movimento.
- `RulesEngine`: valida e aplica intenções.
- `ActionPipeline`: executa ações em etapas validáveis.
- `PassiveEngine`: dispara passivas por eventos.
- `ScoringEngine`: calcula pontuação de ação, pontuação final e desempate.
- `TurnManager`: controla setup, ordem de turno, rodada, ações e fim de jogo.
- `VisibilityProjector`: cria visões públicas e privadas para cada jogador.
- `GameLog`: registra eventos relevantes do GDD.

Exemplos de intenções enviadas pelo cliente:

- `selectSpecies`
- `setReady`
- `placeInitialPiece`
- `selectForestCard`
- `rotateForestCard`
- `placeForestCard`
- `selectPiece`
- `movePiece`
- `addPiece`
- `removePiece`
- `spendResources`
- `resolvePassiveChoice`
- `confirmActionStep`

Nenhuma intenção deve ser aplicada sem validação do servidor.

Organização de módulos (resultado da rodada de refatoração):

- Regras (`packages/rules/src`): `setup.ts` reexporta a API pública; criação de partida em `createGame.ts`, floresta inicial em `initialForest.ts`, movimentação em `movementActions.ts`. Bots divididos em `bots.ts` (orquestração), `botScoring.ts` (avaliação), `botSmart.ts`/`botRandom.ts`/`botShared.ts` (decisões por família).
- Web — tela (`apps/web/src/screens`, `ui`, `hooks`): `OikosApp.tsx` é casca de orquestração (~2764 linhas pós-Rodada 5); helpers em `OikosApp.helpers.tsx`; HUD e diálogos em componentes presentacionais sob `ui/`. Hooks extraídos: socket e polling em `useOikosSocket.ts`/`useOpenRoomsPolling.ts`; formulário de lobby em `useLobbyForm.ts`; toggles de painel em `usePanelState.ts`; efeitos transitórios/feedback em `useGameFeedback.ts`; seleção de ação em `useActionSelection.ts`; handlers simples de ação em `useSimpleActionHandlers.ts`; handlers de resolução com seleção em `useSelectionResolutionHandlers.ts`; handlers de objetivo/mini-expansão em `useObjectiveExpansionHandlers.ts`; handlers de Caça Ilegal em `useCacaIlegalHandlers.ts`; dispatchers de configuração de sala em `useRoomSettingsHandlers.ts`; observador de diff de turno (banner, ganhos flutuantes, travel effects, recap) em `useTurnTransitionEffects.ts`; handlers de colocação de carta em `useBoardCardHandlers.ts`; handlers de peça/score em `useBoardPieceHandlers.ts`; ciclo de vida local/tutorial (incl. loop de bot) em `useLocalGameHandlers.ts`; máquina de sala online (refs de sync, `applyOnlineRoomState`, `clearRoomState`/`resetRoomUiState` e o boundary local/online `run`) em `useOnlineRoom.ts`; utilitários de overlay de tabuleiro (`showMovementPreview`, `setEffectTarget` + mapa de targets de travel effects, `toggleExpansionPreview`) em `useBoardOverlays.ts`. Permanece em `OikosApp.tsx` o `spectate` (depende do socket vivo; reutiliza os refs/funções de `useOnlineRoom`). Quebra do bloco de JSX de render em subcomponentes em andamento (`OikosApp.tsx` ~2826 → ~2173 linhas): painéis de narração de score (macaw/capuchin) em `ui/ScoreAnimationPanels.tsx`; telas pré-jogo de criar/entrar sala em `screens/CreateRoomScreen.tsx`/`screens/JoinRoomScreen.tsx`; rail+popover de adversários em `screens/OpponentInspector.tsx`; recap do turno anterior em `ui/TurnRecapPanel.tsx`; camada de animação de viagem em `ui/TravelEffectLayer.tsx`; diálogos de objetivo (escolha + preview) em `screens/ObjectiveChoiceDialogs.tsx`; mão de cartas em `screens/TableHand.tsx`. modais de interrupção (Caça Ilegal, Caatinga, Cerrado, ExtraTurn, SeedSpend, MataAtlântica) agrupados em `screens/PendingInterruptDialogs.tsx`; banners de turno/galo da stage em `ui/StageBanners.tsx` (`OikosApp.tsx` agora ~2148 linhas). Testes: smoke de render cobrem Create/Join/OpponentInspector/TurnRecapPanel; `auth/AuthGate.test.tsx` (happy-dom + Testing Library + Supabase mockado) cobre o gate de login abrindo/fechando. controles de HUD top-level (round indicator + clean-board toggle + config) em `ui/HudControls.tsx`; badge de espectador em `ui/SpectatorBanner.tsx`; modais de score Jaguar/Wolf (Ação C) em `screens/SpeciesScoreModals.tsx` (`OikosApp.tsx` agora ~2123 linhas). Segurança: `npm audit fix` non-breaking reduziu 10→1 vulnerabilidade (resta só esbuild low de dev-server, que exige bump major); patcheou ws (runtime Socket.IO) e o advisory crítico do vitest UI. Próximos alvos no mesmo bloco: ExpansionPreviewOverlay/ThreatRevealOverlay já são componentes (só guards inline); restam o painel de mão (`table-hand` já extraído) e a montagem final do `<main>` (className/data-attrs derivados) — candidatos a um hook `useAppShellClass`.
- Web — tabuleiro (`apps/web/src/game`): `ForestPhaserScene.ts` mantém lifecycle/câmera/cartas; câmera em `forestCamera.ts`, partículas em `forestAmbient.ts`, destaques em `forestHighlights.ts`, peças/meeples em `forestPieces.ts`.
- Servidor (`apps/server/src`): `index.ts` mantém wiring de sockets e handlers; timers por sala, persistência debounced e `broadcastRoom` em `roomScheduler.ts` (`RoomScheduler`).

## 6. Roadmap Zero a 100

### Marco 0 - Fechamento de Conteúdo e Lacunas

Objetivo: transformar assets e GDD em dados implementáveis.

Entregas:

- Manifesto de cartas com `cardId`, imagem, habitat, recurso, conexões, rios e rotações legais.
- Manifesto das 9 cartas iniciais (3 rios de face dupla + 6 de terra).
- Regra aprovada para montar a grade 3x3 a partir das mesas pré-validadas.
- Manifesto de espécies com categoria, total de peças, peças iniciais, uso de cartas e ações.
- Manifesto de padrões de movimento por espécie e habitat, baseado no Apêndice A do GDD atualizado.
- Conferência da distribuição de cartas para 2 a 6 jogadores.
- Lista final de assets aprovados para uso.

Critério de aceite:

- Nenhum dado de regra fica implícito apenas na imagem.
- Os padrões de movimento usam o GDD atualizado e foram conferidos contra os tabuleiros.
- A partida de 6 jogadores consegue distribuir as mãos por uma regra aprovada e fiel ao jogo físico.

### Marco 1 - Fundação Técnica

Objetivo: criar a base do projeto sem implementar regras complexas ainda.

Entregas:

- Monorepo TypeScript.
- Aplicação web com tela inicial, lobby visual e tela de jogo vazia.
- Servidor com criação de sala e conexão por Socket.IO.
- Pacote de tipos compartilhados.
- Pacote inicial de regras com estado serializável.
- Pipeline de assets carregando imagens por manifesto.
- Testes automatizados rodando em CI local.

Critério de aceite:

- Um jogador cria sala.
- Outro jogador entra por código/link.
- O servidor mantém um estado de sala.
- Cliente recebe estado renderizável.

### Marco 2 - Núcleo Jogável Local

Objetivo: implementar o esqueleto completo de uma partida, ainda com foco no fluxo geral.

Entregas:

- Seleção de espécies sem repetição.
- Validação de 2 a 6 jogadores.
- Ordem de setup por menor total de peças:
  Onça, Lobo, Tatu, Arara, Macaco, Quati, ignorando ausentes.
- Floresta inicial 3x3.
- Posicionamento inicial livre.
- Ganho de recurso no setup ao posicionar peça.
- Ordem de turno por maior total de peças:
  Quati, Macaco, Arara, Tatu, Lobo, Onça, ignorando ausentes.
- Mãos iniciais de 6 cartas para espécies que usam cartas.
- Onça sem mão de cartas.
- Expansão da floresta com rotação.
- Validação de adjacência, ocupação de posição, conexões e rios.
- Contador de 5 turnos por jogador.
- Encerramento após o quinto turno do último jogador.
- Pontuação final básica de recursos.

Critério de aceite:

- Uma partida completa pode ir do setup ao fim respeitando duração, ordem e validações gerais.
- Recursos não saem das cartas.
- Não há limite de peças por carta.
- Ações impossíveis são registradas e puladas.

### Marco 3 - Motor de Movimento

Objetivo: implementar movimento fiel por habitat e espécie.

Entregas:

- Padrões de movimento por habitat da carta jogada.
- Movimento especial da Onça pela carta onde ela está.
- Cálculo de destinos legais.
- Destaque visual de destinos legais.
- Regra de peça escondida perder o estado ao se mover.
- Testes para cada espécie e cada habitat.

Critério de aceite:

- O movimento não depende de lógica de tela.
- O servidor rejeita movimento fora do padrão.
- O cliente mostra apenas destinos legais.

### Marco 4 - Implementação das Espécies

Objetivo: implementar as seis espécies exatamente como no GDD.

Ordem recomendada:

1. Onça-pintada
2. Lobo-guará
3. Tatu-bola
4. Arara-azul
5. Macaco-prego
6. Quati

#### Onça-pintada

Entregas:

- Ação A: mover adjacente e remover 1 peça no destino.
- Ação B: mover conforme habitat da carta atual e remover 1 peça no destino.
- Passiva: coletar 1 carne ao remover peça.
- Ação C: gastar até 3 carnes para marcar até 3 pontos.
- Proteção contra remoção de peças escondidas.

#### Lobo-guará

Entregas:

- Ação A: expandir floresta e mover cada lobo conforme carta jogada.
- Ação B: opcionalmente remover 1 peça de Base no local com lobo.
- Coleta de recurso pelo Lobo e pelo dono da peça removida.
- Ação C: gastar recursos diferentes até a quantidade de lobos em floresta.
- Ação D: adicionar 1 lobo em local de carne.

#### Tatu-bola

Entregas:

- Estado escondido.
- Ação A: expandir e adicionar tatu em local de semente.
- Ação B: mover 1 tatu conforme carta jogada.
- Ação C: esconder qualquer tatu próprio.
- Ação D: marcar 3 pontos menos 1 por espécie adversária em jogo que não compartilhe local com tatu, mínimo 1.

#### Arara-azul

Entregas:

- Ação A: expandir e adicionar arara em local de ovo.
- Ação B: mover 1 arara conforme carta jogada.
- Ação C: adicionar ou realocar outra arara ao redor da arara movida.
- Ação D: marcar 1 ponto por linha reta de 3 araras, horizontal, vertical ou diagonal.

#### Macaco-prego

Entregas:

- Ação A: expandir e adicionar macaco na carta jogada.
- Ação B: mover 1 macaco conforme carta jogada.
- Ação C: adicionar macaco em local com outro macaco.
- Ação D: marcar 1 ponto por tipo de habitat com macacos em 2 ou mais cartas diferentes.

#### Quati

Entregas:

- Passiva: ao formar par exato de 2 quatis, adicionar 1 quati da reserva em local adjacente e marcar 1 ponto.
- Suporte a múltiplos disparos no mesmo turno.
- Ação A: expandir e adicionar quati em local de fruta.
- Ação B: mover 1 quati conforme carta jogada.
- Ação C: se houver menos de 2 quatis na reserva, remover 2 quatis da floresta.
- UI para cadeia de combos pendentes.

Critério de aceite do marco:

- Cada ação possui testes unitários.
- Cada passiva possui testes de gatilho.
- Cada espécie possui pelo menos um teste de turno completo.
- O histórico registra ações, recursos, remoções, pontos e passivas.

### Marco 5 - Multiplayer Autoritativo

Objetivo: tornar o núcleo jogável em multiplayer real.

Entregas:

- Criação de sala.
- Entrada por código/link.
- Estado sincronizado em tempo real.
- Apenas jogador ativo pode executar ações.
- Jogadores inativos acompanham a partida.
- Projeção privada de mão de cartas.
- Reconexão ao estado atual da sala.
- Histórico compartilhado.
- Validação 100% no servidor.

Critério de aceite:

- Dois ou mais navegadores jogam a mesma partida.
- Mão de um jogador não aparece para os demais.
- Ações ilegais enviadas manualmente ao servidor são rejeitadas.
- Jogador desconectado consegue reconectar e retomar.

Ponto pendente do GDD:

- Política de tempo quando o jogador ativo desconecta. O GDD menciona aguardar ou aplicar política configurada, mas não define qual. Sem comando adicional, implementar primeiro "aguardar".

### Marco 6 - UX, Feedback Visual e Tutorial

Objetivo: deixar o jogo bonito, claro e agradável sem criar regras novas.

Entregas:

- Estados visuais de cartas:
  inicial, recém-adicionada, posição válida, posição inválida, habitat, recurso, conexões.
- Estados visuais de peças:
  normal, escondida, movível, removível, protegida.
- Destaque da ação atual.
- Destaque de ações concluídas e impossíveis.
- Prévia de pontuação.
- Histórico de partida legível.
- Painéis por espécie com recursos, ações, passivas e alertas.
- Tutorial modular:
  floresta, expansão, movimento, recursos, pontuação, ordem de turno, espécies e pontuação final.
- Tela de pontuação final com decomposição de pontos.

Critério de aceite:

- Jogador sempre sabe de quem é o turno, qual ação está ativa e quais escolhas são legais.
- A interface explica por que uma ação foi pulada.
- A pontuação final é auditável.

Observação:

- O GDD lista sons em polimento, mas a pasta atual não contém assets de áudio. Sons só devem ser implementados quando houver assets/comando aprovado.

### Marco 7 - Testes, Balanceamento de UX e Robustez

Objetivo: garantir que o jogo está correto e estável.

Entregas:

- Testes unitários de regras.
- Testes de integração de turnos completos.
- Testes de pontuação final.
- Testes de casos de borda do GDD.
- Testes multiplayer com 2, 3 e 6 jogadores.
- Testes de privacidade de mão.
- Testes de reconexão.
- Playtests manuais com roteiro.
- Revisão visual desktop e mobile/tablet.

Casos de borda obrigatórios:

- Sem peças na reserva.
- Sem destino legal.
- Remoção de peça escondida.
- Quati sem reserva.
- Quati sem local adjacente.
- Arara sem referência da Ação B.
- Tatu escondido movido.
- Tatu com poucas espécies em jogo.
- Lobo removendo apenas Base.

Critério de aceite:

- Todos os casos de borda têm teste automatizado ou roteiro manual documentado.
- Nenhuma regra conhecida depende de comportamento visual para funcionar.
- O servidor e o cliente chegam ao mesmo resultado de prévia/aplicação.

### Marco 8 - Preparação de Lançamento

Objetivo: entregar versão jogável completa.

Entregas:

- Build web de produção.
- Servidor configurado para salas.
- Página inicial com Jogar online, Criar sala, Entrar em sala, Tutorial, Regras e Configurações.
- Checklist final de fidelidade contra o GDD.
- Guia rápido de operação.
- Backlog separado apenas para expansões futuras, sem misturar com o escopo inicial.

Critério de aceite:

- Uma partida de 2 a 6 jogadores pode ser criada, jogada até o fim e pontuada.
- Todas as seis espécies funcionam.
- Todas as validações automáticas do GDD estão ativas.
- Não há conteúdo fora do GDD.

## 7. Definição de Pronto

Uma funcionalidade só pode ser considerada pronta quando:

- Está rastreada ao GDD ou a uma confirmação explícita.
- Possui validação no servidor.
- Possui feedback visual no cliente.
- Possui teste automatizado quando for regra.
- Atualiza o histórico quando gerar evento relevante.
- Respeita informações públicas e privadas.
- Funciona após reconexão.
- Não quebra partidas com menos de 6 jogadores.

## 8. Plano de Testes por Área

### Regras

- Setup 3x3.
- Ordem de setup.
- Ordem de turno.
- Mãos iniciais.
- Expansão legal e ilegal.
- Rotações.
- Movimento por habitat.
- Ocupação ilimitada.
- Recursos persistentes nas cartas.
- Ações impossíveis.
- Pontuação final.

### Espécies

- Onça: remoção, carne, gasto de carne e proteção contra escondido.
- Lobo: remoção de Base, coleta dupla, recursos diferentes, adição em carne.
- Tatu: esconder, proteção, perda de escondido ao mover, pontuação por compartilhamento.
- Arara: referência da peça movida, realocação/adicionar, linhas retas.
- Macaco: presença em cartas distintas por habitat.
- Quati: pares exatos, combos, reserva, adjacência e remoção própria.

### Multiplayer

- Apenas jogador ativo age.
- Estado sincronizado.
- Mãos privadas.
- Reconexão.
- Jogadores ausentes ignorados por regras.
- Ações maliciosas rejeitadas.

### UX

- Destaques claros.
- Prévia de pontuação.
- Motivo de ação impossível.
- Histórico auditável.
- Tela final clara.
- Tutorial por espécie.

## 9. Primeira Sprint Recomendada

Objetivo da primeira sprint: sair de "assets soltos + GDD" para "conteúdo validado + fundação técnica".

Tarefas:

1. Criar manifesto de assets.
2. Modelar as 9 cartas iniciais (3 rios de face dupla + 6 de terra).
3. Regra de montagem do grid 3x3 validada pelos templates atuais.
4. Transcrever recursos, habitats, conexões e rios de cada carta.
5. Registrar no manifesto os padrões de movimento já validados pelo GDD atualizado.
6. Criar estrutura do monorepo.
7. Implementar tipos compartilhados.
8. Implementar `GameState` inicial.
9. Implementar criação de sala e entrada básica.
10. Renderizar floresta 3x3 com assets reais.

Resultado esperado:

- Sala criada.
- Jogadores conectados.
- Espécies selecionáveis.
- Floresta inicial aparecendo.
- Conteúdo do jogo carregado por manifesto validado.

## 10. Bloqueadores de Fidelidade Antes do Código de Regra

Resolvidos:

- ~~Como escolher as 9 cartas iniciais, layout 3x3 e rotações.~~ Resolvido por 18 mesas de rio pré-validadas em `FOREST_TEMPLATES` (`packages/rules/src/setup.ts`). Uma mesa é sorteada no início da partida, e a posição das 6 cartas de terra também é sorteada (12.960 florestas possíveis no total). Os 3 rios são de face dupla (ovo, pinha, carne): cada mesa usa exatamente uma face de cada rio, então toda floresta inicial tem 1 rio de cada recurso e nunca a frente e o verso do mesmo rio juntos. Toda mesa é checada na carga do módulo (encaixe de rios + composição) e quebra o build se for inválida.
- ~~Distribuição de mãos em partida com 6 jogadores.~~ Resolvido: a pasta tem 36 cartas comuns (12 bosque + 12 campo + 12 rio), suficientes para 5 espécies × 6 cartas = 30, com sobra de 6 cartas para reposição/cobrir cenários futuros.
- ~~Manifesto completo de cada carta comum.~~ Resolvido em `packages/content/src/cards.ts`.
- ~~Política de desconexão no turno ativo.~~ Resolvido: o servidor pula o turno do jogador desconectado após `TURN_TIMEOUT_MS` (default 90s). O jogador pode reconectar e retomar nas próximas jogadas.

Em aberto:

1. Se os sublocais internos de cada carta (sites finos com recurso/habitat distintos) devem ser modelados ou se cada carta continua como um único site `main`. Hoje o motor trata cada carta como um site só.
2. Se o chat opcional do lobby entra na versão 1.0 ou fica fora.
3. Se haverá assets de som aprovados para o polimento.

Sem esses itens, ainda assim é possível levar o jogo até o lançamento. Eles afetam apenas refinamento de pontuação por sublocal, comunicação no lobby e camada de áudio.
