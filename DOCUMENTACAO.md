# SIGA — Sistema Integrado de Gestão Académica

## Documentação Técnica

**Versão do documento:** 1.0
**Versão do sistema (cache-busting):** `?v=22`
**Tipo:** Protótipo funcional estático (front-end only, sem backend real)

---

## 1. Visão Geral

O SIGA é um protótipo funcional de um Sistema Integrado de Gestão Académica para uma instituição de ensino superior angolana. Cobre autenticação e permissões por perfil, gestão de alunos/professores/cursos/turmas, inscrições e admissão competitiva ao exame de ingresso, lançamento de notas com motor de avaliação configurável, frequência com alerta de risco, financeiro, biblioteca, recursos humanos, um módulo genérico de cadastros (tabelas de apoio), exportação de dados, backups automáticos e um módulo de auditoria e gestão de logs.

Trata-se de um protótipo **totalmente client-side**: não existe servidor de aplicação nem base de dados real. Todo o estado vive em memória (variável `state`) e é persistido no `localStorage` do browser. Não há autenticação, autorização, nem armazenamento de dados que cumpram requisitos de produção — ver secção 12 (Limitações e Avisos).

### 1.1 Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Estrutura/markup | HTML5 estático (`index.html`) |
| Estilo | CSS3 puro, sem pré-processador (`css/styles.css`) |
| Lógica | JavaScript vanilla (ES6+), sem framework, sem build step (`js/app.js`) |
| Persistência | `localStorage` do browser (várias chaves — ver secção 4) |
| Exportação Excel | [SheetJS / xlsx](https://github.com/SheetJS/sheetjs) carregado via CDN (`xlsx@0.18.5`) |
| Exportação PDF | Impressão nativa do browser (`window.print()`) com CSS de impressão dedicado |
| Servidor de desenvolvimento | Qualquer servidor estático — usado `python -m http.server 5500` |

Não há `package.json`, gestor de pacotes, nem passo de build. Os três ficheiros (`index.html`, `css/styles.css`, `js/app.js`) são servidos tal como estão.

### 1.2 Dimensão do código (à data deste documento)

| Ficheiro | Linhas |
|---|---|
| `js/app.js` | ~4875 |
| `css/styles.css` | ~532 |
| `index.html` | ~171 |

---

## 2. Estrutura de Ficheiros

```
sga-academico/
├── index.html          # Shell da aplicação: ecrã de login, sidebar, topbar, modal, toast
├── css/
│   └── styles.css       # Sistema de design (variáveis CSS, temas claro/escuro, componentes, impressão)
├── js/
│   └── app.js           # TODA a lógica: estado, regras de negócio, renderização, eventos
└── DOCUMENTACAO.md      # Este documento
```

Não existem outras pastas (sem `node_modules`, sem ficheiros de configuração de build). O ficheiro `js/app.js` está organizado em blocos delimitados por comentários `/* ===== Nome do Bloco ===== */`, na ordem aproximada:

1. Constantes globais (perfis, módulos, avaliação, cadastros)
2. Sistema de permissões (`hasPerm`, `defaultPermissoes`)
3. `seed()` — geração dos dados de demonstração
4. Persistência (`loadState`, `saveState`) e migração de dados antigos
5. Auditoria/Logs (`registrarLog`, `listarLogs`, `limparLogs`)
6. Backups (`guardarBackup`, `restaurarBackup`, backup automático diário)
7. Exportação (Excel via SheetJS, impressão PDF, download JSON)
8. Funções utilitárias (datas, moeda, badges, lookups de nomes)
9. Motor de avaliação (médias, dispensa, notas finais)
10. Períodos/submissões/reaberturas (fluxo sequencial de lançamento de notas)
11. Um bloco `render`/`open...Form`/`delete...` por módulo funcional (Dashboard, Alunos, Professores, Inscrições, Cadastros, Cursos, Disciplinas, Turmas, Matrículas, Períodos, Notas, Frequência, Financeiro, Biblioteca, RH, Utilizadores, Permissões, Backups, Auditoria)
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

Este padrão repete-se em todos os módulos: **re-renderizar a secção inteira** após qualquer alteração de estado ou filtro, em vez de atualização granular do DOM (sem virtual DOM, sem *diffing*).

### 3.2 Router

Um mapa simples liga o nome da secção à função de renderização:

```js
const SECTION_RENDERERS = {
  dashboard: renderDashboard,
  alunos: () => renderAlunos(),
  cadastros: () => renderCadastros(CADASTRO_TIPOS[0].key),
  auditoria: () => renderAuditoria(),
  // ... um por módulo (ver secção 5)
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

Cada botão da sidebar tem `data-section="..."` (secção a abrir) e `data-module="..."` (módulo usado para controlo de visibilidade — ver secção 6.3).

### 3.3 Modal e Toast

Existe um único modal reutilizável (`#modalOverlay` / `#modalBody`) aberto via `openModal(titulo, htmlCorpo, onMount)` e um único *toast* de notificação (`toast(mensagem)`), ambos partilhados por todos os formulários do sistema.

### 3.4 Cache-busting

`index.html` referencia os ficheiros com uma *query string* de versão:

```html
<link rel="stylesheet" href="css/styles.css?v=22">
<script src="js/app.js?v=22"></script>
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

Como o protótipo evoluiu por fases ao longo do desenvolvimento (ver histórico de decisões na secção 11), `loadState()` contém uma extensa cadeia de verificações defensivas para preencher campos/tabelas que não existiam em versões anteriores de dados já guardados no `localStorage` de um utilizador — por exemplo:

- Backfill das 13 tabelas de cadastro (`unidadesOrganicas`, `periodosEstudo`, `nacionalidades`, etc.) caso não existam;
- Conversão de valores antigos em texto solto (`turno: 'Manhã'`, `sala: 'Sala 4'`, `ano: 2`) para os IDs relacionais correspondentes (`turno: 'pe1'`, `localTipo/localId`, `ano: 'ae2'`);
- Preenchimento de `configAvaliacao`, `calendarioAcademico`, campos pessoais novos do Aluno/Candidato (género, nacionalidade, BI, filiação), etc.

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
| `configAvaliacao` | object | `{ numProvas: 2 }` — número de provas antes do Exame Final (2 a 4, configurável) |
| `permissoes` | object | Matriz `perfil → módulo → { view, create, edit, delete }` |

### 5.2 Tabelas de apoio / Cadastros (13 tabelas relacionais)

Todas geridas pelo módulo genérico **Cadastros** (secção 6.14), cada uma com o seu próprio prefixo de ID:

| Tabela (`state.*`) | Prefixo ID | Campos principais | Referenciada por |
|---|---|---|---|
| `unidadesOrganicas` | `uo` | nome, sigla | `cursos.unidadeOrganicaId` |
| `edificios` | `ed` | nome, descrição | `salas.edificioId`, `laboratorios.edificioId` |
| `salas` | `sl` | nome, edifícioId, capacidade | `turmas.localId` (quando `localTipo='Sala'`) |
| `laboratorios` | `lb` | nome, edifícioId, capacidade, especialidade | `turmas.localId` (quando `localTipo='Laboratorio'`) |
| `provincias` | `pv` | nome | `municipios.provinciaId`, `alunos/candidatos.provinciaId` |
| `municipios` | `mn` | nome, provinciaId | `escolasProveniencia.municipioId`, `alunos/candidatos.municipioId` |
| `escolasProveniencia` | `ep` | nome, municipioId | `alunos/candidatos.escolaProvenienciaId` |
| `generos` | `gn` | nome | `alunos/candidatos.generoId` |
| `nacionalidades` | `nc` | nome | `alunos/candidatos.nacionalidadeId` |
| `cursosProveniencia` | `cp` | nome, instituição | `alunos/candidatos.cursoProvenienciaId` |
| `periodosEstudo` | `pe` | nome (Manhã/Tarde/Noite) | `turmas.turno`, `vagas.turno`, `financeiro.turno`, `candidatos.turnoPretendido` |
| `anosEstudo` | `ae` | nome, ordem | `disciplinas.ano`, `alunos.anoCurricular` |
| `horarios` | `hr` | nome, início, fim | `turmas.hora` |

A configuração de cada tabela (campos, tipo de input, obrigatoriedade, referências) está centralizada na constante `CADASTRO_TIPOS`; as dependências para aviso de eliminação estão em `CADASTRO_DEPENDENCIAS`.

### 5.3 Entidades académicas

| Tabela | Prefixo ID | Campos-chave | Notas |
|---|---|---|---|
| `cursos` | `c` | nome, sigla, unidadeOrganicaId, grau, duracaoAnos, coordenador | Sigla usada no código automático da turma |
| `professores` | `p` | nome, email, telefone, especialidade, status | |
| `disciplinas` | `d` | nome, cursoId, professorId, ano (→ `anosEstudo`), semestre, cargaHoraria | |
| `turmas` | `t` | disciplinaId, professorId, localTipo/localId, dia, hora (→ `horarios`), vagas, turno (→ `periodosEstudo`), regime, anoLetivo | Código gerado automaticamente (secção 5.6) |
| `alunos` | `a` | numero, nome, email, telefone, cursoId, anoCurricular, ingresso, status, generoId, nacionalidadeId, provinciaId, municipioId, numeroBI, dataEmissaoBI, nomePai, nomeMae, escolaProvenienciaId, cursoProvenienciaId | |
| `matriculas` | `m` | alunoId, cursoId, anoLetivo, data, status | Única por (aluno, curso, ano letivo) |
| `candidatos` | `cand` | numero, nome, dados pessoais (iguais aos do Aluno), cursoPretendidoId, turnoPretendido, anoLetivo, dataInscricao, notaExame, status, alunoId | Ver fluxo de admissão (6.6) |
| `vagas` | `vg` | cursoId, turno, anoLetivo, quantidade | Vagas declaradas por grupo curso+turno+ano |

### 5.4 Avaliação e frequência

| Tabela | Prefixo ID | Campos-chave |
|---|---|---|
| `notas` | `n` | alunoId, disciplinaId, turmaId, anoLetivo, `prova1`..`prova4` (conforme `configAvaliacao.numProvas`), exameFinal, exameRecurso, exameEspecial, exameMelhoria |
| `periodos` | `pr` | turmaId, tipo (ex.: `prova1`, `exameFinal`), inicio, fim — janela em que o docente pode lançar essa etapa |
| `submissoes` | `sb` | turmaId, tipo, submetidoEm, submetidoPor — bloqueia relançamento até reabertura |
| `reaberturas` | `rb` | turmaId, tipo, motivo, solicitadoPor, solicitadoEm, status, respondidoEm |
| `melhorias` | `me` | alunoId, disciplinaId, turmaId, solicitadoEm, status, respondidoEm |
| `frequencia` | `f` | turmaId, data, presencas (`{ alunoId: boolean }`) |

### 5.5 Financeiro, Biblioteca, RH, Utilizadores

| Tabela | Prefixo ID | Campos-chave |
|---|---|---|
| `financeiro` | `fi` | alunoId, descrição, valor, vencimento, status, anoLetivo, turno, regime, dataPagamento |
| `livros` | `l` | título, autor, categoria, exemplares, disponíveis |
| `emprestimos` | `e` | livroId, alunoId, dataEmprestimo, dataPrevista, dataDevolucao |
| `funcionarios` | `rh` | nome, cargo, departamento, tipo, professorId (opcional), dataAdmissao, salário, status |
| `usuarios` | `u` | nome, email, senha (texto simples — ver aviso 12.2), papel, refId (ligação a Professor/Aluno), status |

### 5.6 Regras derivadas importantes

- **Código automático da turma** (`turmaCodigoBase` / `turmaCodigo`): combina sigla do curso + ordem do ano de estudo + letra do turno + letra do regime (ex.: `EI2-MR` = Engenharia Informática, 2º ano, Manhã, Regular). Em caso de colisão entre turmas do mesmo grupo, adiciona sufixo `-1`, `-2`, ordenado por `id`.
- **Rótulo do ano letivo** (`anoLetivoLabel`): o valor armazenado é sempre o ano em que o ciclo **termina**; a etiqueta mostrada é sempre `{ano-1}/{ano}`.
- **Número de aluno** (`gerarNumeroAluno`): formato `{anoLetivo}-{siglaCurso}-{sequencial com 3 dígitos}`.

---

## 6. Módulos Funcionais

### 6.1 Autenticação e Perfis

Login simulado por comparação direta de `email`+`senha` contra `state.usuarios` (**sem hashing** — ver aviso 12.2). Existem **9 perfis** (`ROLES`):

| Perfil | Acesso predefinido |
|---|---|
| `admin` | Total a todos os módulos (concedido automaticamente pelo *loop* em `defaultPermissoes()`) |
| `secretaria_academica` | Total em Alunos, Professores, Inscrições, Cursos, Disciplinas, Turmas, Matrículas, Períodos, Cadastros; só visualização em Notas/Frequência |
| `tecnico_sec_academica` | Como acima, mas sem eliminar e sem gerir Cursos/Disciplinas (só visualização) |
| `professor` | Painel do Professor, Notas e Frequência (criar/editar), Turmas/Períodos (visualização) |
| `estudante` | Só "Meu Painel" |
| `secretaria_financeira` | Total em Financeiro; visualização de Alunos |
| `tecnico_sec_financeira` | Financeiro sem eliminar; visualização de Alunos |
| `biblioteca` | Total em Biblioteca; visualização de Alunos |
| `recursos_humanos` | Total em RH; visualização de Professores |

Cada permissão é um objeto `{ view, create, edit, delete }`, verificado via `hasPerm(modulo, acao)`. A matriz completa é editável pelo Admin no módulo **Permissões** (secção 6.17), com "ver" imposto automaticamente como pré-requisito de qualquer outra ação.

### 6.2 Dashboard

KPIs agregados (alunos ativos, professores ativos, cursos/turmas, taxa de aprovação, receita pendente), distribuição de alunos por curso, situação financeira e alertas de pagamentos em atraso — filtrados por `hasPerm` (ex.: painel financeiro só aparece a quem tem acesso a Financeiro).

### 6.3 Painel do Professor / Meu Painel (Estudante)

- **Painel do Professor**: turmas atribuídas, estado da avaliação por turma (etapa atual, janela aberta/fechada), atalhos para Notas/Frequência/Períodos.
- **Meu Painel** (estudante): dados pessoais, horário semanal (grelha gerada por `renderScheduleGrid`), notas e situação, extrato financeiro (com botão de simulação de pagamento), empréstimos de biblioteca, e opção de solicitar Exame de Melhoria quando aplicável.

Visibilidade da sidebar controlada por `applyNavVisibility()`, que esconde `data-module` sem permissão de `view`.

### 6.4 Alunos / Professores

CRUD completo. Aluno inclui pesquisa e filtros por curso/ano/turma/estado, e todos os campos pessoais (naturalidade província/município em cascata, género, nacionalidade, BI, filiação, escola/curso de proveniência). Exportação Excel disponível.

### 6.5 Cursos / Disciplinas / Turmas / Matrículas

- **Cursos**: nome, sigla, Unidade Orgânica, grau, duração, coordenador.
- **Disciplinas**: ligadas a Curso, Professor, Ano de Estudo (cadastro) e semestre.
- **Turmas**: disciplina, professor, tipo+local (Sala ou Laboratório, cascata), dia/horário (cadastro), turno (Período de Estudo), regime, vagas. Deteção de conflito de horário (mesmo local+dia+hora). Inclui mapa semanal visual (`renderScheduleGrid`).
- **Matrículas**: liga Aluno+Curso+Ano Letivo, com verificação de duplicação.

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

- **Configuração da Avaliação** (só quem tem permissão de editar Períodos): número de provas antes do Exame Final, entre 2 e 4 (`configAvaliacao.numProvas`), aplicado globalmente e de imediato a todas as turmas.
- **Janelas de lançamento por turma**: a Secretaria define, por turma, o intervalo de datas em que cada etapa (`Prova 1..N`, Exame Final, Recurso, Especial) pode ser lançada pelo docente. Sem período aberto, o lançamento fica bloqueado.
- **Reaberturas**: se o docente precisar de lançar/corrigir fora da janela, solicita reabertura (com motivo); a Secretaria aprova ou rejeita.
- **Exame de Melhoria**: pedido individual do aluno (feito em "Meu Painel"), aprovado pela Secretaria, só depois lançável pelo docente — **não** faz parte da sequência obrigatória por turma.

### 6.8 Notas — Motor de Avaliação

Sequência obrigatória por turma (`tiposAvaliacao()`, gerada dinamicamente conforme `numProvas`): `Prova 1 → ... → Prova N → Exame Final → Exame de Recurso → Exame Especial`. Cada etapa só pode ser lançada depois da anterior estar submetida (`estagioAtual`, `isSubmetido`, `janelaStatus`).

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

Todas as notas são arredondadas a 1 casa decimal (`round1`). A interface de lançamento (`renderNotasLancamento`) gera colunas dinamicamente conforme `numProvas`, mostra só os alunos relevantes em cada etapa (ex.: quem não dispensou, no Exame Final) e oferece "Gravar rascunho" (sem submeter) vs. "Gravar e Submeter" (bloqueia a etapa e avança).

### 6.9 Frequência

Registo de presenças por turma+data (`renderFrequencia`). **Extrato de Frequência** (`renderFrequenciaExtrato`) calcula percentagem de presença por aluno e assinala risco (`FREQUENCIA_MINIMA = 75%`) com badge "Risco de Reprovação por Faltas". Inclui:
- **Imprimir (PDF)**: usa `window.print()` restrito à secção atual via CSS `@media print` dedicado (esconde sidebar/topbar/botões, mostra só o extrato);
- **Exportar Excel**: gera `.xlsx` com os mesmos dados.

### 6.10 Financeiro

Lançamentos (propinas/taxas) por aluno, com filtros por estado/ano/período/regime, total filtrado, "Marcar pago", e exportação Excel.

### 6.11 Biblioteca

Catálogo de livros (exemplares/disponíveis) e empréstimos ativos (com devolução), ambos com exportação Excel separada.

### 6.12 Recursos Humanos

Funcionários (docentes e não-docentes), opcionalmente ligados a um registo de Professor.

### 6.13 Cadastros (módulo genérico)

Um único par de funções (`renderCadastros` / `openCadastroForm` / `deleteCadastro`) serve as 13 tabelas de apoio da secção 5.2, evitando duplicar código de CRUD. A configuração de cada tabela — campos, tipos (`text`, `number`, `time`, `ref`), obrigatoriedade e referências — vive na constante `CADASTRO_TIPOS`; a eliminação verifica dependências (`CADASTRO_DEPENDENCIAS`) e avisa se o registo está em uso noutro módulo antes de remover.

### 6.14 Utilizadores e Permissões

- **Utilizadores**: gestão de contas (nome, email, senha em texto simples, perfil, associação a Professor/Aluno quando aplicável, estado). Protegida contra remover o próprio utilizador em sessão e contra ficar sem nenhum Administrador.
- **Permissões**: matriz editável perfil × módulo × ação, com "Repor predefinições" por perfil. O perfil Administrador não é configurável aqui (acesso total fixo).

### 6.15 Backups

Como não existe backend/BD real, o "backup do sistema" é o próprio `state` gravado com metadados (data/hora, ano letivo, contagem de registos por tabela):

- **Backup automático**: uma vez por dia (por sessão de browser), ao carregar a aplicação (`verificarBackupAutomatico`), guardado silenciosamente no histórico rotativo (até 15 entradas).
- **Backup manual (JSON)**: descarrega um ficheiro `.json` com metadados + `state` completo.
- **Backup em Excel**: workbook multi-separador (uma *sheet* por tabela), dados em bruto (incluindo IDs internos) — pensado como cópia de segurança re-importável, distinto das exportações "amigáveis" por módulo.
- **Restaurar**: a partir do histórico local ou de um ficheiro `.json` carregado — substitui `state` por inteiro, com confirmação explícita.

### 6.16 Auditoria e Gestão de Logs

Módulo **exclusivo do Administrador**. Regista automaticamente (`registrarLog(acao, modulo, descricao)`):

- Login (sucesso/falha, com o email tentado quando falha) e Logout;
- Criação/edição/remoção em todas as entidades de dados (Alunos, Professores, Cursos, Disciplinas, Turmas, Matrículas, Inscrições, Cadastros, Financeiro, Biblioteca, RH, Utilizadores);
- Processamento de admissões, lançamento/submissão de notas, aprovação/rejeição de reaberturas e pedidos de melhoria;
- Alterações de Permissões (com lista dos módulos alterados);
- Configuração da Avaliação (mudança do número de provas);
- Backups, restauro de backup e reposição de dados.

Cada evento guarda `timestamp`, `userId`/`userNome`/`papel` (autor), `acao`, `modulo` e `descricao`. A tela `renderAuditoria` oferece filtros (utilizador, módulo, ação, intervalo de datas, texto livre), exportação Excel e duas ações de gestão de retenção: **"Limpar mais antigos que 90 dias"** e **"Limpar todo o histórico"** (ambas com confirmação, irreversíveis). Por segurança, a palavra-passe nunca é escrita na descrição de um log.

---

## 7. Exportação de Dados

### 7.1 Excel (todos os módulos de listagem)

Cada ecrã de listagem (Alunos, Professores, Cursos, Disciplinas, Turmas, Matrículas, Inscrições, Notas, Frequência, Financeiro, Biblioteca, RH, Cadastros, Utilizadores, Auditoria) tem um botão **"Exportar Excel"** que invoca o helper genérico:

```js
function exportarExcel(filename, sheetName, rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename + '.xlsx');
}
```

Os dados exportados usam **nomes legíveis** (ex.: nome do curso em vez do ID), respeitando os filtros aplicados no ecrã no momento da exportação.

### 7.2 PDF (Extrato de Frequência)

Não é gerado um PDF binário — usa-se a funcionalidade nativa "Imprimir" do browser (`window.print()`), restrita à área relevante por uma folha de estilos de impressão dedicada (`@media print` em `styles.css`), que esconde toda a interface de navegação e mostra só o conteúdo do extrato com um cabeçalho próprio inserido dinamicamente (`imprimirSecao(titulo)`).

### 7.3 Dependência externa

A exportação Excel depende da biblioteca **SheetJS**, carregada via CDN em `index.html`:

```html
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
```

Esta é a **única dependência externa** de todo o sistema. Sem ligação à internet no momento do carregamento da página, os botões de exportação Excel ficam indisponíveis (o sistema deteta isto via `xlsxDisponivel()` e avisa por *toast*), mas o resto da aplicação continua a funcionar normalmente offline.

---

## 8. Segurança e Modelo de Ameaças (estado atual do protótipo)

Este é um protótipo de demonstração de fluxo funcional, **não um sistema pronto para produção**. Pontos relevantes:

| Aspeto | Estado atual | Risco |
|---|---|---|
| Palavras-passe | Texto simples, comparação direta, guardadas no `localStorage` | Qualquer pessoa com acesso ao browser vê as credenciais em claro |
| Autorização | Só no *frontend* (`hasPerm`), sem qualquer imposição do lado do servidor | Um utilizador com conhecimentos técnicos pode alterar `state` diretamente via consola do browser e contornar qualquer restrição |
| Sessão | Um objeto simples em `localStorage`, sem expiração, sem token assinado | Sessão persiste indefinidamente; fácil de forjar |
| Dados sensíveis | BI, filiação, dados pessoais completos guardados em claro no `localStorage` do browser | Sem isolamento nem encriptação em repouso |
| Multiutilizador | Cada browser/dispositivo tem o seu próprio `state` isolado — não há sincronização entre postos | Dados nunca partilhados entre secretaria/professor/aluno em máquinas diferentes |
| Auditoria | Reflete fielmente ações feitas *através da UI*; não deteta manipulação direta do `localStorage` | Um utilizador técnico pode editar dados sem deixar rasto de auditoria |

Estas limitações são inerentes à natureza do protótipo (sem backend) e devem ser resolvidas antes de qualquer utilização com dados reais de estudantes — nomeadamente via uma migração para uma arquitetura cliente-servidor com autenticação e autorização do lado do servidor, base de dados real e HTTPS.

---

## 9. Como Executar

Não há build nem dependências a instalar (à exceção da ligação à internet para o SheetJS, opcional). Basta servir a pasta com qualquer servidor estático:

```bash
cd sga-academico
python -m http.server 5500
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
- **Prefixos de ID por entidade** — ver tabelas na secção 5 — gerados por `nextId(prefixo)`, que incrementa `state.seq` global.
- **Sem comentários redundantes**: comentários existem apenas onde a lógica não é óbvia pelo nome (ex.: fórmulas de avaliação, motivo de uma decisão de desenho).
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
11. Módulo de Auditoria e Gestão de Logs (este documento reflete o sistema até este ponto).

Uma tentativa de migração para um backend real (Next.js + Prisma + SQLite) foi planeada e parcialmente iniciada, mas **foi cancelada a pedido explícito** antes de qualquer código de backend ser finalizado; o protótipo permaneceu estático.

---

## 12. Limitações Conhecidas

1. **Sem backend real** — todas as regras de negócio e permissões correm e são impostas inteiramente no browser.
2. **Sem multiutilizador real** — cada browser tem o seu próprio `state`; não há sincronização entre postos de trabalho.
3. **Senhas em texto simples** — aceitável apenas para demonstração local.
4. **Limite de armazenamento do `localStorage`** (tipicamente 5–10 MB por origem) — em uso prolongado com muitos registos, dados, backups e logs, este limite pode ser atingido; o sistema já pratica rotação (backups: últimos 15; logs: últimos 3000) para mitigar isto, mas o crescimento de `state` em si não é limitado.
5. **Exportação Excel requer internet** na primeira utilização (CDN do SheetJS); sem cache do browser para esse script, os botões de exportação falham graciosamente com aviso, mas o resto do sistema continua operacional offline.
6. **Auditoria não é à prova de manipulação** — reflete ações feitas através da interface; alterações diretas ao `localStorage` via consola do browser não ficam registadas.
7. **Sem testes automatizados** — toda a verificação foi feita manualmente via browser automatizado durante o desenvolvimento (login por perfil, fluxos ponta-a-ponta por módulo).

---

*Fim do documento.*
