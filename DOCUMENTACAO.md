# SIGA — Sistema Integrado de Gestão Académica

## Documentação Técnica

**Versão do documento:** 2.0
**Versão do sistema (cache-busting):** `?v=27`
**Tipo:** Protótipo funcional estático (front-end only, sem backend real)

---

## 1. Visão Geral

O SIGA é um protótipo funcional de um Sistema Integrado de Gestão Académica para uma instituição de ensino superior angolana. Cobre autenticação e permissões por perfil, gestão de alunos/professores/cursos/turmas/aulas, inscrições e admissão competitiva ao exame de ingresso, lançamento de notas com motor de avaliação configurável, frequência com alerta de risco, trabalhos de grupo, materiais de apoio por disciplina, financeiro (com recibo automático em duplicado), biblioteca (com normas de citação e controlo de leitura no local), recursos humanos, um módulo genérico de cadastros (tabelas de apoio), fotos de perfil, exportação de dados, backups automáticos e um módulo de auditoria e gestão de logs.

Trata-se de um protótipo **totalmente client-side**: não existe servidor de aplicação nem base de dados real. Todo o estado vive em memória (variável `state`) e é persistido no `localStorage` do browser. Não há autenticação, autorização, nem armazenamento de dados que cumpram requisitos de produção — ver secção 12 (Limitações e Avisos).

### 1.1 Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Estrutura/markup | HTML5 estático (`index.html`) |
| Estilo | CSS3 puro, sem pré-processador (`css/styles.css`) |
| Lógica | JavaScript vanilla (ES6+), sem framework, sem build step (`js/app.js`) |
| Persistência | `localStorage` do browser (várias chaves — ver secção 4) |
| Exportação Excel | [SheetJS / xlsx](https://github.com/SheetJS/sheetjs), **incluído localmente** em `js/vendor/xlsx.full.min.js` (sem CDN — funciona 100% offline) |
| Exportação PDF | Impressão nativa do browser (`window.print()`) com CSS de impressão dedicado |
| Servidor de desenvolvimento | Qualquer servidor estático — inclui `server.ps1` (PowerShell puro, sem dependências) para arranque com duplo-clique via `INICIAR.bat` |

Não há `package.json`, gestor de pacotes, nem passo de build. Os ficheiros são servidos tal como estão.

### 1.2 Dimensão do código (à data deste documento)

| Ficheiro | Linhas |
|---|---|
| `js/app.js` | ~6125 |
| `js/vendor/xlsx.full.min.js` | biblioteca de terceiros (SheetJS, minificada) |
| `css/styles.css` | ~555 |
| `index.html` | ~177 |

---

## 2. Estrutura de Ficheiros

```
sga-academico/
├── index.html          # Shell da aplicação: ecrã de login, sidebar, topbar, modal, toast
├── css/
│   └── styles.css       # Sistema de design (variáveis CSS, temas claro/escuro, componentes, impressão)
├── js/
│   ├── app.js            # TODA a lógica: estado, regras de negócio, renderização, eventos
│   └── vendor/
│       └── xlsx.full.min.js   # SheetJS, incluído localmente (offline)
├── server.ps1           # Servidor HTTP estático em PowerShell puro (porta 5500)
├── INICIAR.bat           # Arranca server.ps1 e abre o browser — duplo-clique, Windows
├── README.md             # Instruções de instalação (GitHub)
├── LEIA-ME.txt            # Instruções de demonstração em texto simples (distribuição sem git)
├── DOCUMENTACAO.md        # Este documento
└── DOCUMENTACAO.docx      # Versão Word deste documento
```

Não existem pastas de build (sem `node_modules`, sem ficheiros de configuração). O ficheiro `js/app.js` está organizado em blocos delimitados por comentários `/* ===== Nome do Bloco ===== */`, na ordem aproximada:

1. Constantes globais (perfis, módulos, avaliação, normas de citação, cadastros)
2. Sistema de permissões (`hasPerm`, `defaultPermissoes`)
3. `seed()` — geração dos dados de demonstração
4. Persistência (`loadState`, `saveState`) e migração de dados antigos (incluindo a divisão Turma/Aula — secção 4.3)
5. Auditoria/Logs (`registrarLog`, `listarLogs`, `limparLogs`)
6. Backups (`guardarBackup`, `restaurarBackup`, backup automático diário)
7. Exportação (Excel via SheetJS local, impressão PDF, download JSON)
8. Funções utilitárias (datas, moeda, badges, lookups de nomes, foto/avatar)
9. Motor de avaliação (médias, dispensa, notas finais, arredondamento configurável)
10. Períodos/submissões/reaberturas (fluxo sequencial de lançamento de notas, por **Aula**)
11. Um bloco `render`/`open...Form`/`delete...` por módulo funcional (Dashboard, Painel do Professor, Meu Painel, Alunos, Professores, Inscrições, Cadastros, Cursos, Disciplinas, Turmas & Aulas, Matrículas, Períodos, Notas, Frequência, Trabalhos, Materiais, Financeiro, Biblioteca, RH, Utilizadores, Permissões, Backups, Auditoria)
12. Router (`SECTION_RENDERERS`, `goTo`, `render`)
13. Autenticação (`attemptLogin`, `logout`, `showApp`, `showLogin`)
14. Boot (`DOMContentLoaded`)

---

## 3. Arquitetura de Execução

### 3.1 Modelo de renderização

Não há framework de componentes. Cada "ecrã" é uma função `renderX()` que:

1. Lê o estado relevante de `state` (e aplica filtros/pesquisa recebidos como parâmetro);
2. Constrói uma *string* HTML via template literals;
3. Escreve-a em `document.getElementById('content').innerHTML`;
4. A seguir, liga manualmente os *event handlers* (`onclick`, `onchange`, etc.) aos elementos recém-criados.

```js
function renderAlunos(filter = {}) {
  const rows = state.alunos.filter(/* ... */);
  document.getElementById('content').innerHTML = `...`;
  document.getElementById('fltQ').oninput = e => renderAlunos({ ...filter, q: e.target.value });
  // ...
}
```

Este padrão repete-se em todos os módulos: **re-renderizar a secção inteira** após qualquer alteração de estado ou filtro, em vez de atualização granular do DOM (sem virtual DOM, sem *diffing*). Alguns ecrãs usam duas sub-vistas em abas dentro da mesma secção (ver `.tabs`/`.tab-btn` em `styles.css`) — o único caso atual é **Turmas & Horários** (secção 6.5), com abas "Turmas" e "Aulas" geridas por `renderTurmas(filter)` como despachante.

### 3.2 Router

Um mapa simples liga o nome da secção à função de renderização:

```js
const SECTION_RENDERERS = {
  dashboard: renderDashboard,
  alunos: () => renderAlunos(),
  cadastros: () => renderCadastros(CADASTRO_TIPOS[0].key),
  auditoria: () => renderAuditoria(),
  // ... um por módulo (ver secção 6)
};

function goTo(section) {
  if (!hasPerm(section, 'view')) return;   // bloqueia navegação sem permissão
  currentSection = section;
  render();
}
function render() {
  if (!hasPerm(currentSection, 'view')) currentSection = landingSection();
  document.getElementById('pageTitle').textContent = SECTION_TITLES[currentSection];
  SECTION_RENDERERS[currentSection]();
  // ...
}
```

Cada botão da sidebar tem `data-section="..."` (secção a abrir) e `data-module="..."` (módulo usado para controlo de visibilidade — secção 6.3). `applyNavVisibility()` esconde os botões sem permissão de `view` e, adicionalmente, **esconde o rótulo de um grupo inteiro da sidebar** (`.nav-group-label`) quando nenhum dos seus itens está visível para o perfil atual — por exemplo, o Professor não vê o cabeçalho "Pessoas" nem "Gestão Administrativa" se não tiver acesso a nenhum módulo desses grupos.

### 3.3 Modal e Toast

Existe um único modal reutilizável (`#modalOverlay` / `#modalBody`) aberto via `openModal(titulo, htmlCorpo, onMount)` e um único *toast* de notificação (`toast(mensagem)`), ambos partilhados por todos os formulários do sistema. **Importante:** `@media print` esconde `.modal-overlay` — por isso qualquer ecrã que precise de ser impresso (Extrato de Frequência, Recibo) é implementado como uma vista dedicada dentro de `#content`, nunca como modal.

### 3.4 Cache-busting

`index.html` referencia os ficheiros com uma *query string* de versão:

```html
<link rel="stylesheet" href="css/styles.css?v=27">
<script src="js/app.js?v=27"></script>
```

**Convenção obrigatória:** sempre que `app.js` ou `styles.css` for alterado, o número `v=` deve ser incrementado em ambas as tags — caso contrário, browsers com cache podem continuar a servir a versão antiga (problema já observado e corrigido várias vezes durante o desenvolvimento).

---

## 4. Persistência de Dados

Não existe base de dados nem API. Tudo assenta em `localStorage`, em **cinco chaves independentes**:

| Chave | Conteúdo | Gerida por |
|---|---|---|
| `sga_academico_v1` | O objeto `state` completo (todas as entidades — ver secção 5) | `saveState()` / `loadState()` |
| `sga_academico_session_v1` | Sessão do utilizador autenticado (`{ userId }`) | `saveSession()` / `loadSession()` / `clearSession()` |
| `sga_academico_backups_v1` | Histórico rotativo dos últimos 15 backups (JSON completo + metadados) | `guardarBackup()` / `listarBackups()` |
| `sga_academico_logs_v1` | Histórico rotativo dos últimos 3000 eventos de auditoria | `registrarLog()` / `listarLogs()` / `limparLogs()` |
| `sga_academico_last_auto_backup_v1` | Data (string `YYYY-MM-DD`) do último backup automático, para não repetir no mesmo dia | `verificarBackupAutomatico()` |

### 4.1 Porque é que Backups e Logs estão em chaves separadas de `state`

Esta é uma decisão de desenho deliberada: **Backups** e **Auditoria/Logs** guardam-se fora de `state` propositadamente, para sobreviverem a:

- **"Repor dados de exemplo"** (`resetData()`, que substitui `state` inteiro por `seed()`);
- **"Restaurar backup"** (`restaurarBackup()`, que também substitui `state` inteiro).

Se os logs vivessem dentro de `state`, um "Repor dados" apagaria também o próprio registo de que esse reset aconteceu — o que anularia o propósito de uma trilha de auditoria. Por isso, tanto `resetData()` como `restaurarBackup()` **registam a si próprios** como eventos de auditoria antes/depois de substituir o `state`.

### 4.2 Ciclo de vida do estado

```js
function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    // ... dezenas de verificações de migração (ver 4.3) ...
    return parsed;
  }
  return seed();   // primeira visita: gera dados de demonstração
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
```

Todas as ações que alteram dados seguem o mesmo padrão: mutar `state` diretamente (sem imutabilidade), registar um evento de auditoria (`registrarLog(...)`) e chamar `saveState()`.

### 4.3 Migração de dados antigos (`loadState`)

Como o protótipo evoluiu por fases ao longo do desenvolvimento (ver histórico de decisões na secção 11), `loadState()` contém uma extensa cadeia de verificações defensivas para preencher campos/tabelas que não existiam em versões anteriores de dados já guardados no `localStorage` de um utilizador. Além do backfill habitual (cadastros novos, campos pessoais, conversões texto→ID), a migração mais significativa é a **divisão Turma/Aula** (introduzida na secção 5.6):

- Deteta o formato antigo (`state.turmas[0]` ainda tem `disciplinaId`);
- Agrupa as antigas "turmas" (que eram na verdade oferta de disciplina+professor+horário) por `(cursoId, anoEstudo, turno, regime)`, criando uma **nova coorte** por combinação única — estas passam a ser as novas `state.turmas`;
- Cada linha antiga vira uma linha de `state.aulas`, **reaproveitando o mesmo `id`** (evita ter de remapear referências);
- Renomeia o campo `turmaId` → `aulaId` em `notas`, `periodos`, `submissoes`, `reaberturas`, `frequencia` (o valor não muda, só a chave);
- `trabalhos` passa a apontar diretamente à coorte (já era "atribuir à turma inteira", sem disciplina);
- `melhorias` perde o campo `turmaId` (confirmado morto — nunca foi lido em lado nenhum);
- `matriculas` ganha `turmaId` por melhor esforço, cruzando `cursoId` + ano curricular do aluno; em caso de ambiguidade (mais de uma coorte no mesmo curso+ano, por turnos/regimes diferentes), fica com a primeira encontrada — corrigível manualmente depois no ecrã de Matrículas.

Isto garante que um browser com dados antigos em cache continua a funcionar sem erros após atualizações do código, sem forçar o utilizador a repor os dados.

---

## 5. Modelo de Dados (`state`)

O objeto `state` é a única fonte de verdade da aplicação em memória. É gerado por `seed()` (dados de demonstração) ou por `loadState()` (dados persistidos). Contém as seguintes coleções:

### 5.1 Configuração global

| Campo | Tipo | Descrição |
|---|---|---|
| `anoLetivo` | number | Ano letivo corrente, sempre o **ano em que o ciclo termina** (ex.: `2026` = ano académico 2025/2026) |
| `seq` | number | Contador incremental usado por `nextId(prefixo)` para gerar IDs únicos |
| `calendarioAcademico` | array | Exceções ao calendário padrão (`{ id, ano, inicio, fim }`) |
| `configAvaliacao` | object | `{ numProvas: 2, arredondarNotaFinal: false }` — número de provas antes do Exame Final (2 a 4) e se a Nota Final é arredondada ao inteiro |
| `permissoes` | object | Matriz `perfil → módulo → { view, create, edit, delete }` |

### 5.2 Tabelas de apoio / Cadastros (14 tabelas relacionais)

Todas geridas pelo módulo genérico **Cadastros** (secção 6.14), cada uma com o seu próprio prefixo de ID:

| Tabela (`state.*`) | Prefixo ID | Campos principais | Referenciada por |
|---|---|---|---|
| `unidadesOrganicas` | `uo` | nome, sigla | `cursos.unidadeOrganicaId` |
| `edificios` | `ed` | nome, descrição | `salas.edificioId`, `laboratorios.edificioId` |
| `salas` | `sl` | nome, edifícioId, capacidade | `aulas.localId` (quando `localTipo='Sala'`) |
| `laboratorios` | `lb` | nome, edifícioId, capacidade, especialidade | `aulas.localId` (quando `localTipo='Laboratorio'`) |
| `provincias` | `pv` | nome | `municipios.provinciaId`, `alunos/candidatos.provinciaId` |
| `municipios` | `mn` | nome, provinciaId | `escolasProveniencia.municipioId`, `alunos/candidatos.municipioId` |
| `escolasProveniencia` | `ep` | nome, municipioId | `alunos/candidatos.escolaProvenienciaId` |
| `generos` | `gn` | nome | `alunos/candidatos.generoId` |
| `nacionalidades` | `nc` | nome | `alunos/candidatos.nacionalidadeId` |
| `cursosProveniencia` | `cp` | nome, instituição | `alunos/candidatos.cursoProvenienciaId` |
| `periodosEstudo` | `pe` | nome (Manhã/Tarde/Noite) | `turmas.turno` (coorte), `vagas.turno`, `financeiro.turno`, `candidatos.turnoPretendido` |
| `anosEstudo` | `ae` | nome, ordem | `disciplinas.ano`, `alunos.anoCurricular`, `turmas.anoEstudo` (coorte) |
| `horarios` | `hr` | nome, início, fim | `aulas.hora` |
| `categoriasDocentes` | `cd` | nome, ordem na carreira | `professores.categoriaDocenteId` |

A configuração de cada tabela (campos, tipo de input, obrigatoriedade, referências) está centralizada na constante `CADASTRO_TIPOS`; as dependências para aviso de eliminação estão em `CADASTRO_DEPENDENCIAS`.

### 5.3 Entidades académicas

| Tabela | Prefixo ID | Campos-chave | Notas |
|---|---|---|---|
| `cursos` | `c` | nome, sigla, unidadeOrganicaId, grau, duracaoAnos, coordenador | Sigla usada no código automático da Turma |
| `professores` | `p` | nome, email, telefone, especialidade, status, categoriaDocenteId, foto | |
| `disciplinas` | `d` | nome, cursoId, professorId, ano (→ `anosEstudo`), semestre, cargaHoraria | Independente de horário — nunca teve dia/hora/local |
| `turmas` (coorte) | `t` | cursoId, anoEstudo (→ `anosEstudo`), anoLetivo, turno (→ `periodosEstudo`), regime, vagas | **Coorte de alunos** — independente de Disciplina e de Horário (ver secção 5.6). Código gerado automaticamente. |
| `aulas` | `t`/`au` | turmaId (→ coorte), disciplinaId, professorId, dia, hora (→ `horarios`), localTipo, localId | Relação Turma↔Disciplina↔Professor↔Horário — o que antes se chamava "turma" |
| `alunos` | `a` | numero, nome, email, telefone, cursoId, anoCurricular, ingresso, status, foto, generoId, nacionalidadeId, provinciaId, municipioId, numeroBI, dataEmissaoBI, nomePai, nomeMae, escolaProvenienciaId, cursoProvenienciaId | |
| `matriculas` | `m` | alunoId, cursoId, turmaId (coorte), anoLetivo, data, status | Única por (aluno, curso, ano letivo); `turmaId` é o único elo real entre um aluno e a sua coorte |
| `candidatos` | `cand` | numero, nome, dados pessoais (iguais aos do Aluno), cursoPretendidoId, turnoPretendido, anoLetivo, dataInscricao, notaExame, status, alunoId | Ver fluxo de admissão (6.6) |
| `vagas` | `vg` | cursoId, turno, anoLetivo, quantidade | Vagas declaradas por grupo curso+turno+ano |

### 5.4 Avaliação e frequência (chaveadas por Aula, não por Turma)

| Tabela | Prefixo ID | Campos-chave |
|---|---|---|
| `notas` | `n` | alunoId, disciplinaId, aulaId, anoLetivo, `prova1`..`prova4` (conforme `configAvaliacao.numProvas`), exameFinal, exameRecurso, exameEspecial, exameMelhoria |
| `periodos` | `pr` | aulaId, tipo (ex.: `prova1`, `exameFinal`), inicio, fim — janela em que o docente pode lançar essa etapa |
| `submissoes` | `sb` | aulaId, tipo, submetidoEm, submetidoPor — bloqueia relançamento até reabertura |
| `reaberturas` | `rb` | aulaId, tipo, motivo, solicitadoPor, solicitadoEm, status, respondidoEm |
| `melhorias` | `me` | alunoId, disciplinaId, solicitadoEm, status, respondidoEm |
| `frequencia` | `f` | aulaId, data, presencas (`{ alunoId: boolean }`) |

### 5.5 Trabalhos, Materiais

| Tabela | Prefixo ID | Campos-chave |
|---|---|---|
| `trabalhos` | `tb` | turmaId (coorte), tema, duracaoDias, cotacao, criadoEm, criadoPor |
| `trabalhoIntegrantes` | `ti` | trabalhoId, alunoId, aceite (`null`\|`true`\|`false`), respondidoEm |
| `trabalhoFicheiros` | `tf` | trabalhoId, alunoId, nomeFicheiro, tipoFicheiro, tamanho, conteudo (dataURL), enviadoEm |
| `materiais` | `mt` | disciplinaId, titulo, descricao, nomeFicheiro/tipoFicheiro/tamanho/conteudo (dataURL) **ou** link externo, publicadoPor, publicadoEm |

Um trabalho é atribuído à **turma (coorte) inteira**, não a uma disciplina — cada aluno da coorte tem de aceitar ou recusar a adesão antes de poder submeter ficheiro. Materiais são publicados por disciplina e ficam visíveis a todos os alunos do curso correspondente em "Meu Painel".

### 5.6 Financeiro, Biblioteca, RH, Utilizadores

| Tabela | Prefixo ID | Campos-chave |
|---|---|---|
| `financeiro` | `fi` | alunoId, descrição, valor, vencimento, status, anoLetivo, turno, regime, dataPagamento, numeroRecibo, dataEmissaoRecibo |
| `livros` | `l` | título, autor, categoria, exemplares, disponíveis, editora, local, anoPublicacao, edicao, isbn, normaCitacao |
| `emprestimos` | `e` | livroId, alunoId, tipo (`Emprestimo`\|`Leitura Local`), dataEmprestimo, dataPrevista, dataDevolucao |
| `funcionarios` | `rh` | nome, cargo, departamento, tipo, professorId (opcional), dataAdmissao, salário, status, foto |
| `usuarios` | `u` | nome, email, senha (texto simples — ver aviso 12.2), papel, refId (ligação a Professor/Aluno), status, foto |

### 5.7 Regras derivadas importantes

- **Turma (coorte) independente de Disciplina/Horário** (secção 6.5): `state.turmas` já não é a antiga "oferta de disciplina" — é o grupo de alunos em si (curso, ano de estudo, ano letivo, turno, regime, vagas). O que antes se chamava turma (disciplina+professor+dia/hora/local) é agora `state.aulas`, uma relação entre a coorte e a disciplina.
- **Código automático da turma** (`turmaCodigo`): combina sigla do curso + ordem do ano de estudo + letra do turno + letra do regime (ex.: `EI2-MR` = Engenharia Informática, 2º ano, Manhã, Regular), calculado a partir dos 4 campos da própria coorte. O formulário de Turma valida unicidade de `(cursoId, anoEstudo, turno, regime)`, por isso o código é sempre único por construção — sem sufixo de desempate.
- **Roster de uma turma** (`turmaRoster(turmaId)`): alunos com matrícula **ativa** cujo `turmaId` corresponde — um vínculo real, não uma aproximação por curso. `aulaRoster(aulaId)` delega para o roster da coorte da aula.
- **Rótulo do ano letivo** (`anoLetivoLabel`): o valor armazenado é sempre o ano em que o ciclo **termina**; a etiqueta mostrada é sempre `{ano-1}/{ano}`.
- **Número de aluno** (`gerarNumeroAluno`): formato `{anoLetivo}-{siglaCurso}-{sequencial com 3 dígitos}`.
- **Número de recibo** (`gerarNumeroRecibo`): formato `RC-{anoLetivo}-{sequencial com 4 dígitos}`, gerado uma única vez por lançamento financeiro (`assegurarRecibo`), na primeira vez que o estado passa a "Pago".

---

## 6. Módulos Funcionais

### 6.1 Autenticação e Perfis

Login simulado por comparação direta de `email`+`senha` contra `state.usuarios` (**sem hashing** — ver aviso 12.2). Existem **9 perfis** (`ROLES`):

| Perfil | Acesso predefinido |
|---|---|
| `admin` | Total a todos os módulos (concedido automaticamente pelo *loop* em `defaultPermissoes()`) |
| `secretaria_academica` | Total em Alunos, Professores, Inscrições, Cursos, Disciplinas, Turmas & Aulas, Matrículas, Períodos, Trabalhos, Materiais, Cadastros; só visualização em Notas/Frequência |
| `tecnico_sec_academica` | Como acima, mas sem eliminar e sem gerir Cursos/Disciplinas (só visualização) |
| `professor` | Painel do Professor, Notas e Frequência (criar/editar), Trabalhos (criar/editar), Materiais (criar/editar/ver), Turmas/Períodos (visualização) |
| `estudante` | Só "Meu Painel" |
| `secretaria_financeira` | Total em Financeiro; visualização de Alunos |
| `tecnico_sec_financeira` | Financeiro sem eliminar; visualização de Alunos |
| `biblioteca` | Total em Biblioteca; visualização de Alunos |
| `recursos_humanos` | Total em RH; visualização de Professores |

Cada permissão é um objeto `{ view, create, edit, delete }`, verificado via `hasPerm(modulo, acao)`. A matriz completa é editável pelo Admin no módulo **Permissões** (secção 6.17), com "ver" imposto automaticamente como pré-requisito de qualquer outra ação. `applyNavVisibility()` também esconde grupos inteiros da sidebar sem nenhum módulo acessível (secção 3.2).

### 6.2 Dashboard

KPIs agregados (alunos ativos, professores ativos, cursos/turmas, taxa de aprovação, receita pendente), distribuição de alunos por curso, situação financeira e alertas de pagamentos em atraso — filtrados por `hasPerm` (ex.: painel financeiro só aparece a quem tem acesso a Financeiro).

### 6.3 Painel do Professor / Meu Painel (Estudante)

- **Painel do Professor**: aulas atribuídas (`scopedAulas()`), estado da avaliação por aula (etapa atual, janela aberta/fechada), atalhos para Notas/Frequência/Períodos.
- **Meu Painel** (estudante): dados pessoais com foto, turma (coorte) e horário semanal (aulas da sua turma, grelha gerada por `renderScheduleGrid`), notas e situação, frequência por disciplina, extrato financeiro (com botão de simulação de pagamento), empréstimos de biblioteca, trabalhos atribuídos à sua turma (aceitar/recusar adesão, submeter ficheiro), materiais das disciplinas do seu curso, e opção de solicitar Exame de Melhoria quando aplicável.

Visibilidade da sidebar controlada por `applyNavVisibility()`, que esconde `data-module` sem permissão de `view`.

### 6.4 Alunos / Professores

CRUD completo, com **foto de perfil** (redimensionada no browser para não sobrecarregar o `localStorage` — `redimensionarImagem`, `avatarHtml`, `fotoFieldHtml`/`wireFotoField`, reutilizados também em Funcionário e Utilizador). Aluno inclui pesquisa e filtros por curso/ano/**turma** (agora a coorte real, via `turmaRoster`) /estado, e todos os campos pessoais (naturalidade província/município em cascata, género, nacionalidade, BI, filiação, escola/curso de proveniência). Exportação Excel disponível.

### 6.5 Cursos / Disciplinas / Turmas & Aulas / Matrículas

- **Cursos**: nome, sigla, Unidade Orgânica, grau, duração, coordenador.
- **Disciplinas**: ligadas a Curso, Professor, Ano de Estudo (cadastro) e semestre — sempre independentes de horário.
- **Turmas & Horários** — ecrã com **duas abas**:
  - **Turmas**: CRUD da coorte (curso, ano de estudo, ano letivo, turno, regime, vagas); código gerado automaticamente; valida unicidade de `(curso, ano, turno, regime)`; mostra nº de aulas e nº de alunos matriculados por turma.
  - **Aulas**: CRUD da relação turma+disciplina+professor+horário (tipo+local — Sala ou Laboratório, cascata —, dia, tempo letivo); deteção de conflito de horário (mesmo local+dia+hora); mapa semanal visual (`renderScheduleGrid`).
- **Matrículas**: liga Aluno + Curso + **Turma** (coorte, selecionável em cascata a partir do curso escolhido) + Ano Letivo, com verificação de duplicação por (aluno, curso, ano letivo). É o único ecrã que define o vínculo aluno↔turma.

Eliminar uma Turma (coorte) é bloqueado se houver matrículas ativas; ao confirmar, elimina em cascata as suas Aulas e tudo o que delas dependia (notas, períodos, frequência, trabalhos). Eliminar uma Aula elimina em cascata notas/períodos/frequência associados a ela.

### 6.6 Inscrições — Admissão Competitiva ao Exame de Ingresso

Fluxo completo de candidatura → avaliação → admissão:

1. **Candidatura** (`state.candidatos`): dados pessoais completos, curso/turno pretendido, ano letivo de ingresso.
2. **Vagas** (`state.vagas`): a Secretaria declara o número de vagas por grupo (curso + turno + ano letivo).
3. **Lançamento de notas**: nota de exame (0–20) por candidato, sem decidir admissão nesse momento.
4. **Processar Admissões** (`processarAdmissoes`): motor de concurso que:
   - Filtra candidatos com nota lançada e ainda não convertidos em aluno;
   - Elimina os com nota `< 10` (`NOTA_MINIMA_ADMISSAO`) ou idade `< 17` (`IDADE_MINIMA_ADMISSAO`);
   - Ordena os elegíveis por nota decrescente, desempate por idade decrescente (mais velho primeiro);
   - Preenche as vagas restantes (declaradas menos já admitidos);
   - Resultado sempre **binário**: `Admitido` ou `Não Admitido` (nunca "Reprovado", "Excedente", etc. — decisão explícita do utilizador).
5. **Conversão automática** (`converterCandidatoEmAluno`): candidato admitido gera um registo de Aluno + Matrícula automaticamente, herdando todos os dados pessoais.

Inclui também gestão do **Calendário Académico** (datas de início/fim por ano letivo, com exceções editáveis) e botão para avançar o ano letivo corrente.

### 6.7 Períodos de Avaliação + Configuração da Avaliação

- **Configuração da Avaliação** (só quem tem permissão de editar Períodos): número de provas antes do Exame Final, entre 2 e 4 (`configAvaliacao.numProvas`); e se a Nota Final é apresentada com 1 casa decimal ou arredondada ao inteiro (`configAvaliacao.arredondarNotaFinal`) — ambos aplicados globalmente e de imediato.
- **Janelas de lançamento por aula**: a Secretaria define, por aula (disciplina+turma+professor+horário), o intervalo de datas em que cada etapa (`Prova 1..N`, Exame Final, Recurso, Especial) pode ser lançada pelo docente. Sem período aberto, o lançamento fica bloqueado.
- **Reaberturas**: se o docente precisar de lançar/corrigir fora da janela, solicita reabertura (com motivo); a Secretaria aprova ou rejeita.
- **Exame de Melhoria**: pedido individual do aluno (feito em "Meu Painel"), aprovado pela Secretaria, só depois lançável pelo docente — **não** faz parte da sequência obrigatória por aula.

### 6.8 Notas — Motor de Avaliação

Sequência obrigatória por aula (`tiposAvaliacao()`, gerada dinamicamente conforme `numProvas`): `Prova 1 → ... → Prova N → Exame Final → Exame de Recurso → Exame Especial`. Cada etapa só pode ser lançada depois da anterior estar submetida (`estagioAtual`, `isSubmetido`, `janelaStatus`).

**Fórmulas** (constantes: `MEDIA_DISPENSA = 15`, pesos fixos 40/60):

```
Média = média aritmética simples de Prova 1..N (com pelo menos 1 lançada)

Se Média ≥ 15 (todas as provas lançadas) → aluno DISPENSADO do Exame Final
   → a Média é copiada automaticamente para o campo Exame Final
   → Nota Final = Média (situação "Aprovado", via "Dispensa (Média)")

Senão, com Exame Final lançado:
   Nota Final = Média × 40% + Exame Final × 60%
   Se ≥ 10 → Aprovado (via "Exame Normal")
   Se < 10 → segue para Exame de Recurso:
       Nota Final = Média × 40% + Exame de Recurso × 60%
       Se ≥ 10 → Aprovado (via "Recurso")
       Se < 10 → segue para Exame Especial:
           Nota Final = Exame Especial (nota seca, 100%, não usa a Média)
           Se ≥ 10 → Aprovado (via "Especial"); senão → Reprovado

Exame de Melhoria (só se já Aprovado):
   Nota Final = Exame Final × 60% + Melhoria × 40%
   Só substitui a nota efetiva se for MAIS ALTA que a atual
   (protege o aluno de descer a nota ao tentar melhorar)
```

Todas as notas são arredondadas a 1 casa decimal (`round1`); se `configAvaliacao.arredondarNotaFinal` estiver ativo, a Nota Final é ainda arredondada ao inteiro antes de ser apresentada. A interface de lançamento (`renderNotasLancamento`) gera colunas dinamicamente conforme `numProvas`, mostra só os alunos relevantes em cada etapa (ex.: quem não dispensou, no Exame Final) e oferece "Gravar rascunho" (sem submeter) vs. "Gravar e Submeter" (bloqueia a etapa e avança).

### 6.9 Frequência

Registo de presenças por aula+data (`renderFrequencia`). **Extrato de Frequência** (`renderFrequenciaExtrato`) calcula percentagem de presença por aluno (roster real da coorte, via `aulaRoster`) e assinala risco (`FREQUENCIA_MINIMA = 75%`) com badge "Risco de Reprovação por Faltas". Inclui:
- **Imprimir (PDF)**: usa `window.print()` restrito à secção atual via CSS `@media print` dedicado (esconde sidebar/topbar/botões, mostra só o extrato);
- **Exportar Excel**: gera `.xlsx` com os mesmos dados.

### 6.10 Trabalhos

Trabalhos de grupo atribuídos pelo docente a uma **turma inteira** (tema, duração em dias, cotação, integrantes selecionados do roster real da coorte). Cada integrante recebe uma notificação em "Meu Painel" e tem de **aceitar ou recusar** a adesão antes de poder submeter ficheiro (limite 5 MB, guardado como dataURL). O docente vê, por trabalho, quantos aceitaram/recusaram/ainda não responderam e quantos já entregaram ficheiro.

### 6.11 Materiais

Materiais de apoio (slides, documentos ou link externo) publicados pelo docente por **disciplina** (não por turma) — ficam visíveis em "Meu Painel" a todos os alunos do curso correspondente à disciplina.

### 6.12 Financeiro

Lançamentos (propinas/taxas) por aluno, com filtros por estado/ano/período/regime, total filtrado, exportação Excel, e **recibo automático em duplicado**:

- Ao marcar um lançamento como "Pago" (botão rápido ou editando o formulário), o sistema gera um número de recibo sequencial (`gerarNumeroRecibo`, formato `RC-{ano}-{4 dígitos}`) e navega automaticamente para um ecrã dedicado de recibo (`renderRecibo`, fora do sistema de modais — ver secção 3.3).
- O ecrã mostra **duas vias idênticas numa única folha** (1ª Via — Cliente, 2ª Via — Instituição), separadas por uma linha de corte, com botão "Imprimir Recibo (PDF)" (reutiliza `imprimirSecao`).
- Lançamentos já marcados como "Pago" antes desta funcionalidade existir recebem o número de recibo automaticamente na primeira vez que o botão "Recibo" é usado (`assegurarRecibo`); reimpressões seguintes reaproveitam o mesmo número.

### 6.13 Biblioteca

- **Catálogo de livros**: título, autor, categoria, exemplares/disponíveis, e dados bibliográficos completos (editora, local, ano de publicação, edição, ISBN) com **norma de citação** escolhida por livro entre 4 disponíveis (`NORMAS_CITACAO`: APA, ABNT, Vancouver, ISO 690) — `formatarCitacao(livro, norma)` gera a referência simplificada.
- **Exportar lista de obras**: exportação Excel do catálogo com a citação já formatada segundo a norma escolhida no momento da exportação.
- **Empréstimos**, com dois tipos (`emprestimos.tipo`):
  - `Emprestimo`: o livro sai da biblioteca, decrementa `disponiveis`, com devolução prevista/registada;
  - `Leitura Local`: consulta na própria biblioteca — não decrementa `disponiveis`, fecha automaticamente no mesmo dia (controlo de leitura no local).
- **Relatório de Leitura**: ranking dos alunos com mais leituras totais, agrupado por categoria do livro ("melhor leitor por área de especialidade") — `relatorioLeituraPorCategoria()`.

### 6.14 Recursos Humanos

Funcionários (docentes e não-docentes), com foto de perfil, opcionalmente ligados a um registo de Professor.

### 6.15 Cadastros (módulo genérico)

Um único par de funções (`renderCadastros` / `openCadastroForm` / `deleteCadastro`) serve as 14 tabelas de apoio da secção 5.2, evitando duplicar código de CRUD. A configuração de cada tabela — campos, tipos (`text`, `number`, `time`, `ref`), obrigatoriedade e referências — vive na constante `CADASTRO_TIPOS`; a eliminação verifica dependências (`CADASTRO_DEPENDENCIAS`, que aponta para `state.aulas` no caso de salas/laboratórios/horários) e avisa se o registo está em uso noutro módulo antes de remover.

### 6.16 Utilizadores e Permissões

- **Utilizadores**: gestão de contas (nome, email, senha em texto simples, perfil, foto, associação a Professor/Aluno quando aplicável, estado). A associação a Aluno usa a **pesquisa por número de matrícula** (secção 6.18), reconstruída dinamicamente sempre que o perfil selecionado muda entre Professor/Estudante/outro. Protegida contra remover o próprio utilizador em sessão e contra ficar sem nenhum Administrador.
- **Permissões**: matriz editável perfil × módulo × ação, com "Repor predefinições" por perfil. O perfil Administrador não é configurável aqui (acesso total fixo).

### 6.17 Backups

Como não existe backend/BD real, o "backup do sistema" é o próprio `state` gravado com metadados (data/hora, ano letivo, contagem de registos por tabela):

- **Backup automático**: uma vez por dia (por sessão de browser), ao carregar a aplicação (`verificarBackupAutomatico`), guardado silenciosamente no histórico rotativo (até 15 entradas).
- **Backup manual (JSON)**: descarrega um ficheiro `.json` com metadados + `state` completo.
- **Backup em Excel**: workbook multi-separador (uma *sheet* por tabela), dados em bruto (incluindo IDs internos) — pensado como cópia de segurança re-importável, distinto das exportações "amigáveis" por módulo.
- **Restaurar**: a partir do histórico local ou de um ficheiro `.json` carregado — substitui `state` por inteiro, com confirmação explícita.

### 6.18 Pesquisa de Aluno por Número de Matrícula

Padrão de UI reutilizável (`alunoBuscaFieldHtml` / `wireAlunoBusca`, perto de `avatarHtml`/`fotoFieldHtml` em `app.js`) que substitui a caixa de combinação de aluno em **quatro formulários**: Matrículas, Financeiro, Biblioteca (Empréstimos) e Utilizadores (Aluno associado).

- O utilizador escreve o número de matrícula (ex.: `2026-EI-001`) e prime **Enter**;
- `state.alunos.find(a => a.numero === valor)` localiza o aluno e preenche automaticamente três campos só-leitura: **Nome**, **Curso** e **Turma** (via `turmaDoAluno`, que resolve a matrícula ativa do aluno até à sua coorte — secção 5.7);
- Se não encontrar, os campos ficam vazios e surge um *toast* de aviso;
- Um campo escondido guarda o `alunoId` resolvido, lido pelo formulário no momento de guardar (`getAlunoId()`).

Em Matrículas, a Turma mostrada por este campo é apenas informativa (a matrícula ativa já existente do aluno, se houver) — o `select` de Turma separado, mais abaixo no formulário, é quem define a nova matrícula.

### 6.19 Auditoria e Gestão de Logs

Módulo **exclusivo do Administrador**. Regista automaticamente (`registrarLog(acao, modulo, descricao)`):

- Login (sucesso/falha, com o email tentado quando falha) e Logout;
- Criação/edição/remoção em todas as entidades de dados (Alunos, Professores, Cursos, Disciplinas, Turmas, Aulas, Matrículas, Inscrições, Cadastros, Trabalhos, Materiais, Financeiro, Biblioteca, RH, Utilizadores);
- Processamento de admissões, lançamento/submissão de notas, aprovação/rejeição de reaberturas e pedidos de melhoria;
- Alterações de Permissões (com lista dos módulos alterados);
- Configuração da Avaliação (número de provas, arredondamento da Nota Final);
- Geração de recibo (Financeiro), controlo de leitura (Biblioteca);
- Backups, restauro de backup e reposição de dados.

Cada evento guarda `timestamp`, `userId`/`userNome`/`papel` (autor), `acao`, `modulo` e `descricao`. A tela `renderAuditoria` oferece filtros (utilizador, módulo, ação, intervalo de datas, texto livre), exportação Excel e duas ações de gestão de retenção: **"Limpar mais antigos que 90 dias"** e **"Limpar todo o histórico"** (ambas com confirmação, irreversíveis). Por segurança, a palavra-passe nunca é escrita na descrição de um log.

---

## 7. Exportação de Dados

### 7.1 Excel (todos os módulos de listagem)

Cada ecrã de listagem (Alunos, Professores, Cursos, Disciplinas, Turmas, Aulas, Matrículas, Inscrições, Notas, Frequência, Trabalhos, Financeiro, Biblioteca, RH, Cadastros, Utilizadores, Auditoria) tem um botão **"Exportar Excel"** que invoca o helper genérico:

```js
function exportarExcel(filename, sheetName, rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename + '.xlsx');
}
```

Os dados exportados usam **nomes legíveis** (ex.: nome do curso em vez do ID), respeitando os filtros aplicados no ecrã no momento da exportação.

### 7.2 PDF (Extrato de Frequência, Recibo)

Não é gerado um PDF binário — usa-se a funcionalidade nativa "Imprimir" do browser (`window.print()`), restrita à área relevante por uma folha de estilos de impressão dedicada (`@media print` em `styles.css`), que esconde toda a interface de navegação e mostra só o conteúdo relevante com um cabeçalho próprio inserido dinamicamente (`imprimirSecao(titulo)`).

### 7.3 Sem dependência externa

Ao contrário de versões anteriores do protótipo, a exportação Excel **não depende de internet**: a biblioteca SheetJS está incluída localmente em `js/vendor/xlsx.full.min.js` e referenciada diretamente em `index.html`:

```html
<script src="js/vendor/xlsx.full.min.js"></script>
```

Esta é a única "dependência externa" de todo o sistema, mas está embutida na própria pasta do projeto — o sistema funciona **100% offline**, incluindo exportação Excel e impressão em PDF.

---

## 8. Segurança e Modelo de Ameaças (estado atual do protótipo)

Este é um protótipo de demonstração de fluxo funcional, **não um sistema pronto para produção**. Pontos relevantes:

| Aspeto | Estado atual | Risco |
|---|---|---|
| Palavras-passe | Texto simples, comparação direta, guardadas no `localStorage` | Qualquer pessoa com acesso ao browser vê as credenciais em claro |
| Autorização | Só no *frontend* (`hasPerm`), sem qualquer imposição do lado do servidor | Um utilizador com conhecimentos técnicos pode alterar `state` diretamente via consola do browser e contornar qualquer restrição |
| Sessão | Um objeto simples em `localStorage`, sem expiração, sem token assinado | Sessão persiste indefinidamente; fácil de forjar |
| Dados sensíveis | BI, filiação, dados pessoais completos, fotos, guardados em claro no `localStorage` do browser | Sem isolamento nem encriptação em repouso |
| Multiutilizador | Cada browser/dispositivo tem o seu próprio `state` isolado — não há sincronização entre postos | Dados nunca partilhados entre secretaria/professor/aluno em máquinas diferentes |
| Auditoria | Reflete fielmente ações feitas *através da UI*; não deteta manipulação direta do `localStorage` | Um utilizador técnico pode editar dados sem deixar rasto de auditoria |

Estas limitações são inerentes à natureza do protótipo (sem backend) e devem ser resolvidas antes de qualquer utilização com dados reais de estudantes — nomeadamente via uma migração para uma arquitetura cliente-servidor com autenticação e autorização do lado do servidor, base de dados real e HTTPS.

---

## 9. Como Executar

Não há build nem dependências a instalar — nem sequer ligação à internet, já que o SheetJS está incluído localmente. Ver [README.md](README.md) para o detalhe das 3 vias de arranque (duplo-clique em `INICIAR.bat` no Windows, `server.ps1` manual, ou qualquer servidor estático noutros sistemas operativos); resumidamente:

```bash
cd sga-academico
python3 -m http.server 5500
```

Depois abrir `http://localhost:5500` no browser. A aplicação lê `?v=N` das tags `<link>`/`<script>` apenas para *cache-busting* — não é necessário nenhum parâmetro na URL para o funcionamento normal.

### 9.1 Contas de demonstração (seed)

| Perfil | Email | Senha |
|---|---|---|
| Administrador | admin@isg.ao | admin123 |
| Secretaria Académica | secretaria.academica@isg.ao | secacad123 |
| Técnico Sec. Académica | tecnico.academico@isg.ao | tecacad123 |
| Professor | carlos.neto@isp.ao | prof123 |
| Estudante | miguel.santos@aluno.isp.ao | aluno123 |
| Secretaria Financeira | secretaria.financeira@isg.ao | secfin123 |
| Técnico Sec. Financeira | tecnico.financeiro@isg.ao | tecfin123 |
| Biblioteca | biblioteca@isg.ao | biblio123 |
| Recursos Humanos | rh@isg.ao | rh123 |

O ecrã de login também tem botões de acesso rápido a cada conta de demonstração.

### 9.2 Repor dados

Botão "↺ Repor dados de exemplo" no rodapé da sidebar — substitui `state` inteiro pelos dados gerados por `seed()`. Não afeta o histórico de Backups nem de Auditoria (secção 4.1).

---

## 10. Convenções de Código

- **Nomes de funções e variáveis em português**, alinhado com o domínio do sistema (`renderAlunos`, `calcularIdade`, `hasPerm` é uma das poucas exceções em inglês, por convenção de nomenclatura de permissões).
- **Prefixos de ID por entidade** — ver tabelas na secção 5 — gerados por `nextId(prefixo)`, que incrementa `state.seq` global; o mesmo contador é partilhado por todas as entidades, por isso prefixos diferentes nunca colidem mesmo que ambos comecem por `t` (ex.: coorte `t101` vs. aula `au205`).
- **Sem comentários redundantes**: comentários existem apenas onde a lógica não é óbvia pelo nome (ex.: fórmulas de avaliação, motivo de uma decisão de desenho, a razão de a migração Turma/Aula reaproveitar IDs antigos).
- **`esc()`** aplicado a qualquer valor de utilizador inserido em HTML via template literal, para mitigar XSS refletido dentro do próprio protótipo.
- **Sem dependências de build**: qualquer alteração é imediatamente visível ao recarregar a página (após incrementar `?v=`).

---

## 11. Histórico de Evolução (resumo)

O sistema foi construído incrementalmente. Principais marcos, por ordem:

1. Protótipo inicial: autenticação/perfis, permissões, Alunos, Professores, Cursos, Disciplinas, Turmas, Matrículas.
2. Motor de avaliação completo (Prova 1/2, Média, Exame Final/Recurso/Especial, dispensa automática, Exame de Melhoria).
3. Módulo de Inscrições com admissão competitiva por vagas/nota/idade (resultado binário Admitido/Não Admitido).
4. Horário semanal do estudante, extrato de frequência com alerta de risco por faltas.
5. Pesquisa e filtros avançados em Alunos/Turmas/Financeiro.
6. Calendário académico editável e correção do cálculo do ano letivo.
7. Módulo de Recursos Humanos e dois novos perfis (Técnico Sec. Académica, Técnico Sec. Financeira).
8. **Refactor relacional**: 13 tabelas de cadastro/apoio substituindo texto solto e números soltos por relações reais (módulo genérico Cadastros).
9. Campos pessoais completos em Aluno/Candidato (naturalidade, BI, filiação, nacionalidade, género, escola/curso de proveniência).
10. Exportação Excel em todos os módulos de listagem; impressão em PDF do Extrato de Frequência; motor de avaliação configurável (2 a 4 provas); backups automáticos (JSON + Excel) com restauro.
11. Módulo de Auditoria e Gestão de Logs.
12. Pacote de demonstração standalone (servidor PowerShell + `INICIAR.bat`) e o site passa a **100% offline** (SheetJS incluído localmente).
13. **Fase 2**: sidebar oculta grupos vazios por perfil; módulo Trabalhos (atribuição a turma, adesão, submissão de ficheiro); nota final com arredondamento configurável; módulo Materiais por disciplina; fotos de perfil (Aluno/Professor/Funcionário/Utilizador); Biblioteca com normas de citação, exportação por norma, controlo de leitura no local e relatório de leitura por categoria.
14. Recibo automático em duplicado no Financeiro (número sequencial, duas vias numa folha).
15. **Refactor Turma/Aula**: Turma passa a ser uma coorte de alunos independente de Disciplina e Horário (antes conflatadas numa só entidade); nova entidade Aula para a relação turma+disciplina+professor+horário; roster de turma passa a ser um vínculo real via Matrícula em vez de uma aproximação por curso; migração automática dos dados antigos. Pesquisa de aluno por número de matrícula (substitui caixas de combinação em Matrículas, Financeiro, Biblioteca e Utilizadores).
16. `README.md` para instalação a partir do GitHub; repositório git inicializado e publicado.

Uma tentativa de migração para um backend real (Next.js + Prisma + SQLite) foi planeada e parcialmente iniciada, mas **foi cancelada a pedido explícito** antes de qualquer código de backend ser finalizado; o protótipo permaneceu estático.

---

## 12. Limitações Conhecidas

1. **Sem backend real** — todas as regras de negócio e permissões correm e são impostas inteiramente no browser.
2. **Sem multiutilizador real** — cada browser tem o seu próprio `state`; não há sincronização entre postos de trabalho.
3. **Senhas em texto simples** — aceitável apenas para demonstração local.
4. **Limite de armazenamento do `localStorage`** (tipicamente 5–10 MB por origem) — em uso prolongado com muitos registos, dados, fotos, backups e logs, este limite pode ser atingido; o sistema já pratica rotação (backups: últimos 15; logs: últimos 3000) e redimensionamento de imagens para mitigar isto, mas o crescimento de `state` em si não é limitado.
5. **Migração de matrícula↔turma ambígua em casos raros**: se um curso+ano tiver mais de uma coorte (turnos/regimes diferentes) e os dados vierem de uma versão anterior do sistema, a migração automática associa a matrícula à primeira coorte encontrada — corrigível manualmente no ecrã de Matrículas.
6. **Auditoria não é à prova de manipulação** — reflete ações feitas através da interface; alterações diretas ao `localStorage` via consola do browser não ficam registadas.
7. **Sem testes automatizados** — toda a verificação foi feita manualmente via browser automatizado durante o desenvolvimento (login por perfil, fluxos ponta-a-ponta por módulo).

---

*Fim do documento.*
