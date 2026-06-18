# Plano de Refatoracao Oikos Digital

## Objetivo

Preparar o Oikos Digital para crescer com novos modos de jogo, novas especies, novos tutoriais e novas expansoes sem multiplicar alteracoes espalhadas pelo web, servidor e regras.

Este plano nao e uma reescrita. A base atual esta saudavel: `typecheck` e testes passam. A refatoracao deve ser incremental, mas cada ciclo precisa entregar mudanca significativa, com validacao local e online antes de seguir.

## Diagnostico Atual

Pontos fortes:

- Regras ja ficam separadas em `packages/rules`.
- Conteudo fica em `packages/content`.
- Tipos compartilhados ficam em `packages/shared`.
- Servidor e autoritativo no multiplayer.
- Ha boa cobertura de testes em regras, servidor, hooks e UI.

Pontos que vao dificultar expansao:

- `apps/web/src/screens/OikosApp.tsx` ainda concentra muita orquestracao e um bloco grande de render.
- `apps/server/src/rooms.ts` mistura ciclo de sala, lobby, configuracoes, mutacoes de jogo, bots e cenarios.
- Nova especie exige alteracoes em muitos lugares: tipos, conteudo, regras, bot smart, bot random, servidor, socket, hooks, HUD e tutorial.
- Acoes online ainda estao muito especificas por especie, como `coati:add`, `macaw:score`, `wolf:spend-resources`.
- Tutorial usa ids fixos por especie e tende a crescer com unions e registros manuais.
- Modos de jogo futuros ainda nao tem uma camada propria para setup, regras ativas, duracao, expansoes, bots e tutorial inicial.

## Principios

- Refatorar mantendo comportamento atual.
- Nunca quebrar paridade local/online.
- Cada ciclo deve terminar com `npm.cmd run typecheck` e `npm.cmd run test`.
- Mudancas significativas em blocos grandes, nao microtarefas soltas.
- Antes de remover APIs antigas, criar compatibilidade ou migrar todos os usos.
- Toda nova arquitetura precisa ser usada por pelo menos uma especie, modo ou fluxo real no mesmo ciclo.
- Evitar abstracao vazia: registry ou pipeline so entra se reduzir alteracoes futuras.

## Validacao Manual

Conta de teste:

- Email: `taciano_neto@hotmail.com`
- Senha: usar a senha informada no chat, preferencialmente via variavel local `OIKOS_TEST_PASSWORD`.

Importante: nao salvar senha real em arquivos versionados. Para testes automatizados ou manuais, usar `.env.local`, variavel de ambiente, gerenciador de senhas ou entrada manual no navegador.

Fluxos manuais obrigatorios por ciclo:

- Login Supabase com a conta de teste.
- Partida local com bots.
- Sala online criada pelo usuario logado.
- Entrada/reconexao na sala.
- Pelo menos uma acao de carta, movimento, pontuacao e fim de turno.
- Quando o ciclo tocar tutorial: abrir tutorial inicial e um tutorial por especie afetada.
- Quando o ciclo tocar modos: criar partida em cada modo disponivel.

Comandos base:

```bash
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

## Ciclo 1 - Registry de Especies e Acoes

Objetivo: adicionar ou alterar uma especie tocando um modulo principal, nao varios arquivos espalhados.

Status atual: em andamento. Bloco concluido nesta rodada:

- Criado `SpeciesModule` em `packages/rules/src/speciesModules.ts`.
- Registry cobre todas as especies de `packages/content`.
- Cada modulo agora centraliza:
  - `speciesId`
  - regras existentes de `speciesRules`
  - descritores de acoes com `requiresForestCardBeforeAction`
  - hooks de bot smart/random
  - hook de movimento pendente do Lobo-guara
- `packages/rules/src/bots.ts` nao usa mais `switch` central por especie para escolher bot smart/random.
- `getCurrentAction` passou a retornar `ActionId | null`, alinhando o contrato real usado pelos bots.
- Exports antigos de `botSmart.ts` e `botRandom.ts` foram preservados para compatibilidade temporaria.
- Testes do registry foram ampliados para garantir cobertura de especies, acoes e hooks de bot.

Entregas pendentes:

- Completar o `SpeciesModule` com:
  - validadores de alvos
  - aplicadores de acao
  - efeitos passivos
  - pontuacao de acao
  - metadados de UI necessarios
- Consolidar funcoes como `addCoatiForCurrentAction`, `scoreMacawLines`, `hideArmadilloForCurrentAction` em descritores de acao.
- Remover decisoes por especie restantes em `botScoring.ts` onde o registry reduzir duplicacao sem piorar legibilidade.
- Migrar pelo menos uma familia de aplicadores/validadores de acao para o registry em ciclo seguinte.
- Manter exports antigos temporariamente ate os consumidores migrarem.

Arquivos-alvo:

- `packages/rules/src/speciesRules.ts`
- `packages/rules/src/species/*.ts`
- `packages/rules/src/setup.ts`
- `packages/rules/src/bots.ts`
- `packages/rules/src/botSmart.ts`
- `packages/rules/src/botRandom.ts`
- `apps/web/src/screens/OikosApp.helpers.tsx`

Validacao:

- Feito nesta rodada:
  - `npm.cmd run typecheck` antes das mudancas: passou.
  - `npm.cmd run test --workspace @oikos/rules -- speciesRules.test.ts`: passou.
  - `npm.cmd run typecheck`: passou.
  - `npm.cmd run test`: passou, incluindo `apps/server/src/bots.test.ts`.
  - `npm.cmd run build`: passou.
  - Smoke manual local com login ja autenticado na conta de teste: partida local com Lobo-guara e Quati controlados por bots avancou pelo setup automatico ate a fase ativa, com canvas renderizado e sem erros visiveis.
  - Smoke manual online local: sala `GA4CY` criada no servidor local, Lobo-guara selecionado pelo usuario, Quati adicionado como bot, partida iniciada, canvas renderizado e reconexao por reload voltou para a mesma sala sem erros visiveis.
- Pendencias reais de validacao manual:
  - Jogada manual completa de carta, movimento, pontuacao e fim de turno no canvas online nao foi executada nesta rodada; a cobertura automatizada de regras/servidor passou e o smoke online validou criacao, inicio e reconexao.
  - Confirmacao visual de todas as especies selecionaveis/jogaveis ficou limitada ao lobby local/online; nao foi feita uma partida manual por cada especie.

Aceite:

- Nova especie simples pode ser esbocada criando modulo e registro.
- Bots nao dependem de `switch` central para todo comportamento por especie.
- Acoes de especie tem contrato comum.

## Ciclo 2 - Protocolo Unificado de Intencoes de Jogo

Objetivo: reduzir duplicacao entre local, socket client e servidor.

Entregas:

- Criar tipo compartilhado `GameIntent` em `packages/shared`.
- Criar aplicador autoritativo em `packages/rules` ou camada fina do servidor:
  - `applyGameIntent(game, playerId, intent)`
  - validacao centralizada de payload
  - erro claro para intencao invalida
- Criar evento online unico para acoes de jogo, por exemplo `game:intent`.
- Manter eventos antigos por compatibilidade durante migracao.
- Migrar web para usar dispatcher comum:
  - local: aplica intent direto no estado local
  - online: envia intent ao servidor
- Reduzir `roomApi` especifico por especie.

Arquivos-alvo:

- `packages/shared/src/index.ts`
- `packages/rules/src/setup.ts`
- `apps/web/src/socket.ts`
- `apps/server/src/index.ts`
- `apps/server/src/rooms.ts`
- `apps/web/src/hooks/useSimpleActionHandlers.ts`
- `apps/web/src/hooks/useSelectionResolutionHandlers.ts`
- `apps/web/src/hooks/useBoardPieceHandlers.ts`
- `apps/web/src/hooks/useBoardCardHandlers.ts`

Validacao:

- Testes de servidor cobrindo `game:intent`.
- Testes existentes de hooks.
- Partida online com carta, movimento, remocao, pontuacao, passiva e fim de turno.

Aceite:

- Para criar uma acao nova, nao precisa criar evento socket novo especifico.
- Local e online compartilham o mesmo formato de intencao.

## Ciclo 3 - Separacao de `rooms.ts` e Ciclo de Sala

Objetivo: deixar servidor facil de evoluir para modos, lobby avancado, espectadores e persistencia futura.

Entregas:

- Quebrar `apps/server/src/rooms.ts` em modulos:
  - `roomLifecycle.ts`: criar, entrar, sair, expulsar, espectar, remover.
  - `roomSettings.ts`: bots, timer, expansoes, modo, senha, cenarios.
  - `roomGameActions.ts`: aplicacao de intents e mutacoes de jogo.
  - `scenarioVotingRoom.ts`: votacao e selecao de cenarios.
  - `roomPublicView.ts`: conversao para `PublicRoomState`.
  - `rooms.ts`: fachada publica temporaria.
- Manter API externa igual para nao mexer no socket inteiro no mesmo passo, exceto partes ja migradas no Ciclo 2.
- Fortalecer testes de salas com foco em regressao.

Arquivos-alvo:

- `apps/server/src/rooms.ts`
- `apps/server/src/index.ts`
- `apps/server/src/roomScheduler.ts`
- `apps/server/src/rooms.test.ts`
- `apps/server/src/projection.test.ts`

Validacao:

- Testes de servidor.
- Criar sala online, reconectar, spectate, add/remove bot, timer de turno.
- Verificar projecao por jogador: maos e decks continuam ocultos.

Aceite:

- Nenhum arquivo de servidor passa de responsabilidade ampla demais.
- Nova configuracao de modo entra em `roomSettings`, nao em bloco gigante.

## Ciclo 4 - Camada de Modos de Jogo

Objetivo: criar base para novos modos sem alterar diretamente setup e estado global toda vez.

Entregas:

- Criar `GameModeDefinition`:
  - `modeId`
  - nome publico
  - numero de jogadores permitido
  - rodadas
  - expansoes padrao
  - regras de deck/setup
  - regras de pontuacao/fim de jogo
  - bots permitidos
  - tutorial recomendado
- Adicionar `gameModeId` ao estado de sala/jogo com migracao segura.
- Criar registry de modos com modo atual como `classic`.
- Mover defaults atuais para definicao do modo classico.
- Preparar UI do lobby para selecionar modo sem implementar modos novos ainda, se fizer sentido.

Arquivos-alvo:

- `packages/shared/src/index.ts`
- `packages/rules/src/createGame.ts`
- `packages/rules/src/setup.ts`
- `packages/rules/src/endgame.ts`
- `apps/server/src/rooms.ts` ou novos modulos do Ciclo 3
- `apps/web/src/screens/LocalSetupScreen.tsx`
- `apps/web/src/screens/LobbyScreen.tsx`
- `apps/web/src/screens/preGameOptions.ts`

Validacao:

- Testes de setup e fim de jogo.
- Partida classica local e online.
- Persistencia/reconexao mantendo `gameModeId`.

Aceite:

- Novo modo pode ser criado como definicao registrada.
- Modo classico continua identico.

## Ciclo 5 - Quebra Significativa do `OikosApp`

Objetivo: transformar `OikosApp` em composicao legivel, reduzindo risco de mexer em uma tela gigante.

Entregas:

- Extrair camadas renderizadas:
  - `GameScreen`
  - `HudLayer`
  - `BoardLayer`
  - `ModalLayer`
  - `MobilePanels`
  - `TutorialLayer`
  - `RoomStatusLayer`
- Criar um `OikosAppViewModel` ou hook agregador para props derivadas.
- Manter hooks existentes, mas reduzir passagem excessiva de props quando houver agrupamentos claros.
- Separar render de estado/orquestracao.
- Nao mudar visual neste ciclo, exceto ajustes pequenos causados pela extracao.

Arquivos-alvo:

- `apps/web/src/screens/OikosApp.tsx`
- `apps/web/src/screens/OikosApp.helpers.tsx`
- `apps/web/src/ui/*`
- `apps/web/src/hooks/*`

Validacao:

- Testes de UI existentes.
- Smoke manual desktop e mobile.
- Tutorial aberto, lobby, partida local, partida online.

Aceite:

- `OikosApp.tsx` cai drasticamente de tamanho.
- Render fica dividido por camada visual.
- Mudancas futuras de HUD ou modal nao exigem navegar por milhares de linhas.

## Ciclo 6 - Tutorial Data-Driven

Objetivo: adicionar tutorial novo sem mexer em unions e registros centrais a cada especie.

Entregas:

- Criar `TutorialDefinition` com:
  - `tutorialId`
  - especie opcional
  - modo opcional
  - passos
  - factory de sala local
  - criterios de conclusao
  - dependencias de assets
- Criar registry de tutoriais.
- Migrar tutoriais atuais para arquivos registrados.
- Permitir tutorial por modo e por especie.
- Reduzir unions fixas como `TutorialId` sempre que possivel, mantendo type safety via registry.

Arquivos-alvo:

- `apps/web/src/ui/tutorials/types.ts`
- `apps/web/src/ui/tutorials/index.ts`
- `apps/web/src/ui/tutorials/*.ts`
- `apps/web/src/hooks/useTutorialController.ts`
- `apps/web/src/ui/TutorialChapterSelect.tsx`
- `apps/web/src/screens/OikosApp.helpers.tsx`

Validacao:

- Testes de tutorial existentes.
- Rodar tutorial inicial e pelo menos 2 tutoriais de especie.
- Confirmar progresso Supabase da conta de teste.

Aceite:

- Novo tutorial entra como definicao registrada.
- Tutorial pode apontar para modo, especie ou fluxo geral.

## Ciclo 7 - Conteudo e Assets como Manifesto Forte

Objetivo: reduzir dependencia de paths e nomes manuais, preparando especies extras e skins.

Entregas:

- Criar manifestos de assets por dominio:
  - especies
  - meeples
  - portraits
  - boards
  - movimento
  - cartas
  - UI
- Validar manifestos em build/test.
- Criar helper para resolver assets por chave, nao por string solta.
- Preparar campo de variante/skin por especie, mesmo que ainda nao usado.
- Conferir `scripts/sync-assets.mjs` para gerar/validar saida esperada.

Arquivos-alvo:

- `packages/content/src/species.ts`
- `packages/content/src/cards.ts`
- `packages/content/src/resources.ts`
- `scripts/sync-assets.mjs`
- `apps/web/src/ui/meeples.tsx`
- `apps/web/src/ui/movementArt.ts`

Validacao:

- `npm.cmd run build`.
- Verificar todas as imagens principais no jogo.
- Abrir selecao de especie, tabuleiro, HUD e tutoriais.

Aceite:

- Asset faltante quebra teste/build com erro claro.
- Nova especie nao depende de lembrar path manual em varios pontos.

## Ciclo 8 - Testes de Regressao por Fluxo

Objetivo: garantir que mudancas grandes continuem seguras.

Entregas:

- Criar cenarios de teste de alto nivel:
  - setup completo
  - turno completo por especie
  - passivas principais
  - fim de jogo
  - sala online com projecao
  - tutorial principal
- Criar fixtures legiveis para estados de jogo.
- Reduzir tamanho de `setup.test.ts` separando por dominio.
- Se possivel, adicionar smoke E2E com navegador usando conta de teste via variaveis locais.

Arquivos-alvo:

- `packages/rules/src/setup.test.ts`
- `packages/rules/src/species/*.test.ts`
- `apps/server/src/rooms.test.ts`
- `apps/web/src/ui/tutorials.test.ts`
- possivel pasta `tests/e2e`

Validacao:

- Suite completa.
- Smoke manual com login.
- Build final.

Aceite:

- Teste falha perto do dominio certo.
- Refatoracao grande fica protegida por cenarios completos.

## Ciclo 9 - Documentacao de Arquitetura

Objetivo: deixar caminho claro para quem for adicionar especie, modo, tutorial ou expansao.

Entregas:

- Criar guias:
  - `docs/COMO_ADICIONAR_ESPECIE.md`
  - `docs/COMO_ADICIONAR_MODO.md`
  - `docs/COMO_ADICIONAR_TUTORIAL.md`
  - `docs/PROTOCOLO_ONLINE.md`
- Atualizar `PLANEJAMENTO_OIKOS_DIGITAL.md` com arquitetura nova.
- Documentar checklist de validacao local/online.

Validacao:

- Simular adicao de uma especie fake ou modo minimo em branch local, se necessario, para provar guia.

Aceite:

- Desenvolvedor consegue estimar arquivos afetados antes de implementar nova feature.
- README continua curto; docs tecnicos ficam em `docs`.

## Ordem Recomendada de Execucao

1. Ciclo 1: Registry de especies e acoes.
2. Ciclo 2: Protocolo unificado de intencoes.
3. Ciclo 3: Separacao de `rooms.ts`.
4. Ciclo 4: Camada de modos.
5. Ciclo 5: Quebra do `OikosApp`.
6. Ciclo 6: Tutorial data-driven.
7. Ciclo 7: Manifesto forte de assets.
8. Ciclo 8: Testes de regressao por fluxo.
9. Ciclo 9: Documentacao de arquitetura.

Motivo da ordem: especies e acoes sao o maior multiplicador de complexidade. Depois disso, servidor e modos ficam mais faceis. UI e tutorial ganham com esses contratos ja definidos.

## Checklist por Ciclo

Antes:

- Rodar `npm.cmd run typecheck`.
- Rodar `npm.cmd run test`.
- Identificar arquivos grandes tocados.
- Definir fluxo manual que prova comportamento.

Durante:

- Manter commits pequenos dentro do ciclo grande.
- Migrar um caminho real ate o fim, nao deixar arquitetura sem uso.
- Preservar exports antigos ate todos os consumidores migrarem.
- Atualizar testes junto da mudanca.

Depois:

- Rodar `npm.cmd run typecheck`.
- Rodar `npm.cmd run test`.
- Rodar `npm.cmd run build` quando tocar web/assets/protocolo.
- Testar login com a conta de teste.
- Testar local e online.
- Registrar no plano o que foi concluido e o que ficou pendente.

## Riscos e Mitigacoes

- Risco: quebrar paridade local/online.
  - Mitigacao: `GameIntent` unico e testes nos dois caminhos.

- Risco: registry virar abstracao complexa demais.
  - Mitigacao: migrar especies atuais e medir reducao real de pontos de alteracao.

- Risco: refatorar UI e mudar visual sem querer.
  - Mitigacao: extrair componentes sem redesenhar; usar smoke visual manual.

- Risco: modos novos inflarem `GameState`.
  - Mitigacao: `GameModeDefinition` e campos opcionais agrupados por modulo.

- Risco: senha de teste vazar.
  - Mitigacao: nao salvar senha real em arquivo versionado; usar variavel local.

## Definicao de Pronto

Um ciclo so termina quando:

- Typecheck passa.
- Testes passam.
- Build passa se aplicavel.
- Fluxo local foi validado.
- Fluxo online foi validado.
- Login de teste foi usado quando o ciclo toca autenticacao, progresso, lobby online ou tutorial.
- Documentacao do ciclo foi atualizada.
- Nenhuma API antiga ficou duplicada sem motivo ou sem plano de remocao.
