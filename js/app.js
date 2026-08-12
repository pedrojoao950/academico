/* =========================================================================
   SIGA — Sistema Integrado de Gestão Acadêmica (protótipo estático)
   Tudo em memória + localStorage. Sem backend real.

   Autenticação/permissões são uma SIMULAÇÃO para fins de demonstração de
   fluxo (login mock, senhas em texto simples guardadas no localStorage do
   próprio browser). NÃO usar este mecanismo tal como está em produção —
   substituir por autenticação real do lado do servidor.
   ========================================================================= */

const STORAGE_KEY = 'sga_academico_v1';
const SESSION_KEY = 'sga_academico_session_v1';
const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

const ROLES = [
  'admin', 'secretaria_academica', 'tecnico_sec_academica', 'professor', 'estudante',
  'secretaria_financeira', 'tecnico_sec_financeira', 'biblioteca', 'recursos_humanos',
];
const ROLE_LABELS = {
  admin: 'Administrador',
  secretaria_academica: 'Secretaria Académica',
  tecnico_sec_academica: 'Técnico Sec. Académica',
  professor: 'Professor',
  estudante: 'Estudante',
  secretaria_financeira: 'Secretaria Financeira',
  tecnico_sec_financeira: 'Técnico Sec. Financeira',
  biblioteca: 'Biblioteca',
  recursos_humanos: 'Recursos Humanos',
};

const MODULES = [
  'dashboard', 'painelProfessor', 'meuPainel',
  'alunos', 'professores',
  'inscricoes', 'cursos', 'disciplinas', 'turmas', 'matriculas', 'periodos', 'notas', 'frequencia',
  'trabalhos', 'materiais',
  'financeiro', 'biblioteca', 'rh', 'cadastros',
  'utilizadores', 'permissoes', 'backups', 'auditoria',
];
const MODULE_LABELS = {
  dashboard: 'Dashboard',
  painelProfessor: 'Painel do Professor',
  meuPainel: 'Meu Painel',
  alunos: 'Alunos',
  professores: 'Professores',
  inscricoes: 'Inscrições',
  cursos: 'Cursos',
  disciplinas: 'Disciplinas',
  turmas: 'Turmas & Horários',
  matriculas: 'Matrículas',
  periodos: 'Períodos de Avaliação',
  notas: 'Notas',
  frequencia: 'Frequência',
  trabalhos: 'Trabalhos',
  materiais: 'Materiais',
  financeiro: 'Financeiro',
  biblioteca: 'Biblioteca',
  rh: 'Recursos Humanos',
  cadastros: 'Cadastros',
  utilizadores: 'Utilizadores',
  permissoes: 'Permissões',
  backups: 'Backups',
  auditoria: 'Auditoria e Logs',
};
const NOTA_MINIMA_ADMISSAO = 10;
/* Frequência mínima exigida — abaixo disso, alerta antecipado de risco de
   reprovação por faltas (independentemente das notas). */
const FREQUENCIA_MINIMA = 75;
/* Idade mínima assumida para acesso ao ensino superior em Angola — ajustável
   caso a instituição use outro critério. */
const IDADE_MINIMA_ADMISSAO = 17;

/* Sequência obrigatória de avaliações por turma — cada etapa só pode ser
   lançada depois de a anterior estar submetida. O Exame de Melhoria NÃO faz
   parte desta sequência: é individual, feito só para o aluno que o solicita
   (ver fluxo de pedido/aprovação mais abaixo), não uma etapa em bloco.
   O NÚMERO de provas antes do exame (2 a 4) é configurável pela Secretaria
   Académica — ver state.configAvaliacao.numProvas, editável no painel
   "Configuração da Avaliação" em Períodos de Avaliação. */
const NUM_PROVAS_MIN = 2;
const NUM_PROVAS_MAX = 4;
function numProvas() {
  return (state && state.configAvaliacao && state.configAvaliacao.numProvas) || 2;
}
function provaKeys() {
  return Array.from({ length: numProvas() }, (_, i) => 'prova' + (i + 1));
}
function tiposAvaliacao() {
  return [
    ...provaKeys().map((key, i) => ({ key, label: `Prova ${i + 1}` })),
    { key: 'exameFinal', label: 'Exame Final' },
    { key: 'exameRecurso', label: 'Exame de Recurso' },
    { key: 'exameEspecial', label: 'Exame Especial' },
  ];
}
function tipoLabel(key) { return key === 'exameMelhoria' ? 'Exame de Melhoria' : ((tiposAvaliacao().find(t => t.key === key) || {}).label || key); }

/* Regimes de funcionamento das turmas — usados para gerar o código automático
   de cada turma (ex.: EI2-MR = Engenharia Informática, 2º ano, Manhã,
   Regular). Período de Estudo (Manhã/Tarde/Noite) DEIXOU de ser uma lista
   fixa aqui — é agora o cadastro editável `state.periodosEstudo` (ver
   seed() e o módulo Cadastros). */
const REGIMES = ['Regular', 'Pós-Laboral'];

/* Normas de citação bibliográfica disponíveis no registo de livros da
   Biblioteca (registo da fonte) e na exportação da lista de obras. */
const NORMAS_CITACAO = ['APA', 'ABNT', 'Vancouver', 'ISO 690'];
/* Gera uma referência bibliográfica simplificada segundo a norma escolhida —
   cobre o essencial (autor, título, edição, local, editora, ano, ISBN) sem
   pretender tratar todos os casos especiais (múltiplos autores, capítulos,
   artigos, etc.) das normas reais. */
function formatarCitacao(livro, norma) {
  const autor = livro.autor || 's.n.';
  const titulo = livro.titulo || 's.t.';
  const edicaoTxt = livro.edicao ? `${livro.edicao}. ed.` : '';
  const local = livro.local || 's.l.';
  const editora = livro.editora || 's.n.';
  const ano = livro.anoPublicacao || 's.d.';
  const isbnTxt = livro.isbn ? `ISBN ${livro.isbn}.` : '';
  switch (norma) {
    case 'APA':
      return `${autor} (${ano}). ${titulo}${edicaoTxt ? ` (${edicaoTxt})` : ''}. ${editora}.`;
    case 'ABNT':
      return `${autor.toUpperCase()}. ${titulo}. ${edicaoTxt ? edicaoTxt + ' ' : ''}${local}: ${editora}, ${ano}.`;
    case 'Vancouver':
      return `${autor}. ${titulo}. ${edicaoTxt ? edicaoTxt + ' ' : ''}${local}: ${editora}; ${ano}.`;
    case 'ISO 690':
      return `${autor.toUpperCase()}. ${titulo}. ${edicaoTxt ? edicaoTxt + ' ' : ''}${local}: ${editora}, ${ano}. ${isbnTxt}`.trim();
    default:
      return `${autor}. ${titulo}. ${ano}.`;
  }
}
const TURNO_LETRA = { 'Manhã': 'M', 'Tarde': 'T', 'Noite': 'N' };
const REGIME_LETRA = { 'Regular': 'R', 'Pós-Laboral': 'PL' };

/* Configuração genérica dos 12 cadastros/tabelas de apoio (módulo Cadastros).
   Cada um vira uma tela de CRUD simples gerada a partir desta config — ver
   renderCadastros/openCadastroForm mais abaixo. */
const CADASTRO_TIPOS = [
  { key: 'unidadesOrganicas', label: 'Unidade Orgânica', prefixo: 'uo', campos: [
      { key: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
      { key: 'sigla', label: 'Sigla', tipo: 'text' },
    ] },
  { key: 'edificios', label: 'Edifícios', prefixo: 'ed', campos: [
      { key: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
      { key: 'descricao', label: 'Descrição', tipo: 'text' },
    ] },
  { key: 'salas', label: 'Salas', prefixo: 'sl', campos: [
      { key: 'nome', label: 'Nome/Número', tipo: 'text', obrigatorio: true },
      { key: 'edificioId', label: 'Edifício', tipo: 'ref', ref: 'edificios' },
      { key: 'capacidade', label: 'Capacidade', tipo: 'number' },
    ] },
  { key: 'laboratorios', label: 'Laboratórios', prefixo: 'lb', campos: [
      { key: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
      { key: 'edificioId', label: 'Edifício', tipo: 'ref', ref: 'edificios' },
      { key: 'capacidade', label: 'Capacidade', tipo: 'number' },
      { key: 'especialidade', label: 'Especialidade', tipo: 'text' },
    ] },
  { key: 'provincias', label: 'Província', prefixo: 'pv', campos: [
      { key: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
    ] },
  { key: 'municipios', label: 'Município', prefixo: 'mn', campos: [
      { key: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
      { key: 'provinciaId', label: 'Província', tipo: 'ref', ref: 'provincias', obrigatorio: true },
    ] },
  { key: 'escolasProveniencia', label: 'Escola de Proveniência', prefixo: 'ep', campos: [
      { key: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
      { key: 'municipioId', label: 'Município', tipo: 'ref', ref: 'municipios' },
    ] },
  { key: 'generos', label: 'Género', prefixo: 'gn', campos: [
      { key: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
    ] },
  { key: 'nacionalidades', label: 'Nacionalidade', prefixo: 'nc', campos: [
      { key: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
    ] },
  { key: 'cursosProveniencia', label: 'Curso de Proveniência', prefixo: 'cp', campos: [
      { key: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
      { key: 'instituicao', label: 'Instituição', tipo: 'text' },
    ] },
  { key: 'periodosEstudo', label: 'Período de Estudo', prefixo: 'pe', campos: [
      { key: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
    ] },
  { key: 'anosEstudo', label: 'Ano de Estudo', prefixo: 'ae', campos: [
      { key: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
      { key: 'ordem', label: 'Ordem', tipo: 'number', obrigatorio: true },
    ] },
  { key: 'horarios', label: 'Horários (Tempos Letivos)', prefixo: 'hr', campos: [
      { key: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
      { key: 'inicio', label: 'Início', tipo: 'time', obrigatorio: true },
      { key: 'fim', label: 'Fim', tipo: 'time', obrigatorio: true },
    ] },
  { key: 'categoriasDocentes', label: 'Categoria Docente', prefixo: 'cd', campos: [
      { key: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true },
      { key: 'ordem', label: 'Ordem na carreira', tipo: 'number', obrigatorio: true },
    ] },
];

/* Quem referencia cada cadastro — usado para avisar antes de eliminar um
   item ainda em uso (mesma UX de aviso já usada em Curso/Professor). */
const CADASTRO_DEPENDENCIAS = {
  unidadesOrganicas: [{ tabela: 'cursos', campo: 'unidadeOrganicaId' }],
  edificios: [{ tabela: 'salas', campo: 'edificioId' }, { tabela: 'laboratorios', campo: 'edificioId' }],
  salas: [{ tabela: 'aulas', campo: 'localId', filtro: a => a.localTipo === 'Sala' }],
  laboratorios: [{ tabela: 'aulas', campo: 'localId', filtro: a => a.localTipo === 'Laboratorio' }],
  provincias: [{ tabela: 'municipios', campo: 'provinciaId' }, { tabela: 'alunos', campo: 'provinciaId' }, { tabela: 'candidatos', campo: 'provinciaId' }],
  municipios: [{ tabela: 'escolasProveniencia', campo: 'municipioId' }, { tabela: 'alunos', campo: 'municipioId' }, { tabela: 'candidatos', campo: 'municipioId' }],
  escolasProveniencia: [{ tabela: 'alunos', campo: 'escolaProvenienciaId' }, { tabela: 'candidatos', campo: 'escolaProvenienciaId' }],
  generos: [{ tabela: 'alunos', campo: 'generoId' }, { tabela: 'candidatos', campo: 'generoId' }],
  nacionalidades: [{ tabela: 'alunos', campo: 'nacionalidadeId' }, { tabela: 'candidatos', campo: 'nacionalidadeId' }],
  cursosProveniencia: [{ tabela: 'alunos', campo: 'cursoProvenienciaId' }, { tabela: 'candidatos', campo: 'cursoProvenienciaId' }],
  periodosEstudo: [{ tabela: 'turmas', campo: 'turno' }, { tabela: 'vagas', campo: 'turno' }, { tabela: 'financeiro', campo: 'turno' }, { tabela: 'candidatos', campo: 'turnoPretendido' }],
  anosEstudo: [{ tabela: 'disciplinas', campo: 'ano' }, { tabela: 'alunos', campo: 'anoCurricular' }],
  horarios: [{ tabela: 'aulas', campo: 'hora' }],
  categoriasDocentes: [{ tabela: 'professores', campo: 'categoriaDocenteId' }],
};

let state = null;
let currentUser = null;
let currentSection = 'dashboard';

/* ------------------------------ Permissões ------------------------------ */

function permFull() { return { view: true, create: true, edit: true, delete: true }; }
function permView() { return { view: true, create: false, edit: false, delete: false }; }
function permViewCreateEdit() { return { view: true, create: true, edit: true, delete: false }; }
function permNone() { return { view: false, create: false, edit: false, delete: false }; }

function defaultPermissoes() {
  const allNone = {};
  MODULES.forEach(m => { allNone[m] = permNone(); });

  const admin = {};
  MODULES.forEach(m => { admin[m] = permFull(); });

  return {
    admin,
    secretaria_academica: {
      ...allNone,
      dashboard: permView(),
      alunos: permFull(),
      professores: permFull(),
      inscricoes: permFull(),
      cursos: permFull(),
      disciplinas: permFull(),
      turmas: permFull(),
      matriculas: permFull(),
      periodos: permFull(),
      notas: permView(),
      frequencia: permView(),
      cadastros: permFull(),
      trabalhos: permView(),
      materiais: permView(),
    },
    // Perfil auxiliar da Secretaria Académica: trata do dia-a-dia (alunos,
    // turmas, matrículas, períodos) mas sem poder eliminar registos nem
    // mexer na estrutura de cursos/disciplinas — isso fica com a Secretaria.
    tecnico_sec_academica: {
      ...allNone,
      dashboard: permView(),
      alunos: permViewCreateEdit(),
      professores: permView(),
      inscricoes: permViewCreateEdit(),
      cursos: permView(),
      disciplinas: permView(),
      turmas: permViewCreateEdit(),
      matriculas: permViewCreateEdit(),
      periodos: permViewCreateEdit(),
      notas: permView(),
      frequencia: permView(),
      cadastros: permView(),
      trabalhos: permView(),
      materiais: permView(),
    },
    professor: {
      ...allNone,
      painelProfessor: permView(),
      turmas: permView(),
      periodos: permView(),
      notas: permViewCreateEdit(),
      frequencia: permViewCreateEdit(),
      trabalhos: permFull(),
      materiais: permViewCreateEdit(),
    },
    estudante: {
      ...allNone,
      meuPainel: permView(),
    },
    secretaria_financeira: {
      ...allNone,
      dashboard: permView(),
      alunos: permView(),
      financeiro: permFull(),
    },
    // Perfil auxiliar da Secretaria Financeira: lança e atualiza propinas/taxas
    // no dia-a-dia, mas não elimina lançamentos (auditoria fica com a Secretaria).
    tecnico_sec_financeira: {
      ...allNone,
      dashboard: permView(),
      alunos: permView(),
      financeiro: permViewCreateEdit(),
    },
    biblioteca: {
      ...allNone,
      alunos: permView(),
      biblioteca: permFull(),
    },
    recursos_humanos: {
      ...allNone,
      dashboard: permView(),
      professores: permView(),
      rh: permFull(),
    },
  };
}

function hasPerm(moduleKey, action = 'view') {
  if (!currentUser) return false;
  const roleMap = state.permissoes[currentUser.papel];
  const modPerm = roleMap && roleMap[moduleKey];
  return !!(modPerm && modPerm[action]);
}

/* ---------------------------- Seed data -------------------------------- */

function seed() {
  // ---------------------------------------------------------------------
  // Cadastros / tabelas de apoio — relacionamentos reais em vez de texto
  // solto. Os IDs abaixo (uo1, ed1, sl1, pe1, ae1, hr1...) são referenciados
  // por Curso/Disciplina/Turma/Aluno/Candidato mais abaixo.
  // ---------------------------------------------------------------------
  const unidadesOrganicas = [
    { id: 'uo1', nome: 'Faculdade de Engenharia e Tecnologia', sigla: 'FET' },
    { id: 'uo2', nome: 'Faculdade de Ciências Económicas e Empresariais', sigla: 'FCEE' },
    { id: 'uo3', nome: 'Faculdade de Ciências da Saúde', sigla: 'FCS' },
  ];

  const edificios = [
    { id: 'ed1', nome: 'Edifício Principal', descricao: 'Bloco administrativo e salas gerais' },
    { id: 'ed2', nome: 'Edifício Anexo I', descricao: 'Laboratórios de Informática' },
    { id: 'ed3', nome: 'Edifício Anexo II', descricao: 'Salas de Enfermagem' },
  ];

  const salas = [
    { id: 'sl1', edificioId: 'ed1', nome: 'Sala 4', capacidade: 45 },
    { id: 'sl2', edificioId: 'ed1', nome: 'Sala 5', capacidade: 45 },
    { id: 'sl3', edificioId: 'ed1', nome: 'Sala 6', capacidade: 40 },
    { id: 'sl4', edificioId: 'ed3', nome: 'Sala 8', capacidade: 25 },
    { id: 'sl5', edificioId: 'ed1', nome: 'Sala 12', capacidade: 40 },
  ];

  const laboratorios = [
    { id: 'lb1', edificioId: 'ed2', nome: 'Lab. Informática 1', capacidade: 35, especialidade: 'Programação' },
    { id: 'lb2', edificioId: 'ed2', nome: 'Lab. Informática 2', capacidade: 30, especialidade: 'Redes e Bases de Dados' },
  ];

  const provincias = [
    { id: 'pv1', nome: 'Luanda' },
    { id: 'pv2', nome: 'Benguela' },
    { id: 'pv3', nome: 'Huíla' },
  ];

  const municipios = [
    { id: 'mn1', nome: 'Belas', provinciaId: 'pv1' },
    { id: 'mn2', nome: 'Cacuaco', provinciaId: 'pv1' },
    { id: 'mn3', nome: 'Talatona', provinciaId: 'pv1' },
    { id: 'mn4', nome: 'Benguela', provinciaId: 'pv2' },
    { id: 'mn5', nome: 'Lubango', provinciaId: 'pv3' },
  ];

  const escolasProveniencia = [
    { id: 'ep1', nome: 'Escola Secundária Mutu ya Kevela', municipioId: 'mn1' },
    { id: 'ep2', nome: 'Instituto Médio Politécnico de Luanda', municipioId: 'mn3' },
    { id: 'ep3', nome: 'Escola Secundária de Benguela', municipioId: 'mn4' },
  ];

  const generos = [
    { id: 'gn1', nome: 'Masculino' },
    { id: 'gn2', nome: 'Feminino' },
  ];

  const nacionalidades = [
    { id: 'nc1', nome: 'Angolana' },
    { id: 'nc2', nome: 'Portuguesa' },
    { id: 'nc3', nome: 'Outra' },
  ];

  const cursosProveniencia = [
    { id: 'cp1', nome: 'Técnico de Informática', instituicao: 'Instituto Médio Politécnico de Luanda' },
  ];

  // Substitui a antiga lista fixa TURNOS — agora editável pela Secretaria.
  const periodosEstudo = [
    { id: 'pe1', nome: 'Manhã' },
    { id: 'pe2', nome: 'Tarde' },
    { id: 'pe3', nome: 'Noite' },
  ];

  // Substitui os números soltos "1º/2º/3º ano" por um cadastro editável.
  const anosEstudo = [
    { id: 'ae1', nome: '1º Ano', ordem: 1 },
    { id: 'ae2', nome: '2º Ano', ordem: 2 },
    { id: 'ae3', nome: '3º Ano', ordem: 3 },
    { id: 'ae4', nome: '4º Ano', ordem: 4 },
    { id: 'ae5', nome: '5º Ano', ordem: 5 },
  ];

  // Substitui a lista fixa HORAS (só horas de início) por tempos letivos
  // com nome e hora de fim, editáveis pela Secretaria.
  const horarios = [
    { id: 'hr1', nome: '1º Tempo (Manhã)', inicio: '08:00', fim: '09:30' },
    { id: 'hr2', nome: '2º Tempo (Manhã)', inicio: '09:30', fim: '11:00' },
    { id: 'hr3', nome: '3º Tempo (Manhã)', inicio: '11:00', fim: '12:30' },
    { id: 'hr4', nome: '1º Tempo (Tarde)', inicio: '14:00', fim: '15:30' },
    { id: 'hr5', nome: '2º Tempo (Tarde)', inicio: '15:30', fim: '17:00' },
    { id: 'hr6', nome: '1º Tempo (Noite)', inicio: '17:00', fim: '18:30' },
  ];

  // Categoria docente — carreira académica do professor (progressão típica das
  // instituições de ensino superior angolanas). Referenciada por Professores.
  const categoriasDocentes = [
    { id: 'cd1', nome: 'Monitor', ordem: 1 },
    { id: 'cd2', nome: 'Assistente Estagiário', ordem: 2 },
    { id: 'cd3', nome: 'Assistente', ordem: 3 },
    { id: 'cd4', nome: 'Professor Auxiliar', ordem: 4 },
    { id: 'cd5', nome: 'Professor Associado', ordem: 5 },
    { id: 'cd6', nome: 'Professor Catedrático', ordem: 6 },
  ];

  const cursos = [
    { id: 'c1', nome: 'Engenharia Informática', sigla: 'EI', grau: 'Licenciatura', duracaoAnos: 4, coordenador: 'Dr. António Sachipengo', unidadeOrganicaId: 'uo1' },
    { id: 'c2', nome: 'Gestão de Empresas', sigla: 'GE', grau: 'Licenciatura', duracaoAnos: 4, coordenador: 'Dra. Ilda Manuel', unidadeOrganicaId: 'uo2' },
    { id: 'c3', nome: 'Enfermagem', sigla: 'EN', grau: 'Técnico Superior', duracaoAnos: 3, coordenador: 'Enf.º Domingos Kiala', unidadeOrganicaId: 'uo3' },
  ];

  const professores = [
    { id: 'p1', nome: 'Eng. Carlos Neto', email: 'carlos.neto@isp.ao', telefone: '923 000 111', especialidade: 'Programação', status: 'Ativo', categoriaDocenteId: 'cd4' },
    { id: 'p2', nome: 'Dra. Marta Ventura', email: 'marta.ventura@isp.ao', telefone: '923 000 222', especialidade: 'Matemática', status: 'Ativo', categoriaDocenteId: 'cd5' },
    { id: 'p3', nome: 'Dr. José Fernandes', email: 'jose.fernandes@isp.ao', telefone: '923 000 333', especialidade: 'Gestão', status: 'Ativo', categoriaDocenteId: 'cd6' },
    { id: 'p4', nome: 'Dra. Beatriz Lopes', email: 'beatriz.lopes@isp.ao', telefone: '923 000 444', especialidade: 'Contabilidade', status: 'Ativo', categoriaDocenteId: 'cd3' },
    { id: 'p5', nome: 'Enf.ª Ana Paulo', email: 'ana.paulo@isp.ao', telefone: '923 000 555', especialidade: 'Enfermagem Clínica', status: 'Inativo', categoriaDocenteId: 'cd2' },
  ];

  const disciplinas = [
    { id: 'd1', nome: 'Programação I', cursoId: 'c1', ano: 'ae1', semestre: 1, cargaHoraria: 90, professorId: 'p1' },
    { id: 'd2', nome: 'Matemática Discreta', cursoId: 'c1', ano: 'ae1', semestre: 1, cargaHoraria: 60, professorId: 'p2' },
    { id: 'd3', nome: 'Estruturas de Dados', cursoId: 'c1', ano: 'ae2', semestre: 1, cargaHoraria: 90, professorId: 'p1' },
    { id: 'd4', nome: 'Base de Dados', cursoId: 'c1', ano: 'ae2', semestre: 2, cargaHoraria: 75, professorId: 'p1' },
    { id: 'd5', nome: 'Princípios de Gestão', cursoId: 'c2', ano: 'ae1', semestre: 1, cargaHoraria: 60, professorId: 'p3' },
    { id: 'd6', nome: 'Contabilidade Geral', cursoId: 'c2', ano: 'ae1', semestre: 2, cargaHoraria: 75, professorId: 'p4' },
    { id: 'd7', nome: 'Marketing', cursoId: 'c2', ano: 'ae2', semestre: 1, cargaHoraria: 60, professorId: 'p3' },
    { id: 'd8', nome: 'Anatomia e Fisiologia', cursoId: 'c3', ano: 'ae1', semestre: 1, cargaHoraria: 90, professorId: 'p5' },
    { id: 'd9', nome: 'Enfermagem Fundamental', cursoId: 'c3', ano: 'ae1', semestre: 2, cargaHoraria: 90, professorId: 'p5' },
  ];

  // Turma = coorte de alunos (independente de Disciplina/Horário): id, curso,
  // ano de estudo, ano letivo, turno, regime, vagas. O código (ex.: "EI2-MR")
  // é sempre computado a partir destes 4 campos — nunca guardado (ver
  // turmaCodigoBase). Duas disciplinas do mesmo curso+ano podem ser dadas em
  // turno/regime diferentes (ex.: c1/ae2 tem uma coorte Regular-Manhã e outra
  // Pós-Laboral-Tarde) — por isso agrupamos por (curso, ano, turno, regime),
  // não só por (curso, ano).
  const turmas = [
    { id: 'tc1', cursoId: 'c1', anoEstudo: 'ae1', anoLetivo: 2026, turno: 'pe1', regime: 'Regular', vagas: 40 },
    { id: 'tc2', cursoId: 'c1', anoEstudo: 'ae2', anoLetivo: 2026, turno: 'pe1', regime: 'Regular', vagas: 30 },
    { id: 'tc3', cursoId: 'c1', anoEstudo: 'ae2', anoLetivo: 2026, turno: 'pe2', regime: 'Pós-Laboral', vagas: 30 },
    { id: 'tc4', cursoId: 'c2', anoEstudo: 'ae1', anoLetivo: 2026, turno: 'pe1', regime: 'Regular', vagas: 45 },
    { id: 'tc5', cursoId: 'c3', anoEstudo: 'ae1', anoLetivo: 2026, turno: 'pe1', regime: 'Regular', vagas: 25 },
    { id: 'tc6', cursoId: 'c3', anoEstudo: 'ae1', anoLetivo: 2026, turno: 'pe3', regime: 'Pós-Laboral', vagas: 25 },
    { id: 'tc7', cursoId: 'c2', anoEstudo: 'ae2', anoLetivo: 2026, turno: 'pe2', regime: 'Regular', vagas: 40 },
  ];

  // Aula = relação Turma↔Disciplina↔Professor↔Horário (esta linha era, até
  // agora, o que se chamava "turma" — mantém os mesmos IDs t1..t9).
  const aulas = [
    { id: 't1', turmaId: 'tc1', disciplinaId: 'd1', professorId: 'p1', dia: 0, hora: 'hr1', localTipo: 'Laboratorio', localId: 'lb1' },
    { id: 't2', turmaId: 'tc1', disciplinaId: 'd2', professorId: 'p2', dia: 1, hora: 'hr2', localTipo: 'Sala', localId: 'sl5' },
    { id: 't3', turmaId: 'tc2', disciplinaId: 'd3', professorId: 'p1', dia: 2, hora: 'hr3', localTipo: 'Laboratorio', localId: 'lb2' },
    { id: 't4', turmaId: 'tc3', disciplinaId: 'd4', professorId: 'p1', dia: 3, hora: 'hr4', localTipo: 'Laboratorio', localId: 'lb1' },
    { id: 't5', turmaId: 'tc4', disciplinaId: 'd5', professorId: 'p3', dia: 0, hora: 'hr2', localTipo: 'Sala', localId: 'sl1' },
    { id: 't6', turmaId: 'tc4', disciplinaId: 'd6', professorId: 'p4', dia: 1, hora: 'hr3', localTipo: 'Sala', localId: 'sl2' },
    { id: 't7', turmaId: 'tc5', disciplinaId: 'd8', professorId: 'p5', dia: 2, hora: 'hr1', localTipo: 'Sala', localId: 'sl4' },
    { id: 't8', turmaId: 'tc6', disciplinaId: 'd9', professorId: 'p5', dia: 4, hora: 'hr6', localTipo: 'Sala', localId: 'sl4' },
    { id: 't9', turmaId: 'tc7', disciplinaId: 'd7', professorId: 'p3', dia: 2, hora: 'hr4', localTipo: 'Sala', localId: 'sl3' },
  ];

  const alunos = [
    { id: 'a1', numero: '2026-EI-001', nome: 'Miguel dos Santos', email: 'miguel.santos@aluno.isp.ao', telefone: '912 111 001', cursoId: 'c1', anoCurricular: 'ae2', ingresso: 2025, status: 'Ativo', generoId: 'gn1', provinciaId: 'pv1', municipioId: 'mn1', escolaProvenienciaId: 'ep1', cursoProvenienciaId: null, nacionalidadeId: 'nc1', numeroBI: '003456789LA042', dataEmissaoBI: '2023-03-14', nomePai: 'José dos Santos', nomeMae: 'Maria Fernanda dos Santos' },
    { id: 'a2', numero: '2026-EI-002', nome: 'Luísa Kiesse', email: 'luisa.kiesse@aluno.isp.ao', telefone: '912 111 002', cursoId: 'c1', anoCurricular: 'ae1', ingresso: 2026, status: 'Ativo', generoId: 'gn2', provinciaId: 'pv1', municipioId: 'mn3', escolaProvenienciaId: 'ep2', cursoProvenienciaId: null, nacionalidadeId: 'nc1', numeroBI: null, dataEmissaoBI: null, nomePai: null, nomeMae: null },
    { id: 'a3', numero: '2026-EI-003', nome: 'Ricardo Bumba', email: 'ricardo.bumba@aluno.isp.ao', telefone: '912 111 003', cursoId: 'c1', anoCurricular: 'ae2', ingresso: 2025, status: 'Ativo', generoId: 'gn1', provinciaId: 'pv2', municipioId: 'mn4', escolaProvenienciaId: 'ep3', cursoProvenienciaId: null, nacionalidadeId: 'nc1', numeroBI: null, dataEmissaoBI: null, nomePai: null, nomeMae: null },
    { id: 'a4', numero: '2026-GE-001', nome: 'Sandra Chivinda', email: 'sandra.chivinda@aluno.isp.ao', telefone: '912 111 004', cursoId: 'c2', anoCurricular: 'ae1', ingresso: 2026, status: 'Ativo', generoId: 'gn2', provinciaId: 'pv1', municipioId: 'mn2', escolaProvenienciaId: null, cursoProvenienciaId: null, nacionalidadeId: 'nc1', numeroBI: null, dataEmissaoBI: null, nomePai: null, nomeMae: null },
    { id: 'a5', numero: '2026-GE-002', nome: 'Paulo Zua', email: 'paulo.zua@aluno.isp.ao', telefone: '912 111 005', cursoId: 'c2', anoCurricular: 'ae2', ingresso: 2025, status: 'Ativo', generoId: 'gn1', provinciaId: 'pv3', municipioId: 'mn5', escolaProvenienciaId: null, cursoProvenienciaId: null, nacionalidadeId: 'nc1', numeroBI: null, dataEmissaoBI: null, nomePai: null, nomeMae: null },
    { id: 'a6', numero: '2026-GE-003', nome: 'Cátia Mendes', email: 'catia.mendes@aluno.isp.ao', telefone: '912 111 006', cursoId: 'c2', anoCurricular: 'ae1', ingresso: 2026, status: 'Trancado', generoId: 'gn2', provinciaId: 'pv1', municipioId: 'mn1', escolaProvenienciaId: null, cursoProvenienciaId: null, nacionalidadeId: 'nc1', numeroBI: null, dataEmissaoBI: null, nomePai: null, nomeMae: null },
    { id: 'a7', numero: '2026-EN-001', nome: 'Domingas Capemba', email: 'domingas.capemba@aluno.isp.ao', telefone: '912 111 007', cursoId: 'c3', anoCurricular: 'ae1', ingresso: 2026, status: 'Ativo', generoId: 'gn2', provinciaId: 'pv1', municipioId: 'mn3', escolaProvenienciaId: null, cursoProvenienciaId: null, nacionalidadeId: 'nc1', numeroBI: null, dataEmissaoBI: null, nomePai: null, nomeMae: null },
    { id: 'a8', numero: '2026-EN-002', nome: 'Joel Muhongo', email: 'joel.muhongo@aluno.isp.ao', telefone: '912 111 008', cursoId: 'c3', anoCurricular: 'ae1', ingresso: 2026, status: 'Ativo', generoId: 'gn1', provinciaId: 'pv2', municipioId: 'mn4', escolaProvenienciaId: null, cursoProvenienciaId: null, nacionalidadeId: 'nc1', numeroBI: null, dataEmissaoBI: null, nomePai: null, nomeMae: null },
    { id: 'a9', numero: '2025-EI-014', nome: 'Vanessa Domingos', email: 'vanessa.domingos@aluno.isp.ao', telefone: '912 111 009', cursoId: 'c1', anoCurricular: 'ae2', ingresso: 2025, status: 'Ativo', generoId: 'gn2', provinciaId: 'pv1', municipioId: 'mn2', escolaProvenienciaId: 'ep1', cursoProvenienciaId: 'cp1', nacionalidadeId: 'nc1', numeroBI: null, dataEmissaoBI: null, nomePai: null, nomeMae: null },
    { id: 'a10', numero: '2025-GE-009', nome: 'Hélder Katchimbo', email: 'helder.katchimbo@aluno.isp.ao', telefone: '912 111 010', cursoId: 'c2', anoCurricular: 'ae2', ingresso: 2025, status: 'Desistente', generoId: 'gn1', provinciaId: 'pv1', municipioId: 'mn1', escolaProvenienciaId: null, cursoProvenienciaId: null, nacionalidadeId: 'nc1', numeroBI: null, dataEmissaoBI: null, nomePai: null, nomeMae: null },
  ];

  // Turma de cada aluno seed — escolhida manualmente nos casos em que o
  // curso+ano tem mais do que uma coorte (turno/regime diferentes): usa-se a
  // nota já lançada (se existir) para decidir a coorte certa; sem nota,
  // prefere-se a coorte Regular.
  const turmaDaMatriculaSeed = {
    a1: 'tc2', a2: 'tc1', a3: 'tc2', a4: 'tc4', a5: 'tc7', a6: 'tc4', a7: 'tc5', a8: 'tc5', a9: 'tc3',
  };

  const matriculas = alunos
    .filter(a => a.status !== 'Desistente')
    .map((a, i) => ({
      id: 'm' + (i + 1),
      alunoId: a.id,
      cursoId: a.cursoId,
      turmaId: turmaDaMatriculaSeed[a.id] || null,
      anoLetivo: 2026,
      data: '2026-02-0' + (((i % 9) + 1)),
      status: a.status === 'Trancado' ? 'Trancada' : 'Ativa',
    }));

  // Aluno resultante de uma candidatura ao exame de ingresso já admitida
  // (ver `candidatos` mais abaixo, cand2) — demonstra a conversão automática.
  alunos.push({ id: 'a11', numero: '2027-EI-001', nome: 'Pedro Sachipenda', email: 'pedro.sachipenda@aluno.isp.ao', telefone: '912 111 011', cursoId: 'c1', anoCurricular: 'ae1', ingresso: 2027, status: 'Ativo', generoId: 'gn1', provinciaId: 'pv1', municipioId: 'mn3', escolaProvenienciaId: null, cursoProvenienciaId: null, nacionalidadeId: 'nc1', numeroBI: null, dataEmissaoBI: null, nomePai: null, nomeMae: null });
  matriculas.push({ id: 'm11', alunoId: 'a11', cursoId: 'c1', turmaId: 'tc1', anoLetivo: 2027, data: '2026-07-20', status: 'Ativa' });

  // Vagas de admissão declaradas por curso + turno + ano letivo de ingresso.
  const vagas = [
    { id: 'vg1', cursoId: 'c1', turno: 'pe1', anoLetivo: 2027, quantidade: 3 },
  ];

  // Inscrições ao exame de ingresso (candidatura a uma vaga, ainda não é aluno).
  // status: Inscrito (sem nota) → Avaliado (nota lançada, aguarda concurso) →
  // Admitido / Não Admitido (após "Processar Admissões" — ver processarAdmissoes,
  // que por trás ainda considera vagas, nota mínima e idade mínima). cand4–cand8
  // formam de propósito um grupo com mais candidatos avaliados (4 elegíveis) do
  // que vagas restantes
  // (3 declaradas − 1 já admitido = 2), para demonstrar o concurso ao vivo.
  const candidatos = [
    { id: 'cand1', numero: '2027-CAND-001', nome: 'Ana Bumba', email: 'ana.bumba@gmail.com', telefone: '912 222 001', dataNascimento: '2009-01-20', cursoPretendidoId: 'c1', turnoPretendido: 'pe1', anoLetivo: 2027, dataInscricao: '2026-05-15', notaExame: null, status: 'Inscrito', alunoId: null, generoId: 'gn2', provinciaId: 'pv1', municipioId: 'mn1', escolaProvenienciaId: 'ep1', cursoProvenienciaId: null, nacionalidadeId: 'nc1', numeroBI: '005812340LA038', dataEmissaoBI: '2025-02-10', nomePai: 'Domingos Bumba', nomeMae: 'Isabel Bumba' },
    { id: 'cand2', numero: '2027-CAND-002', nome: 'Pedro Sachipenda', email: 'pedro.sachipenda@aluno.isp.ao', telefone: '912 111 011', dataNascimento: '2008-04-12', cursoPretendidoId: 'c1', turnoPretendido: 'pe1', anoLetivo: 2027, dataInscricao: '2026-06-01', notaExame: 15, status: 'Admitido', alunoId: 'a11', generoId: 'gn1', provinciaId: 'pv1', municipioId: 'mn3', escolaProvenienciaId: null, cursoProvenienciaId: null, nacionalidadeId: 'nc1', numeroBI: null, dataEmissaoBI: null, nomePai: null, nomeMae: null },
    { id: 'cand3', numero: '2027-CAND-003', nome: 'Carla Neto', email: 'carla.neto@gmail.com', telefone: '912 222 003', dataNascimento: '2008-11-05', cursoPretendidoId: 'c2', turnoPretendido: 'pe1', anoLetivo: 2027, dataInscricao: '2026-05-20', notaExame: 6, status: 'Não Admitido', alunoId: null, generoId: 'gn2', provinciaId: 'pv2', municipioId: 'mn4', escolaProvenienciaId: 'ep3', cursoProvenienciaId: null, nacionalidadeId: 'nc1', numeroBI: null, dataEmissaoBI: null, nomePai: null, nomeMae: null },
    { id: 'cand4', numero: '2027-CAND-004', nome: 'Rui Ferreira', email: 'rui.ferreira@gmail.com', telefone: '912 222 004', dataNascimento: '2007-05-01', cursoPretendidoId: 'c1', turnoPretendido: 'pe1', anoLetivo: 2027, dataInscricao: '2026-06-02', notaExame: 18, status: 'Avaliado', alunoId: null, generoId: 'gn1', provinciaId: 'pv3', municipioId: 'mn5', escolaProvenienciaId: null, cursoProvenienciaId: null, nacionalidadeId: 'nc1', numeroBI: null, dataEmissaoBI: null, nomePai: null, nomeMae: null },
    { id: 'cand5', numero: '2027-CAND-005', nome: 'Sofia Baptista', email: 'sofia.baptista@gmail.com', telefone: '912 222 005', dataNascimento: '2008-01-10', cursoPretendidoId: 'c1', turnoPretendido: 'pe1', anoLetivo: 2027, dataInscricao: '2026-06-02', notaExame: 14, status: 'Avaliado', alunoId: null, generoId: 'gn2', provinciaId: 'pv1', municipioId: 'mn2', escolaProvenienciaId: null, cursoProvenienciaId: null, nacionalidadeId: 'nc1', numeroBI: null, dataEmissaoBI: null, nomePai: null, nomeMae: null },
    { id: 'cand6', numero: '2027-CAND-006', nome: 'Miguel Costa', email: 'miguel.costa@gmail.com', telefone: '912 222 006', dataNascimento: '2009-03-15', cursoPretendidoId: 'c1', turnoPretendido: 'pe1', anoLetivo: 2027, dataInscricao: '2026-06-03', notaExame: 14, status: 'Avaliado', alunoId: null, generoId: 'gn1', provinciaId: 'pv1', municipioId: 'mn1', escolaProvenienciaId: null, cursoProvenienciaId: null, nacionalidadeId: 'nc1', numeroBI: null, dataEmissaoBI: null, nomePai: null, nomeMae: null },
    { id: 'cand7', numero: '2027-CAND-007', nome: 'Teresa Alves', email: 'teresa.alves@gmail.com', telefone: '912 222 007', dataNascimento: '2008-08-20', cursoPretendidoId: 'c1', turnoPretendido: 'pe1', anoLetivo: 2027, dataInscricao: '2026-06-03', notaExame: 12, status: 'Avaliado', alunoId: null, generoId: 'gn2', provinciaId: 'pv2', municipioId: 'mn4', escolaProvenienciaId: null, cursoProvenienciaId: null, nacionalidadeId: 'nc1', numeroBI: null, dataEmissaoBI: null, nomePai: null, nomeMae: null },
    { id: 'cand8', numero: '2027-CAND-008', nome: 'Bruno Silva', email: 'bruno.silva@gmail.com', telefone: '912 222 008', dataNascimento: '2009-12-01', cursoPretendidoId: 'c1', turnoPretendido: 'pe1', anoLetivo: 2027, dataInscricao: '2026-06-04', notaExame: 16, status: 'Avaliado', alunoId: null, generoId: 'gn1', provinciaId: 'pv1', municipioId: 'mn3', escolaProvenienciaId: null, cursoProvenienciaId: null, nacionalidadeId: 'nc1', numeroBI: null, dataEmissaoBI: null, nomePai: null, nomeMae: null },
  ];

  // Notas: campos prova1/prova2/exameFinal/exameRecurso/exameEspecial/exameMelhoria.
  // Cenários deliberadamente diferentes nas turmas do prof. Carlos Neto (p1) para
  // demonstrar os vários estados do fluxo de lançamento por etapas:
  //  - t1 (Programação I): Prova 1+2 submetidas; Exame Final ainda SEM período definido.
  //  - t3 (Estruturas de Dados): percurso completo até "Aprovado" (normal e via recurso);
  //    etapa atual = Exame Especial, aberta, sem ninguém pendente (demonstra "saltar etapa").
  //  - t4 (Base de Dados): Exame Final submetido; Exame de Recurso com período ABERTO
  //    e um rascunho já gravado mas ainda NÃO submetido.
  const notas = [
    { id: 'n1', alunoId: 'a1', disciplinaId: 'd3', aulaId: 't3', anoLetivo: 2026, prova1: 14, prova2: 15, exameFinal: 16, exameRecurso: null, exameEspecial: null, exameMelhoria: null },
    { id: 'n5', alunoId: 'a3', disciplinaId: 'd3', aulaId: 't3', anoLetivo: 2026, prova1: 12, prova2: null, exameFinal: 7, exameRecurso: 11, exameEspecial: null, exameMelhoria: null },
    { id: 'n2', alunoId: 'a1', disciplinaId: 'd4', aulaId: 't4', anoLetivo: 2026, prova1: 9, prova2: 11, exameFinal: 6, exameRecurso: 5, exameEspecial: null, exameMelhoria: null },
    { id: 'n8', alunoId: 'a9', disciplinaId: 'd4', aulaId: 't4', anoLetivo: 2026, prova1: 17, prova2: 18, exameFinal: null, exameRecurso: null, exameEspecial: null, exameMelhoria: null },
    { id: 'n3', alunoId: 'a2', disciplinaId: 'd1', aulaId: 't1', anoLetivo: 2026, prova1: 16, prova2: 17, exameFinal: null, exameRecurso: null, exameEspecial: null, exameMelhoria: null },
    { id: 'n4', alunoId: 'a2', disciplinaId: 'd2', aulaId: 't2', anoLetivo: 2026, prova1: 8, prova2: 9, exameFinal: null, exameRecurso: null, exameEspecial: null, exameMelhoria: null },
    { id: 'n6', alunoId: 'a4', disciplinaId: 'd5', aulaId: 't5', anoLetivo: 2026, prova1: 13, prova2: 12, exameFinal: null, exameRecurso: null, exameEspecial: null, exameMelhoria: null },
    { id: 'n7', alunoId: 'a5', disciplinaId: 'd7', aulaId: 't9', anoLetivo: 2026, prova1: 10, prova2: 10, exameFinal: null, exameRecurso: null, exameEspecial: null, exameMelhoria: null },
    { id: 'n9', alunoId: 'a7', disciplinaId: 'd8', aulaId: 't7', anoLetivo: 2026, prova1: 11, prova2: 9, exameFinal: null, exameRecurso: null, exameEspecial: null, exameMelhoria: null },
  ];
  notas.forEach(aplicarDispensaAutomatica);

  // Períodos de lançamento definidos pela Secretaria Académica (por aula + etapa).
  const hoje = '2026-07-26';
  const periodos = [
    // t1 — Prova 1/2 com período (já passado, mas submetidas); Exame Final NÃO definido.
    { id: 'pr1', aulaId: 't1', tipo: 'prova1', inicio: '2026-06-01', fim: '2026-06-15' },
    { id: 'pr2', aulaId: 't1', tipo: 'prova2', inicio: '2026-07-01', fim: '2026-07-15' },
    // t3 — percurso completo: Prova1/2, Exame Final e Recurso já submetidos; Especial aberto agora.
    { id: 'pr3', aulaId: 't3', tipo: 'prova1', inicio: '2026-06-01', fim: '2026-06-15' },
    { id: 'pr4', aulaId: 't3', tipo: 'prova2', inicio: '2026-07-01', fim: '2026-07-15' },
    { id: 'pr5', aulaId: 't3', tipo: 'exameFinal', inicio: '2026-07-16', fim: '2026-07-24' },
    { id: 'pr6', aulaId: 't3', tipo: 'exameRecurso', inicio: '2026-07-20', fim: '2026-07-25' },
    { id: 'pr7', aulaId: 't3', tipo: 'exameEspecial', inicio: '2026-07-26', fim: '2026-08-10' },
    // t4 — Exame Final submetido; Recurso aberto agora (rascunho já gravado, não submetido).
    { id: 'pr8', aulaId: 't4', tipo: 'prova1', inicio: '2026-06-01', fim: '2026-06-15' },
    { id: 'pr9', aulaId: 't4', tipo: 'prova2', inicio: '2026-07-01', fim: '2026-07-15' },
    { id: 'pr10', aulaId: 't4', tipo: 'exameFinal', inicio: '2026-07-16', fim: '2026-07-24' },
    { id: 'pr11', aulaId: 't4', tipo: 'exameRecurso', inicio: '2026-07-20', fim: '2026-08-05' },
  ];

  const submissoes = [
    { id: 'sb1', aulaId: 't1', tipo: 'prova1', submetidoEm: '2026-06-16', submetidoPor: 'u3' },
    { id: 'sb2', aulaId: 't1', tipo: 'prova2', submetidoEm: '2026-07-16', submetidoPor: 'u3' },
    { id: 'sb3', aulaId: 't3', tipo: 'prova1', submetidoEm: '2026-06-16', submetidoPor: 'u3' },
    { id: 'sb4', aulaId: 't3', tipo: 'prova2', submetidoEm: '2026-07-16', submetidoPor: 'u3' },
    { id: 'sb5', aulaId: 't3', tipo: 'exameFinal', submetidoEm: '2026-07-25', submetidoPor: 'u3' },
    { id: 'sb6', aulaId: 't3', tipo: 'exameRecurso', submetidoEm: '2026-07-25', submetidoPor: 'u3' },
    { id: 'sb7', aulaId: 't4', tipo: 'prova1', submetidoEm: '2026-06-16', submetidoPor: 'u3' },
    { id: 'sb8', aulaId: 't4', tipo: 'prova2', submetidoEm: '2026-07-16', submetidoPor: 'u3' },
    { id: 'sb9', aulaId: 't4', tipo: 'exameFinal', submetidoEm: '2026-07-25', submetidoPor: 'u3' },
  ];

  const reaberturas = [
    { id: 'rb1', aulaId: 't1', tipo: 'prova1', motivo: 'Uma aluna esteve doente e entregou a prova em atraso — pede-se reabertura para lançar a nota em falta.', solicitadoPor: 'u3', solicitadoEm: hoje, status: 'Pendente', respondidoEm: null },
  ];

  // t3 (Estruturas de Dados) tem 4 chamadas registadas — dá para ver o
  // extrato de frequência com casos variados: a1/a9 em dia (100%), a2
  // mesmo no limite (75%) e a3 claramente em risco (25%, abaixo do mínimo).
  const frequencia = [
    { id: 'f1', aulaId: 't1', data: '2026-07-20', presencas: { a2: true } },
    { id: 'f2a', aulaId: 't3', data: '2026-06-30', presencas: { a1: true, a2: true, a3: true, a9: true } },
    { id: 'f2b', aulaId: 't3', data: '2026-07-07', presencas: { a1: true, a2: true, a3: false, a9: true } },
    { id: 'f2c', aulaId: 't3', data: '2026-07-14', presencas: { a1: true, a2: true, a3: false, a9: true } },
    { id: 'f2', aulaId: 't3', data: '2026-07-21', presencas: { a1: true, a2: false, a3: false, a9: true } },
  ];

  // anoLetivo/turno/regime identificam o ano académico e o turno/regime do
  // aluno no momento do lançamento — é o que permite filtrar o Financeiro.
  const financeiro = [
    { id: 'fi1', alunoId: 'a1', descricao: 'Propina — Julho 2026', valor: 45000, vencimento: '2026-07-10', status: 'Pago', dataPagamento: '2026-07-08', anoLetivo: 2026, turno: 'pe1', regime: 'Regular' },
    { id: 'fi2', alunoId: 'a2', descricao: 'Propina — Julho 2026', valor: 45000, vencimento: '2026-07-10', status: 'Atrasado', dataPagamento: null, anoLetivo: 2026, turno: 'pe1', regime: 'Regular' },
    { id: 'fi3', alunoId: 'a3', descricao: 'Propina — Julho 2026', valor: 45000, vencimento: '2026-07-10', status: 'Pago', dataPagamento: '2026-07-09', anoLetivo: 2026, turno: 'pe1', regime: 'Regular' },
    { id: 'fi4', alunoId: 'a4', descricao: 'Propina — Julho 2026', valor: 50000, vencimento: '2026-07-10', status: 'Pendente', dataPagamento: null, anoLetivo: 2026, turno: 'pe1', regime: 'Regular' },
    { id: 'fi5', alunoId: 'a5', descricao: 'Propina — Julho 2026', valor: 50000, vencimento: '2026-07-10', status: 'Atrasado', dataPagamento: null, anoLetivo: 2026, turno: 'pe2', regime: 'Regular' },
    { id: 'fi6', alunoId: 'a7', descricao: 'Propina — Julho 2026', valor: 55000, vencimento: '2026-08-05', status: 'Pendente', dataPagamento: null, anoLetivo: 2026, turno: 'pe1', regime: 'Regular' },
    { id: 'fi7', alunoId: 'a1', descricao: 'Propina — Agosto 2026', valor: 45000, vencimento: '2026-08-10', status: 'Pendente', dataPagamento: null, anoLetivo: 2026, turno: 'pe1', regime: 'Regular' },
    { id: 'fi8', alunoId: 'a9', descricao: 'Taxa de Matrícula 2026', valor: 15000, vencimento: '2026-02-15', status: 'Pago', dataPagamento: '2026-02-10', anoLetivo: 2026, turno: 'pe2', regime: 'Pós-Laboral' },
    { id: 'fi9', alunoId: 'a1', descricao: 'Propina — Dezembro 2024', valor: 45000, vencimento: '2024-12-10', status: 'Pago', dataPagamento: '2024-12-08', anoLetivo: 2025, turno: 'pe1', regime: 'Regular' },
    { id: 'fi10', alunoId: 'a8', descricao: 'Propina — Julho 2026', valor: 55000, vencimento: '2026-07-10', status: 'Pendente', dataPagamento: null, anoLetivo: 2026, turno: 'pe3', regime: 'Pós-Laboral' },
  ];

  const livros = [
    { id: 'l1', titulo: 'Introdução à Programação', autor: 'H. Abelson', categoria: 'Informática', exemplares: 4, disponiveis: 3, editora: 'MIT Press', local: 'Cambridge', anoPublicacao: 1996, edicao: '2', isbn: '978-0262011532', normaCitacao: 'APA' },
    { id: 'l2', titulo: 'Fundamentos de Gestão', autor: 'S. Robbins', categoria: 'Gestão', exemplares: 3, disponiveis: 3, editora: 'Pearson', local: 'São Paulo', anoPublicacao: 2014, edicao: '12', isbn: '978-8543005404', normaCitacao: 'APA' },
    { id: 'l3', titulo: 'Anatomia Humana', autor: 'F. Netter', categoria: 'Enfermagem', exemplares: 2, disponiveis: 1, editora: 'Elsevier', local: 'Rio de Janeiro', anoPublicacao: 2018, edicao: '7', isbn: '978-8535280337', normaCitacao: 'Vancouver' },
    { id: 'l4', titulo: 'Estruturas de Dados e Algoritmos', autor: 'T. Cormen', categoria: 'Informática', exemplares: 3, disponiveis: 3, editora: 'MIT Press', local: 'Cambridge', anoPublicacao: 2009, edicao: '3', isbn: '978-0262033848', normaCitacao: 'ABNT' },
  ];

  // tipo: 'Emprestimo' (livro sai da biblioteca, decrementa disponíveis) ou
  // 'Leitura Local' (consulta no local, não decrementa e fecha no mesmo dia)
  // — usados no controlo/relatório de leitura da Biblioteca.
  const emprestimos = [
    { id: 'e1', livroId: 'l1', alunoId: 'a2', tipo: 'Emprestimo', dataEmprestimo: '2026-07-10', dataPrevista: '2026-07-24', dataDevolucao: null },
    { id: 'e2', livroId: 'l3', alunoId: 'a7', tipo: 'Emprestimo', dataEmprestimo: '2026-07-05', dataPrevista: '2026-07-19', dataDevolucao: null },
    { id: 'e3', livroId: 'l4', alunoId: 'a2', tipo: 'Emprestimo', dataEmprestimo: '2026-06-01', dataPrevista: '2026-06-15', dataDevolucao: '2026-06-14' },
    { id: 'e4', livroId: 'l1', alunoId: 'a2', tipo: 'Leitura Local', dataEmprestimo: '2026-06-20', dataPrevista: '2026-06-20', dataDevolucao: '2026-06-20' },
    { id: 'e5', livroId: 'l4', alunoId: 'a9', tipo: 'Emprestimo', dataEmprestimo: '2026-05-10', dataPrevista: '2026-05-24', dataDevolucao: '2026-05-20' },
    { id: 'e6', livroId: 'l3', alunoId: 'a8', tipo: 'Leitura Local', dataEmprestimo: '2026-06-25', dataPrevista: '2026-06-25', dataDevolucao: '2026-06-25' },
    { id: 'e7', livroId: 'l3', alunoId: 'a8', tipo: 'Leitura Local', dataEmprestimo: '2026-06-26', dataPrevista: '2026-06-26', dataDevolucao: '2026-06-26' },
  ];

  const usuarios = [
    { id: 'u1', nome: 'Admin Geral', email: 'admin@isg.ao', senha: 'admin123', papel: 'admin', refId: null, status: 'Ativo' },
    { id: 'u2', nome: 'Fátima Nzuzi', email: 'secretaria.academica@isg.ao', senha: 'secacad123', papel: 'secretaria_academica', refId: null, status: 'Ativo' },
    { id: 'u3', nome: 'Eng. Carlos Neto', email: 'carlos.neto@isp.ao', senha: 'prof123', papel: 'professor', refId: 'p1', status: 'Ativo' },
    { id: 'u4', nome: 'Miguel dos Santos', email: 'miguel.santos@aluno.isp.ao', senha: 'aluno123', papel: 'estudante', refId: 'a1', status: 'Ativo' },
    { id: 'u5', nome: 'Joana Massano', email: 'secretaria.financeira@isg.ao', senha: 'secfin123', papel: 'secretaria_financeira', refId: null, status: 'Ativo' },
    { id: 'u6', nome: 'Fábio Sumbo', email: 'biblioteca@isg.ao', senha: 'biblio123', papel: 'biblioteca', refId: null, status: 'Ativo' },
    { id: 'u7', nome: 'Beatriz Sango', email: 'tecnico.academico@isg.ao', senha: 'tecacad123', papel: 'tecnico_sec_academica', refId: null, status: 'Ativo' },
    { id: 'u8', nome: 'Manuel Quissanga', email: 'tecnico.financeiro@isg.ao', senha: 'tecfin123', papel: 'tecnico_sec_financeira', refId: null, status: 'Ativo' },
    { id: 'u9', nome: 'Luísa Bumba', email: 'rh@isg.ao', senha: 'rh123', papel: 'recursos_humanos', refId: null, status: 'Ativo' },
  ];

  // Trabalhos de grupo atribuídos pelo docente a uma turma: tema, duração (em
  // dias), cotação e os alunos selecionados como integrantes. Cada integrante
  // tem de aceitar a adesão (aceite: null=por responder, true/false) antes de
  // poder submeter ficheiro.
  const trabalhos = [
    { id: 'tb1', turmaId: 'tc2', tema: 'Árvores Binárias de Pesquisa — implementação e análise de desempenho', duracaoDias: 15, cotacao: 20, criadoEm: '2026-07-10', criadoPor: 'p1' },
  ];
  const trabalhoIntegrantes = [
    { id: 'ti1', trabalhoId: 'tb1', alunoId: 'a1', aceite: true, respondidoEm: '2026-07-11' },
    { id: 'ti2', trabalhoId: 'tb1', alunoId: 'a3', aceite: null, respondidoEm: null },
    { id: 'ti3', trabalhoId: 'tb1', alunoId: 'a9', aceite: false, respondidoEm: '2026-07-12' },
  ];
  const trabalhoFicheiros = [];

  // Materiais de apoio publicados pelo docente por disciplina (unidade
  // curricular) — ficam visíveis aos alunos do curso correspondente.
  const materiais = [
    { id: 'mt1', disciplinaId: 'd1', titulo: 'Slides — Introdução à Programação', descricao: 'Conceitos básicos de algoritmia e sintaxe.', nomeFicheiro: null, tipoFicheiro: null, tamanho: null, conteudo: null, link: 'https://exemplo.isp.ao/materiais/intro-programacao.pdf', publicadoPor: 'p1', publicadoEm: '2026-06-01' },
  ];

  // Exame de Melhoria: pedido individual do aluno, aprovado pela Secretaria
  // Académica e só depois lançado pelo docente — não é uma etapa em bloco.
  const melhorias = [
    { id: 'me1', alunoId: 'a9', disciplinaId: 'd4', solicitadoEm: '2026-07-24', status: 'Aprovada', respondidoEm: '2026-07-25' },
    { id: 'me2', alunoId: 'a1', disciplinaId: 'd3', solicitadoEm: '2026-07-25', status: 'Pendente', respondidoEm: null },
  ];

  // Recursos Humanos: registo de todo o pessoal (docente e não-docente).
  // professorId liga o registo ao respetivo professor quando aplicável.
  const funcionarios = [
    { id: 'rh1', nome: 'Eng. Carlos Neto', professorId: 'p1', cargo: 'Professor Auxiliar', departamento: 'Engenharia Informática', tipo: 'Docente', dataAdmissao: '2020-03-01', salario: 350000, status: 'Ativo' },
    { id: 'rh2', nome: 'Dra. Marta Ventura', professorId: 'p2', cargo: 'Professora Assistente', departamento: 'Engenharia Informática', tipo: 'Docente', dataAdmissao: '2019-09-01', salario: 320000, status: 'Ativo' },
    { id: 'rh3', nome: 'Dr. José Fernandes', professorId: 'p3', cargo: 'Professor Auxiliar', departamento: 'Gestão de Empresas', tipo: 'Docente', dataAdmissao: '2018-02-15', salario: 340000, status: 'Ativo' },
    { id: 'rh4', nome: 'Dra. Beatriz Lopes', professorId: 'p4', cargo: 'Professora Assistente', departamento: 'Gestão de Empresas', tipo: 'Docente', dataAdmissao: '2021-08-01', salario: 300000, status: 'Ativo' },
    { id: 'rh5', nome: 'Enf.ª Ana Paulo', professorId: 'p5', cargo: 'Enfermeira Docente', departamento: 'Enfermagem', tipo: 'Docente', dataAdmissao: '2017-01-10', salario: 310000, status: 'Inativo' },
    { id: 'rh6', nome: 'Fátima Nzuzi', professorId: null, cargo: 'Técnica Superior', departamento: 'Secretaria Académica', tipo: 'Não-Docente', dataAdmissao: '2015-05-01', salario: 250000, status: 'Ativo' },
    { id: 'rh7', nome: 'Joana Massano', professorId: null, cargo: 'Técnica Superior', departamento: 'Secretaria Financeira', tipo: 'Não-Docente', dataAdmissao: '2016-04-01', salario: 240000, status: 'Ativo' },
    { id: 'rh8', nome: 'Fábio Sumbo', professorId: null, cargo: 'Bibliotecário', departamento: 'Biblioteca', tipo: 'Não-Docente', dataAdmissao: '2019-01-15', salario: 200000, status: 'Ativo' },
  ];

  return {
    anoLetivo: 2026,
    seq: 100,
    calendarioAcademico: [],
    configAvaliacao: { numProvas: 2, arredondarNotaFinal: false },
    unidadesOrganicas, edificios, salas, laboratorios, provincias, municipios,
    escolasProveniencia, generos, nacionalidades, cursosProveniencia, periodosEstudo, anosEstudo, horarios,
    categoriasDocentes,
    cursos, professores, disciplinas, turmas, aulas, alunos, matriculas, candidatos, vagas,
    notas, periodos, submissoes, reaberturas, melhorias, frequencia, financeiro,
    trabalhos, trabalhoIntegrantes, trabalhoFicheiros, materiais,
    livros, emprestimos, usuarios, funcionarios,
    permissoes: defaultPermissoes(),
  };
}

/* ------------------------------ Persistência ---------------------------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // protótipos antigos podem não ter os campos novos — completa com defaults
      if (!parsed.usuarios) parsed.usuarios = seed().usuarios;
      if (!parsed.permissoes) parsed.permissoes = defaultPermissoes();
      MODULES.forEach(m => { if (!parsed.permissoes[m]) parsed.permissoes[m] = permNone(); });
      ROLES.forEach(r => { if (!parsed.permissoes[r]) parsed.permissoes[r] = defaultPermissoes()[r]; });
      if (!parsed.livros) parsed.livros = seed().livros;
      if (!parsed.emprestimos) parsed.emprestimos = [];
      (parsed.emprestimos || []).forEach(e => { if (!e.tipo) e.tipo = 'Emprestimo'; });
      (parsed.livros || []).forEach(l => {
        if (l.editora === undefined) l.editora = null;
        if (l.local === undefined) l.local = null;
        if (l.anoPublicacao === undefined) l.anoPublicacao = null;
        if (l.edicao === undefined) l.edicao = null;
        if (l.isbn === undefined) l.isbn = null;
        if (l.normaCitacao === undefined) l.normaCitacao = 'APA';
      });
      if (!parsed.periodos) parsed.periodos = [];
      if (!parsed.submissoes) parsed.submissoes = [];
      if (!parsed.reaberturas) parsed.reaberturas = [];
      if (!parsed.melhorias) parsed.melhorias = [];
      if (!parsed.funcionarios) parsed.funcionarios = seed().funcionarios;
      if (!parsed.candidatos) parsed.candidatos = [];
      if (!parsed.vagas) parsed.vagas = [];
      if (!parsed.calendarioAcademico) parsed.calendarioAcademico = [];
      if (!parsed.configAvaliacao) parsed.configAvaliacao = { numProvas: 2 };
      if (parsed.configAvaliacao.arredondarNotaFinal === undefined) parsed.configAvaliacao.arredondarNotaFinal = false;
      if (!parsed.trabalhos) parsed.trabalhos = [];
      if (!parsed.trabalhoIntegrantes) parsed.trabalhoIntegrantes = [];
      if (!parsed.trabalhoFicheiros) parsed.trabalhoFicheiros = [];
      if (!parsed.materiais) parsed.materiais = [];
      (parsed.alunos || []).forEach(a => { if (a.foto === undefined) a.foto = null; });
      (parsed.professores || []).forEach(p => { if (p.foto === undefined) p.foto = null; });
      (parsed.funcionarios || []).forEach(f => { if (f.foto === undefined) f.foto = null; });
      (parsed.usuarios || []).forEach(u => { if (u.foto === undefined) u.foto = null; });

      // migração: cadastros/tabelas de apoio novos (relacionamento real entre
      // tabelas) — protótipos antigos não tinham nenhuma destas 12 listas.
      const cadastroDefaults = seed();
      CADASTRO_TIPOS.forEach(ct => { if (!parsed[ct.key]) parsed[ct.key] = cadastroDefaults[ct.key]; });

      // migração: valores antigos eram texto solto ou números soltos (Manhã/
      // Tarde/Noite, "1º/2º ano", nome da sala) — convertem-se para os IDs dos
      // cadastros novos, casando pelo nome/ordem; sem correspondência, cai no
      // primeiro item cadastrado.
      const periodoPorNome = {};
      parsed.periodosEstudo.forEach(p => { periodoPorNome[p.nome] = p.id; });
      const anoPorOrdem = {};
      parsed.anosEstudo.forEach(a => { anoPorOrdem[a.ordem] = a.id; });
      function turnoParaId(v) {
        if (!v) return parsed.periodosEstudo[0].id;
        if (parsed.periodosEstudo.some(p => p.id === v)) return v;
        return periodoPorNome[v] || parsed.periodosEstudo[0].id;
      }
      function anoParaId(v) {
        if (v == null) return v;
        if (parsed.anosEstudo.some(a => a.id === v)) return v;
        const n = parseInt(v, 10);
        return anoPorOrdem[n] || parsed.anosEstudo[0].id;
      }
      const generoFallback = { 'Masculino': 'gn1', 'Feminino': 'gn2' };
      function backfillPessoa(p) {
        if (p.generoId === undefined) p.generoId = generoFallback[p.genero] || null;
        if (p.provinciaId === undefined) p.provinciaId = null;
        if (p.municipioId === undefined) p.municipioId = null;
        if (p.escolaProvenienciaId === undefined) p.escolaProvenienciaId = null;
        if (p.cursoProvenienciaId === undefined) p.cursoProvenienciaId = null;
        if (p.nacionalidadeId === undefined) p.nacionalidadeId = null;
        if (p.numeroBI === undefined) p.numeroBI = null;
        if (p.dataEmissaoBI === undefined) p.dataEmissaoBI = null;
        if (p.nomePai === undefined) p.nomePai = null;
        if (p.nomeMae === undefined) p.nomeMae = null;
      }

      (parsed.candidatos || []).forEach(c => {
        c.turnoPretendido = turnoParaId(c.turnoPretendido);
        // resultado da admissão simplificado para só dois estados finais
        if (c.status === 'Excedente' || c.status === 'Idade Insuficiente') c.status = 'Não Admitido';
        backfillPessoa(c);
      });
      (parsed.vagas || []).forEach(v => { v.turno = turnoParaId(v.turno); });
      (parsed.financeiro || []).forEach(f => {
        if (!f.anoLetivo) f.anoLetivo = parsed.anoLetivo || 2026;
        f.turno = turnoParaId(f.turno);
        if (!f.regime) f.regime = 'Regular';
      });
      // migração: cursos/turmas antigos não tinham sigla/turno/regime/localização
      const siglaFallback = { 'Engenharia Informática': 'EI', 'Gestão de Empresas': 'GE', 'Enfermagem': 'EN' };
      (parsed.cursos || []).forEach(c => {
        if (!c.sigla) c.sigla = siglaFallback[c.nome] || null;
        if (c.unidadeOrganicaId === undefined) c.unidadeOrganicaId = null;
      });
      (parsed.professores || []).forEach(p => { if (p.categoriaDocenteId === undefined) p.categoriaDocenteId = null; });
      (parsed.disciplinas || []).forEach(d => { d.ano = anoParaId(d.ano); });
      (parsed.turmas || []).forEach(t => {
        t.turno = turnoParaId(t.turno);
        if (!t.regime) t.regime = 'Regular';
        if (!t.localTipo || !t.localId) {
          const salaMatch = (parsed.salas || []).find(s => s.nome === t.sala);
          t.localTipo = 'Sala';
          t.localId = (salaMatch && salaMatch.id) || (parsed.salas[0] && parsed.salas[0].id) || null;
          delete t.sala;
        }
        if (typeof t.hora === 'string' && /^\d{2}:\d{2}$/.test(t.hora)) {
          const horaMatch = (parsed.horarios || []).find(h => h.inicio === t.hora);
          t.hora = (horaMatch && horaMatch.id) || (parsed.horarios[0] && parsed.horarios[0].id) || t.hora;
        }
      });
      // migração: "turmas" antigas eram na verdade oferta de disciplina
      // (disciplina+professor+horário) — passam a ser "aulas"; uma nova
      // tabela "turmas" (coorte de alunos, independente de disciplina e
      // horário) é derivada agrupando as aulas por curso+ano+turno+regime.
      if ((parsed.turmas || []).length && 'disciplinaId' in parsed.turmas[0]) {
        function nextIdMigracao(prefix) { parsed.seq = (parsed.seq || 100) + 1; return prefix + parsed.seq; }
        const oldTurmas = parsed.turmas;
        const cohortPorChave = {};
        const novasTurmas = [];
        const novasAulas = [];
        oldTurmas.forEach(t => {
          const d = (parsed.disciplinas || []).find(x => x.id === t.disciplinaId);
          const cursoId = d ? d.cursoId : null;
          const anoEstudo = d ? d.ano : null;
          const chave = `${cursoId}|${anoEstudo}|${t.turno}|${t.regime}`;
          let coh = cohortPorChave[chave];
          if (!coh) {
            coh = { id: nextIdMigracao('t'), cursoId, anoEstudo, anoLetivo: t.anoLetivo || parsed.anoLetivo || 2026, turno: t.turno, regime: t.regime, vagas: t.vagas || 30 };
            cohortPorChave[chave] = coh;
            novasTurmas.push(coh);
          } else if (t.vagas > coh.vagas) {
            coh.vagas = t.vagas;
          }
          novasAulas.push({ id: t.id, turmaId: coh.id, disciplinaId: t.disciplinaId, professorId: t.professorId, dia: t.dia, hora: t.hora, localTipo: t.localTipo, localId: t.localId });
        });
        parsed.turmas = novasTurmas;
        parsed.aulas = novasAulas;
        ['notas', 'periodos', 'submissoes', 'reaberturas', 'frequencia'].forEach(tbl => {
          (parsed[tbl] || []).forEach(row => {
            if ('turmaId' in row) { row.aulaId = row.turmaId; delete row.turmaId; }
          });
        });
        // Trabalhos já era "atribuir à turma toda" (sem disciplina) — passa a
        // apontar diretamente à coorte, em vez do id da aula antiga.
        (parsed.trabalhos || []).forEach(tb => {
          const aula = novasAulas.find(a => a.id === tb.turmaId);
          if (aula) tb.turmaId = aula.turmaId;
        });
        // Exame de Melhoria nunca leu turmaId em lado nenhum — remove.
        (parsed.melhorias || []).forEach(m => { delete m.turmaId; });
        // Matrículas: liga a uma coorte por melhor esforço (curso + ano
        // curricular do aluno); se houver mais de uma coorte para o mesmo
        // curso+ano (turnos/regimes diferentes), fica com a primeira —
        // corrigível manualmente depois no ecrã de Matrículas.
        (parsed.matriculas || []).forEach(m => {
          if (m.turmaId) return;
          const aluno = (parsed.alunos || []).find(a => a.id === m.alunoId);
          const coh = novasTurmas.find(c => c.cursoId === m.cursoId && c.anoEstudo === aluno?.anoCurricular);
          m.turmaId = coh ? coh.id : null;
        });
      } else if (!parsed.aulas) {
        parsed.aulas = [];
      }
      (parsed.alunos || []).forEach(a => {
        a.anoCurricular = anoParaId(a.anoCurricular);
        backfillPessoa(a);
      });
      // migração: notas antigas usavam nota1/nota2 em vez de prova1/prova2
      (parsed.notas || []).forEach(n => {
        if ('nota1' in n && !('prova1' in n)) n.prova1 = n.nota1;
        if ('nota2' in n && !('prova2' in n)) n.prova2 = n.nota2;
        if (!('exameFinal' in n)) n.exameFinal = null;
        if (!('exameRecurso' in n)) n.exameRecurso = null;
        if (!('exameEspecial' in n)) n.exameEspecial = null;
        if (!('exameMelhoria' in n)) n.exameMelhoria = null;
        aplicarDispensaAutomatica(n);
      });
      return parsed;
    }
  } catch (e) { /* ignora dados corrompidos */ }
  return seed();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function nextId(prefix) {
  state.seq += 1;
  return prefix + state.seq;
}

/* -------------------------- Auditoria / Logs -------------------------- */
/* Regista quem fez o quê e quando. Fica FORA do `state` (chave própria no
   localStorage, tal como os Backups) de propósito: assim o registo de
   auditoria sobrevive a "Repor dados de exemplo" e a "Restaurar backup" — o
   próprio facto de alguém ter reposto ou restaurado dados é um evento que a
   auditoria deve preservar, não apagar. `autorNomeOverride` só é usado no
   login falhado, onde ainda não há currentUser (a tentativa fica registada
   com o email introduzido). */
const LOGS_KEY = 'sga_academico_logs_v1';
const MAX_LOGS = 3000;
let logSeq = 0;
function listarLogs() {
  try {
    const raw = localStorage.getItem(LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
function registrarLog(acao, modulo, descricao, autorNomeOverride) {
  const logs = listarLogs();
  logSeq += 1;
  logs.push({
    id: 'log' + Date.now() + '_' + logSeq,
    timestamp: new Date().toISOString(),
    userId: currentUser ? currentUser.id : null,
    userNome: autorNomeOverride || (currentUser ? currentUser.nome : 'Sistema'),
    papel: currentUser ? currentUser.papel : null,
    acao,
    modulo,
    descricao,
  });
  while (logs.length > MAX_LOGS) logs.shift();
  try { localStorage.setItem(LOGS_KEY, JSON.stringify(logs)); } catch (e) { /* localStorage cheio — ignora, não deve bloquear a ação a auditar */ }
}
function limparLogs(antesDe) {
  if (!antesDe) { localStorage.removeItem(LOGS_KEY); return; }
  const logs = listarLogs().filter(l => l.timestamp >= antesDe);
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
}

function resetData() {
  if (!confirm('Repor todos os dados de exemplo? Todas as alterações locais (incluindo utilizadores e permissões) serão perdidas.')) return;
  registrarLog('Repor Dados', 'backups', 'Dados de exemplo repostos — todo o conteúdo local anterior foi substituído.');
  state = seed();
  saveState();
  toast('Dados de exemplo repostos.');
  if (!hasPerm(currentSection, 'view')) currentSection = landingSection();
  applyNavVisibility();
  render();
}

/* ------------------------------- Backups --------------------------------- */
/* Como não existe um backend/base de dados real, o "backup do sistema" é o
   próprio `state` (tudo o que está em localStorage) gravado com metadados
   (data/hora, ano letivo, contagens por tabela) — histórico guardado numa
   chave própria, rotativo para não encher o localStorage. Um backup por dia é
   gerado automaticamente ao abrir a aplicação; a Secretaria/Admin pode ainda
   gerar um a qualquer momento e descarregar em JSON ou Excel (multi-separador,
   uma tabela por sheet, dados em bruto incluindo IDs internos). */
const BACKUPS_KEY = 'sga_academico_backups_v1';
const LAST_AUTO_BACKUP_KEY = 'sga_academico_last_auto_backup_v1';
const MAX_BACKUPS = 15;

function metadadosBackup() {
  const contagens = {};
  Object.keys(state).forEach(k => { if (Array.isArray(state[k])) contagens[k] = state[k].length; });
  return {
    geradoEm: new Date().toISOString(),
    anoLetivo: state.anoLetivo,
    contagens,
  };
}
function listarBackups() {
  try {
    const raw = localStorage.getItem(BACKUPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
function guardarBackup(automatico) {
  const backups = listarBackups();
  const registo = { id: 'bkp' + Date.now(), automatico, metadados: metadadosBackup(), dados: state };
  backups.push(registo);
  while (backups.length > MAX_BACKUPS) backups.shift();
  try { localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups)); } catch (e) { /* localStorage cheio — ignora, o backup manual em ficheiro continua a funcionar */ }
  return registo;
}
function verificarBackupAutomatico() {
  const hojeStr = hoje();
  if (localStorage.getItem(LAST_AUTO_BACKUP_KEY) === hojeStr) return;
  guardarBackup(true);
  localStorage.setItem(LAST_AUTO_BACKUP_KEY, hojeStr);
}
function fazerBackupManual() {
  const registo = guardarBackup(false);
  descarregarJSON(`sga_backup_${hoje()}`, { metadados: registo.metadados, dados: state });
  registrarLog('Backup', 'backups', 'Backup manual gerado e descarregado em JSON.');
  toast('Backup completo gerado e descarregado.');
}
function fazerBackupExcelCompleto() {
  const sheets = Object.keys(state)
    .filter(k => Array.isArray(state[k]))
    .map(k => ({ nome: k, linhas: state[k] }));
  exportarExcelMultiSheet(`sga_backup_registos_${hoje()}`, sheets);
  registrarLog('Backup', 'backups', 'Backup completo dos registos exportado em Excel.');
}
function restaurarBackup(dados) {
  if (!confirm('Restaurar este backup? TODOS os dados atuais serão substituídos por esta cópia. Se quiser manter o estado atual, faça primeiro um backup dele.')) return;
  registrarLog('Restaurar Backup', 'backups', 'Backup restaurado — todo o conteúdo local anterior foi substituído por uma cópia guardada.');
  state = dados;
  saveState();
  toast('Backup restaurado.');
  if (!hasPerm(currentSection, 'view')) currentSection = landingSection();
  applyNavVisibility();
  render();
}
function restaurarBackupDeFicheiro(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      restaurarBackup(parsed.dados || parsed);
    } catch (e) {
      toast('Ficheiro inválido — não foi possível ler o backup.');
    }
  };
  reader.readAsText(file);
}
function fmtDateHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderBackups() {
  const backups = listarBackups().slice().reverse();

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="panel">
        <h3>Backup do Sistema</h3>
        <div class="panel-sub">Cópia de segurança completa de todas as tabelas do sistema, com metadados (data/hora, ano letivo, contagem de registos). Um backup automático é gerado uma vez por dia ao abrir a aplicação.</div>
        <div class="toolbar">
          <button class="btn btn-primary" id="btnBackupJson">Fazer backup agora (JSON)</button>
          <button class="btn" id="btnBackupExcel">Exportar registos em Excel (todas as tabelas)</button>
          <div class="spacer"></div>
          <label class="btn" style="cursor:pointer; margin-bottom:0;">
            Restaurar de um ficheiro
            <input type="file" accept="application/json" id="fileRestaurar" style="display:none;">
          </label>
        </div>
      </div>
      <div class="panel">
        <h3>Histórico de backups guardados neste navegador</h3>
        <div class="panel-sub">Guardados em localStorage — descarregue os que quiser manter fora deste computador (o navegador só guarda os últimos ${MAX_BACKUPS}).</div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Data/Hora</th><th>Tipo</th><th>Ano Letivo</th><th>Total de Registos</th><th></th></tr></thead>
          <tbody>
            ${backups.length === 0 ? `<tr class="empty-row"><td colspan="5">Ainda não há backups guardados.</td></tr>` : backups.map(b => `
              <tr>
                <td>${fmtDateHora(b.metadados.geradoEm)}</td>
                <td>${b.automatico ? badge('Automático', 'gray') : badge('Manual', 'green')}</td>
                <td>${anoLetivoLabel(b.metadados.anoLetivo)}</td>
                <td class="mono">${Object.values(b.metadados.contagens).reduce((s, n) => s + n, 0)}</td>
                <td class="row-actions">
                  <button class="btn btn-sm" data-descarregar-bkp="${b.id}">Descarregar</button>
                  <button class="btn btn-sm btn-danger" data-restaurar-bkp="${b.id}">Restaurar</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table></div>
      </div>
    </section>
  `;
  document.getElementById('btnBackupJson').onclick = () => { fazerBackupManual(); renderBackups(); };
  document.getElementById('btnBackupExcel').onclick = () => fazerBackupExcelCompleto();
  document.getElementById('fileRestaurar').onchange = e => { if (e.target.files[0]) restaurarBackupDeFicheiro(e.target.files[0]); };
  backups.forEach(b => {
    const dl = document.querySelector(`[data-descarregar-bkp="${b.id}"]`);
    const rs = document.querySelector(`[data-restaurar-bkp="${b.id}"]`);
    if (dl) dl.onclick = () => descarregarJSON(`sga_backup_${b.id}`, { metadados: b.metadados, dados: b.dados });
    if (rs) rs.onclick = () => restaurarBackup(b.dados);
  });
}

/* --------------------------- Auditoria e Gestão de Logs -------------------------- */

const ACOES_LOG = ['Login', 'Login Falhado', 'Logout', 'Criar', 'Editar', 'Remover', 'Aprovar', 'Rejeitar', 'Processar', 'Configurar', 'Backup', 'Restaurar Backup', 'Repor Dados'];
function acaoTone(acao) {
  if (['Criar', 'Login', 'Aprovar', 'Backup'].includes(acao)) return 'green';
  if (['Editar', 'Configurar', 'Processar'].includes(acao)) return 'amber';
  if (['Remover', 'Rejeitar', 'Login Falhado', 'Repor Dados', 'Restaurar Backup'].includes(acao)) return 'red';
  return 'gray';
}
const MAX_LOGS_EXIBIDOS = 500;

function renderAuditoria(filter = {}) {
  const termo = (filter.q || '').toLowerCase();
  const modulo = filter.modulo || '';
  const acao = filter.acao || '';
  const utilizador = filter.utilizador || '';
  const desde = filter.desde || '';
  const ate = filter.ate || '';

  const todos = listarLogs().slice().reverse();
  const utilizadores = [...new Set(todos.map(l => l.userNome))].sort((a, b) => a.localeCompare(b));

  const filtrados = todos.filter(l => {
    if (termo && !(l.descricao.toLowerCase().includes(termo))) return false;
    if (modulo && l.modulo !== modulo) return false;
    if (acao && l.acao !== acao) return false;
    if (utilizador && l.userNome !== utilizador) return false;
    if (desde && l.timestamp.slice(0, 10) < desde) return false;
    if (ate && l.timestamp.slice(0, 10) > ate) return false;
    return true;
  });
  const linhas = filtrados.slice(0, MAX_LOGS_EXIBIDOS);

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="panel">
        <h3>Auditoria e Gestão de Logs</h3>
        <div class="panel-sub">Regista quem fez o quê e quando em todo o sistema — logins, criação/edição/remoção de registos, aprovações, configurações e backups. Guardado neste navegador (até ${MAX_LOGS} eventos), sobrevive a "Repor dados" e a "Restaurar backup".</div>
        <div class="toolbar">
          <input class="input" id="fltQLog" placeholder="Pesquisar na descrição..." value="${esc(filter.q || '')}">
          <select class="input" id="fltUtilizadorLog">
            <option value="">Todos os utilizadores</option>
            ${utilizadores.map(u => `<option value="${esc(u)}" ${u === utilizador ? 'selected' : ''}>${esc(u)}</option>`).join('')}
          </select>
          <select class="input" id="fltModuloLog">
            <option value="">Todos os módulos</option>
            ${MODULES.filter(m => m !== 'auditoria').map(m => `<option value="${m}" ${m === modulo ? 'selected' : ''}>${esc(MODULE_LABELS[m])}</option>`).join('')}
          </select>
          <select class="input" id="fltAcaoLog">
            <option value="">Todas as ações</option>
            ${ACOES_LOG.map(a => `<option value="${a}" ${a === acao ? 'selected' : ''}>${a}</option>`).join('')}
          </select>
          <input class="input" id="fltDesdeLog" type="date" value="${desde}" title="Desde">
          <input class="input" id="fltAteLog" type="date" value="${ate}" title="Até">
        </div>
        <div class="toolbar">
          <span class="text-muted" style="font-size:12.5px;">${filtrados.length} evento(s) encontrado(s)${filtrados.length > MAX_LOGS_EXIBIDOS ? ` — a mostrar os ${MAX_LOGS_EXIBIDOS} mais recentes` : ''} de ${todos.length} no total.</span>
          <div class="spacer"></div>
          <button class="btn" id="btnExportarLogs">Exportar Excel</button>
          <button class="btn btn-danger" id="btnLimparAntigos">Limpar mais antigos que 90 dias</button>
          <button class="btn btn-danger" id="btnLimparTudo">Limpar todo o histórico</button>
        </div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Data/Hora</th><th>Utilizador</th><th>Perfil</th><th>Ação</th><th>Módulo</th><th>Descrição</th></tr></thead>
          <tbody>
            ${linhas.length === 0 ? `<tr class="empty-row"><td colspan="6">Nenhum evento encontrado.</td></tr>` : linhas.map(l => `
              <tr>
                <td class="mono">${fmtDateHora(l.timestamp)}</td>
                <td>${esc(l.userNome)}</td>
                <td>${l.papel ? esc(ROLE_LABELS[l.papel] || l.papel) : '—'}</td>
                <td>${badge(l.acao, acaoTone(l.acao))}</td>
                <td>${esc(MODULE_LABELS[l.modulo] || l.modulo)}</td>
                <td>${esc(l.descricao)}</td>
              </tr>`).join('')}
          </tbody>
        </table></div>
      </div>
    </section>
  `;

  document.getElementById('fltQLog').oninput = e => renderAuditoria({ ...filter, q: e.target.value });
  document.getElementById('fltUtilizadorLog').onchange = e => renderAuditoria({ ...filter, utilizador: e.target.value });
  document.getElementById('fltModuloLog').onchange = e => renderAuditoria({ ...filter, modulo: e.target.value });
  document.getElementById('fltAcaoLog').onchange = e => renderAuditoria({ ...filter, acao: e.target.value });
  document.getElementById('fltDesdeLog').onchange = e => renderAuditoria({ ...filter, desde: e.target.value });
  document.getElementById('fltAteLog').onchange = e => renderAuditoria({ ...filter, ate: e.target.value });
  document.getElementById('btnExportarLogs').onclick = () => exportarExcel('auditoria_logs', 'Logs', filtrados.map(l => ({
    'Data/Hora': fmtDateHora(l.timestamp), 'Utilizador': l.userNome, 'Perfil': l.papel ? (ROLE_LABELS[l.papel] || l.papel) : '',
    'Ação': l.acao, 'Módulo': MODULE_LABELS[l.modulo] || l.modulo, 'Descrição': l.descricao,
  })));
  document.getElementById('btnLimparAntigos').onclick = () => {
    if (!confirm('Remover permanentemente todos os eventos de auditoria com mais de 90 dias? Esta ação não pode ser desfeita.')) return;
    const limite = new Date(Date.now() - 90 * 86400000).toISOString();
    limparLogs(limite);
    toast('Histórico antigo removido.');
    renderAuditoria(filter);
  };
  document.getElementById('btnLimparTudo').onclick = () => {
    if (!confirm('Remover TODO o histórico de auditoria permanentemente? Esta ação não pode ser desfeita — considere exportar em Excel primeiro.')) return;
    limparLogs(null);
    toast('Histórico de auditoria limpo.');
    renderAuditoria({});
  };
}

/* -------------------------------- Sessão --------------------------------- */

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function saveSession(userId) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId }));
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/* --------------------------------- Utils --------------------------------- */

function hoje() { return new Date().toISOString().slice(0, 10); }

function fmtMoney(v) {
  return 'Kz ' + Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

/* ------------------------- Exportação (Excel/PDF) ------------------------- */
/* Usa a biblioteca SheetJS (window.XLSX, ficheiro local em js/vendor/xlsx.full.min.js,
   incluído no projeto — sem CDN, funciona 100% offline) para gerar ficheiros
   .xlsx reais no browser, sem precisar de backend. Se por algum motivo o
   ficheiro não tiver carregado, avisa em vez de rebentar. */
function xlsxDisponivel() {
  if (typeof XLSX === 'undefined') {
    toast('Exportação Excel indisponível — o ficheiro js/vendor/xlsx.full.min.js não foi encontrado.');
    return false;
  }
  return true;
}
/* rows: array de objetos simples (chave = cabeçalho da coluna). */
function exportarExcel(filename, sheetName, rows) {
  if (!xlsxDisponivel()) return;
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows && rows.length ? rows : [{}]);
  XLSX.utils.book_append_sheet(wb, ws, (sheetName || 'Dados').slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : filename + '.xlsx');
  toast('Ficheiro Excel exportado.');
}
/* sheets: array de { nome, linhas } — um separador por tabela, usado no backup completo. */
function exportarExcelMultiSheet(filename, sheets) {
  if (!xlsxDisponivel()) return;
  const wb = XLSX.utils.book_new();
  sheets.forEach(s => {
    const ws = XLSX.utils.json_to_sheet(s.linhas && s.linhas.length ? s.linhas : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, s.nome.slice(0, 31));
  });
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : filename + '.xlsx');
  toast('Ficheiro Excel exportado.');
}
/* "Imprimir em PDF" = impressão nativa do browser (Guardar como PDF), restrita
   à secção atual via CSS de impressão (ver @media print em styles.css).
   `titulo` é inserido temporariamente no topo do conteúdo, só visível ao
   imprimir, para o PDF gerado ter cabeçalho mesmo sem a barra superior. */
function imprimirSecao(titulo) {
  const content = document.getElementById('content');
  const header = document.createElement('div');
  header.className = 'print-header';
  header.innerHTML = `<h2 style="margin:0 0 4px;">${esc(titulo)}</h2><div style="font-size:12px;color:#555;">Emitido em ${fmtDate(hoje())} · SIGA — Sistema Integrado de Gestão Acadêmica</div>`;
  content.prepend(header);
  window.print();
  header.remove();
}
/* Descarrega um objecto JS como ficheiro (usado no backup em JSON). */
function descarregarJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.json') ? filename : filename + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------ Upload de ficheiros (sem backend) --------------- */
/* Como não há servidor, ficheiros submetidos (trabalhos, materiais, fotos de
   perfil) ficam guardados como dataURL dentro do próprio state/localStorage —
   por isso impomos um limite de tamanho por tipo de uso, para não esgotar a
   quota do browser. */
function lerFicheiroComoDataURL(file, maxBytes, onOk, onErro) {
  if (file.size > maxBytes) {
    onErro(`Ficheiro demasiado grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo permitido: ${(maxBytes / 1024 / 1024).toFixed(1)} MB.`);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => onOk(reader.result);
  reader.onerror = () => onErro('Não foi possível ler o ficheiro.');
  reader.readAsDataURL(file);
}
function descarregarFicheiroArmazenado(nomeFicheiro, dataUrl) {
  if (!dataUrl) { toast('Este registo não tem ficheiro associado.'); return; }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = nomeFicheiro || 'ficheiro';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
function fmtTamanho(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ------------------------------ Fotos de perfil --------------------------- */
/* Redimensiona a imagem no browser (canvas) antes de guardar como dataURL —
   assim uma foto de telemóvel de vários MB não esgota a quota do
   localStorage; o resultado fica sempre com o lado maior <= maxDim. */
function redimensionarImagem(file, maxDim, onOk, onErro) {
  if (!file.type.startsWith('image/')) { (onErro || toast)('Selecione um ficheiro de imagem.'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else { width = Math.round(width * maxDim / height); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      onOk(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => (onErro || toast)('Não foi possível ler a imagem.');
    img.src = reader.result;
  };
  reader.onerror = () => (onErro || toast)('Não foi possível ler o ficheiro.');
  reader.readAsDataURL(file);
}
/* Avatar redondo — mostra a foto guardada ou, na sua falta, um círculo com a
   inicial do nome (mesmo padrão do avatar da topbar). */
function avatarHtml(foto, nome, size) {
  size = size || 32;
  if (foto) return `<img src="${esc(foto)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;vertical-align:middle;">`;
  const inicial = esc((nome || '?').charAt(0).toUpperCase());
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:var(--primary-soft);color:var(--primary);font-weight:600;vertical-align:middle;font-size:${Math.round(size * 0.45)}px;">${inicial}</span>`;
}
/* Bloco de campo de foto reutilizável nos formulários (Aluno/Professor/
   Funcionário/Utilizador) — devolve o HTML; a ligação do input é feita à
   parte por wireFotoField(), depois do modal estar no DOM. */
function fotoFieldHtml(fotoAtual) {
  return `
    <div class="field span-2">
      <label>Foto de perfil</label>
      <div style="display:flex; align-items:center; gap:12px;">
        <span id="fFotoPreviewWrap">${avatarHtml(fotoAtual, '?', 64)}</span>
        <input type="file" id="fFoto" accept="image/*">
      </div>
    </div>`;
}
/* Liga o input de foto do formulário; devolve um getter para o valor atual
   (dataURL redimensionado, ou o valor inicial se o utilizador não trocar). */
function wireFotoField(fotoInicial) {
  let fotoAtual = fotoInicial || null;
  const input = document.getElementById('fFoto');
  if (input) {
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      redimensionarImagem(file, 300, (dataUrl) => {
        fotoAtual = dataUrl;
        document.getElementById('fFotoPreviewWrap').innerHTML = avatarHtml(fotoAtual, '?', 64);
      }, (msg) => toast(msg));
    };
  }
  return () => fotoAtual;
}
/* Turma (coorte) do aluno via a sua matrícula ativa — usado no preenchimento
   automático da pesquisa por número de matrícula e em Meu Painel. */
function turmaDoAluno(alunoId) {
  const m = state.matriculas.find(x => x.alunoId === alunoId && x.status === 'Ativa');
  return m ? byId(state.turmas, m.turmaId) : null;
}
/* Campo de pesquisa de aluno por número de matrícula — substitui a caixa de
   combinação nos formulários de Matrículas, Financeiro, Biblioteca
   (Empréstimos) e Utilizadores (Aluno associado). Devolve o HTML; a ligação
   (procurar ao pressionar Enter, devolver o alunoId resolvido) é feita à
   parte por wireAlunoBusca(), depois do modal estar no DOM. */
function alunoBuscaFieldHtml(alunoAtualId) {
  const atual = alunoAtualId ? byId(state.alunos, alunoAtualId) : null;
  return `
    <div class="field span-2">
      <label>Nº de Matrícula do Aluno</label>
      <input id="fAlunoNumero" placeholder="Ex.: 2026-EI-001 — prima Enter para procurar" value="${esc(atual?.numero || '')}">
      <input type="hidden" id="fAlunoId" value="${esc(alunoAtualId || '')}">
    </div>
    <div class="field"><label>Nome</label><input id="fAlunoNome" disabled value="${esc(atual?.nome || '')}"></div>
    <div class="field"><label>Curso</label><input id="fAlunoCurso" disabled value="${esc(atual ? cursoNome(atual.cursoId) : '')}"></div>
    <div class="field"><label>Turma</label><input id="fAlunoTurma" disabled value="${esc(atual ? turmaCodigo(turmaDoAluno(atual.id)) : '')}"></div>`;
}
/* Liga o campo de busca de aluno criado por alunoBuscaFieldHtml(): procura
   ao pressionar Enter e preenche os campos só-leitura; devolve um getter
   para o alunoId atualmente resolvido (ou '' se nenhum). */
function wireAlunoBusca(alunoAtualId) {
  const inputNumero = document.getElementById('fAlunoNumero');
  const inputId = document.getElementById('fAlunoId');
  const campoNome = document.getElementById('fAlunoNome');
  const campoCurso = document.getElementById('fAlunoCurso');
  const campoTurma = document.getElementById('fAlunoTurma');
  function preencher(aluno) {
    inputId.value = aluno ? aluno.id : '';
    campoNome.value = aluno ? aluno.nome : '';
    campoCurso.value = aluno ? cursoNome(aluno.cursoId) : '';
    campoTurma.value = aluno ? turmaCodigo(turmaDoAluno(aluno.id)) : '';
  }
  if (alunoAtualId) preencher(byId(state.alunos, alunoAtualId));
  inputNumero.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const numero = inputNumero.value.trim();
    const aluno = numero ? state.alunos.find(a => a.numero.toLowerCase() === numero.toLowerCase()) : null;
    if (!numero) { preencher(null); return; }
    if (!aluno) { preencher(null); toast('Aluno não encontrado para esse número de matrícula.'); return; }
    preencher(aluno);
    toast(`Aluno encontrado: ${aluno.nome}`);
  });
  return () => inputId.value || '';
}
/* O valor guardado (state.anoLetivo, matriculas.anoLetivo, etc.) é sempre o
   ANO EM QUE O CICLO TERMINA — ex.: 2026 = ano académico 2025/2026, que
   decorre de 01/08/2025 a 31/07/2026. O próximo ciclo (2026/2027, a partir
   de 01/08/2026) é por isso representado como 2027. */
function anoLetivoLabel(ano) {
  return ano ? `${Number(ano) - 1}/${ano}` : '—';
}
/* Por defeito cada ano académico corre 01/08 a 31/07 (ver anoLetivoLabel),
   mas a Secretaria pode ajustar exceções específicas em state.calendarioAcademico. */
function calendarioOverride(ano) { return state.calendarioAcademico.find(c => c.ano === Number(ano)) || null; }
function anoLetivoInicio(ano) { return calendarioOverride(ano)?.inicio || `${Number(ano) - 1}-08-01`; }
function anoLetivoFim(ano) { return calendarioOverride(ano)?.fim || `${ano}-07-31`; }
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function byId(arr, id) { return arr.find(x => x.id === id); }

function cursoNome(id) { const c = byId(state.cursos, id); return c ? c.nome : '—'; }
function professorNome(id) { const p = byId(state.professores, id); return p ? p.nome : '—'; }
function disciplinaNome(id) { const d = byId(state.disciplinas, id); return d ? d.nome : '—'; }
function alunoNome(id) { const a = byId(state.alunos, id); return a ? a.nome : '—'; }
function livroTitulo(id) { const l = byId(state.livros, id); return l ? l.titulo : '—'; }

/* Lookups genéricos dos cadastros/tabelas de apoio — usados em toda a UI para
   mostrar o nome em vez do ID guardado (unidadeOrganicaId, periodoEstudo/turno,
   anoEstudo, sala/laboratório, província/município, etc.). */
function cadastroNome(tipoKey, id) {
  if (!id) return '—';
  const item = (state[tipoKey] || []).find(x => x.id === id);
  return item ? item.nome : '—';
}
function unidadeOrganicaNome(id) { return cadastroNome('unidadesOrganicas', id); }
function periodoEstudoNome(id) { return cadastroNome('periodosEstudo', id); }
function anoEstudoNome(id) { return cadastroNome('anosEstudo', id); }
function salaNome(id) { return cadastroNome('salas', id); }
function laboratorioNome(id) { return cadastroNome('laboratorios', id); }
function provinciaNome(id) { return cadastroNome('provincias', id); }
function municipioNome(id) { return cadastroNome('municipios', id); }
function escolaProvenienciaNome(id) { return cadastroNome('escolasProveniencia', id); }
function generoNome(id) { return cadastroNome('generos', id); }
function nacionalidadeNome(id) { return cadastroNome('nacionalidades', id); }
function cursoProvenienciaNome(id) { return cadastroNome('cursosProveniencia', id); }
function categoriaDocenteNome(id) { return cadastroNome('categoriasDocentes', id); }
function horarioLabel(id) {
  const h = byId(state.horarios, id);
  return h ? `${h.nome} (${h.inicio}–${h.fim})` : '—';
}
function localTurmaLabel(t) {
  return t.localTipo === 'Laboratorio' ? laboratorioNome(t.localId) : salaNome(t.localId);
}

/* ------------------------------ Código da turma --------------------------- */
/* Ex.: EI2-MR = Engenharia Informática, 2º ano, Manhã, Regular.
   Se duas turmas caem no mesmo curso/ano/turno/regime, distingue-se com um
   sufixo numérico (-1, -2...). */

function cursoSigla(c) {
  if (!c) return '???';
  if (c.sigla) return c.sigla;
  return c.nome.split(/\s+/).filter(w => w.length > 2).map(w => w[0]).join('').toUpperCase().slice(0, 3) || 'CUR';
}
/* Turma = coorte de alunos: id, cursoId, anoEstudo, anoLetivo, turno, regime,
   vagas — independente de Disciplina e de Horário. O código (ex.: "EI2-MR")
   é sempre computado a partir destes 4 campos, nunca guardado; o formulário
   valida unicidade de (cursoId, anoEstudo, turno, regime), por isso não é
   preciso sufixo de desempate. */
function turmaCodigo(t) {
  if (!t) return '—';
  const c = byId(state.cursos, t.cursoId);
  const anoObj = byId(state.anosEstudo, t.anoEstudo);
  const anoTxt = anoObj ? anoObj.ordem : '';
  const turnoLetra = TURNO_LETRA[periodoEstudoNome(t.turno)] || '?';
  const regimeLetra = REGIME_LETRA[t.regime] || '?';
  return `${cursoSigla(c)}${anoTxt}-${turnoLetra}${regimeLetra}`;
}
/* Aula = relação Turma↔Disciplina↔Professor↔Horário (disciplinaId,
   professorId, dia, hora, localTipo, localId) — o que antes se chamava
   "turma". */
function aulaLabel(a) {
  if (!a) return '—';
  return `[${esc(turmaCodigo(byId(state.turmas, a.turmaId)))}] ${esc(disciplinaNome(a.disciplinaId))} — ${esc(professorNome(a.professorId))}`;
}

function badge(text, tone) {
  return `<span class="badge badge-${tone}">${esc(text)}</span>`;
}
function statusBadge(status) {
  const map = {
    Ativo: 'green', Ativa: 'green', Pago: 'green', Aprovado: 'green', Devolvido: 'green', Admitido: 'green',
    Pendente: 'amber', Trancado: 'amber', Trancada: 'amber', 'Em curso': 'amber', Emprestado: 'amber',
    'Aguarda Exame de Recurso': 'amber', 'Aguarda Exame Especial': 'amber', Avaliado: 'amber',
    Atrasado: 'red', Reprovado: 'red', 'Não Admitido': 'red', Desistente: 'red', Cancelada: 'red', Inativo: 'gray',
    Concluído: 'gray', Concluída: 'gray', Inscrito: 'gray',
  };
  return badge(status, map[status] || 'gray');
}
function rolePill(papel) {
  return `<span class="badge badge-gray">${esc(ROLE_LABELS[papel] || papel)}</span>`;
}
function janelaBadge(status) {
  const labels = { aberto: 'Aberto', agendado: 'Agendado', encerrado: 'Encerrado', 'nao-definido': 'Não definido', submetido: 'Submetido' };
  const tones = { aberto: 'green', agendado: 'amber', encerrado: 'red', 'nao-definido': 'gray', submetido: 'gray' };
  return badge(labels[status] || status, tones[status] || 'gray');
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2400);
}

/* --------------------------------- Modal ---------------------------------- */

function openModal(title, bodyHtml, onMount) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalOverlay').classList.add('open');
  if (onMount) onMount();
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('modalBody').innerHTML = '';
}

function lockedNote(text) {
  return `<div class="locked-note">🔒 ${esc(text)}</div>`;
}

/* ============================ Âmbito por perfil =========================== */
/* Professor só vê as suas disciplinas/turmas/notas/frequência; Estudante usa
   as páginas dedicadas Meu Painel em vez das listas administrativas. */

function scopedDisciplinas() {
  if (currentUser.papel === 'professor') return state.disciplinas.filter(d => d.professorId === currentUser.refId);
  return state.disciplinas;
}
/* Aulas (oferta de disciplina+professor+horário) dadas pelo professor —
   substitui a antiga scopedTurmas() (que hoje filtraria a coorte errada). */
function scopedAulas() {
  if (currentUser.papel === 'professor') return state.aulas.filter(a => a.professorId === currentUser.refId);
  return state.aulas;
}
/* Turmas (coortes) onde o professor dá pelo menos uma aula — usado no
   seletor de Trabalhos, que atribui à turma inteira (sem disciplina). */
function scopedTurmasDoProfessor() {
  const aulas = scopedAulas();
  const ids = [...new Set(aulas.map(a => a.turmaId))];
  return ids.map(id => byId(state.turmas, id)).filter(Boolean);
}
function scopedNotas() {
  if (currentUser.papel === 'professor') {
    const discIds = scopedDisciplinas().map(d => d.id);
    return state.notas.filter(n => discIds.includes(n.disciplinaId));
  }
  return state.notas;
}

/* ============================ Motor de avaliação =========================== */
/*
  Prova 1 + Prova 2  →  Média
  Se Média ≥ 15  →  aluno DISPENSADO do Exame Final (aprovado só com a Média)
  Caso contrário →  faz o Exame Final: Nota Final = Média×40% + Exame Final×60%
  Se < 10  →  Exame de Recurso: Nota Final = Média×40% + Exame Recurso×60%
  Se ainda < 10  →  Exame Especial: nota seca 100% (não usa a Média)
  Exame de Melhoria (opcional, só se já aprovado) = Exame Final×60% + Melhoria×40%,
  e só substitui a nota se for mais alta (protege o aluno de descer a nota a melhorar).
*/

const MEDIA_DISPENSA = 15;

function present(v) { return v !== null && v !== undefined && v !== ''; }
function round1(v) { return Math.round(v * 10) / 10; }

function media(n) {
  const vals = provaKeys().map(k => n[k]).filter(present);
  if (!vals.length) return null;
  return round1(vals.reduce((s, v) => s + Number(v), 0) / vals.length);
}
function dispensado(n) {
  return provaKeys().every(k => present(n[k])) && media(n) >= MEDIA_DISPENSA;
}
/* Quando o aluno dispensa (Média ≥ 15), a Média é lançada automaticamente no
   campo do Exame Final — não fica só "escondida" atrás de um rótulo. */
function aplicarDispensaAutomatica(n) {
  if (dispensado(n) && !present(n.exameFinal)) n.exameFinal = media(n);
}
function celulaExame(n) {
  return present(n.exameFinal) ? String(n.exameFinal) : '—';
}
function observacoes(n) {
  return dispensado(n) ? 'Dispensado' : '—';
}
function notaFinalNormal(n) {
  if (dispensado(n)) return media(n);
  const m = media(n);
  if (m === null || !present(n.exameFinal)) return null;
  return round1(m * 0.4 + Number(n.exameFinal) * 0.6);
}
function notaFinalRecurso(n) {
  const m = media(n);
  if (m === null || !present(n.exameRecurso)) return null;
  return round1(m * 0.4 + Number(n.exameRecurso) * 0.6);
}
function notaFinalEspecial(n) {
  if (!present(n.exameEspecial)) return null;
  return round1(Number(n.exameEspecial));
}
function notaFinalMelhoria(n) {
  if (!present(n.exameMelhoria)) return null;
  const base = present(n.exameFinal) ? Number(n.exameFinal) : (dispensado(n) ? media(n) : null);
  if (base === null) return null;
  return round1(base * 0.6 + Number(n.exameMelhoria) * 0.4);
}

function avaliacaoResumo(n) {
  const nf = notaFinalNormal(n);
  if (nf === null) return { efetiva: null, situacao: 'Em curso', via: null };

  let efetiva, situacao, via;
  if (nf >= 10) {
    efetiva = nf; situacao = 'Aprovado'; via = dispensado(n) ? 'Dispensa (Média)' : 'Exame Normal';
  } else {
    const nr = notaFinalRecurso(n);
    if (nr === null) {
      efetiva = nf; situacao = 'Aguarda Exame de Recurso'; via = 'Exame Normal';
    } else if (nr >= 10) {
      efetiva = nr; situacao = 'Aprovado'; via = 'Recurso';
    } else {
      const ne = notaFinalEspecial(n);
      if (ne === null) {
        efetiva = nr; situacao = 'Aguarda Exame Especial'; via = 'Recurso';
      } else {
        efetiva = ne; situacao = ne >= 10 ? 'Aprovado' : 'Reprovado'; via = 'Especial';
      }
    }
  }
  if (situacao === 'Aprovado') {
    const nm = notaFinalMelhoria(n);
    if (nm !== null && nm > efetiva) { efetiva = nm; via = 'Melhoria'; }
  }
  // A Secretaria pode optar por arredondar a Nota Final ao inteiro mais
  // próximo (ex.: 13,7 -> 14); por defeito mantém-se a precisão de 1 casa
  // decimal já calculada acima (ver Configuração da Avaliação).
  if (efetiva !== null && state.configAvaliacao?.arredondarNotaFinal) {
    efetiva = Math.round(efetiva);
  }
  return { efetiva, situacao, via };
}

/* ---------------------------- Períodos & submissões ------------------------- */

function periodoFor(aulaId, tipo) { return state.periodos.find(p => p.aulaId === aulaId && p.tipo === tipo) || null; }
function isSubmetido(aulaId, tipo) { return state.submissoes.some(s => s.aulaId === aulaId && s.tipo === tipo); }
function janelaStatus(aulaId, tipo) {
  if (isSubmetido(aulaId, tipo)) return 'submetido';
  const p = periodoFor(aulaId, tipo);
  if (!p) return 'nao-definido';
  const h = hoje();
  if (h < p.inicio) return 'agendado';
  if (h > p.fim) return 'encerrado';
  return 'aberto';
}
function estagioAtual(aulaId) {
  for (const t of tiposAvaliacao()) { if (!isSubmetido(aulaId, t.key)) return t.key; }
  return null;
}
function getOrCreateNota(alunoId, disciplinaId, aulaId) {
  let n = state.notas.find(x => x.alunoId === alunoId && x.disciplinaId === disciplinaId);
  if (!n) {
    n = { id: nextId('n'), alunoId, disciplinaId, aulaId, anoLetivo: state.anoLetivo, prova1: null, prova2: null, prova3: null, prova4: null, exameFinal: null, exameRecurso: null, exameEspecial: null, exameMelhoria: null };
    state.notas.push(n);
  } else if (!n.aulaId) {
    n.aulaId = aulaId;
  }
  return n;
}
function alunosRelevantesEstagio(aulaId, tipo, disciplinaId) {
  const roster = aulaRoster(aulaId);
  if (provaKeys().includes(tipo)) return roster;
  if (tipo === 'exameFinal') {
    // quem tem Média ≥ 15 fica dispensado — não precisa de fazer o Exame Final
    return roster.filter(a => {
      const n = state.notas.find(x => x.alunoId === a.id && x.disciplinaId === disciplinaId);
      return !n || !dispensado(n);
    });
  }
  return roster.filter(a => {
    const n = state.notas.find(x => x.alunoId === a.id && x.disciplinaId === disciplinaId);
    if (!n) return false;
    if (tipo === 'exameRecurso') { const nf = notaFinalNormal(n); return nf !== null && nf < 10; }
    if (tipo === 'exameEspecial') { const nr = notaFinalRecurso(n); return nr !== null && nr < 10; }
    return false;
  });
}

/* ------------------------- Exame de Melhoria (por pedido) --------------------- */
/* Ao contrário das etapas acima, a Melhoria não bloqueia a turma inteira: é
   pedida por um aluno específico, aprovada pela Secretaria Académica e só
   depois lançada pelo docente para esse aluno. */

function melhoriaFor(alunoId, disciplinaId) {
  return state.melhorias
    .filter(m => m.alunoId === alunoId && m.disciplinaId === disciplinaId)
    .sort((a, b) => (a.solicitadoEm < b.solicitadoEm ? 1 : -1))[0] || null;
}
function podeSolicitarMelhoria(n) {
  if (avaliacaoResumo(n).situacao !== 'Aprovado') return false;
  const req = melhoriaFor(n.alunoId, n.disciplinaId);
  return !req || req.status === 'Rejeitada';
}
function renderMelhoriaPanelHtml(disciplinaId) {
  const pedidos = state.melhorias.filter(m => m.disciplinaId === disciplinaId);
  if (!pedidos.length) return '';
  const linhas = pedidos.map(p => ({ p, n: state.notas.find(x => x.alunoId === p.alunoId && x.disciplinaId === disciplinaId) }));
  const pendentes = linhas.filter(l => l.p.status === 'Pendente');
  const porLancar = linhas.filter(l => l.p.status === 'Aprovada' && l.n && !present(l.n.exameMelhoria));
  if (!pendentes.length && !porLancar.length) return '';
  return `
    <div class="panel">
      <h3>Exames de Melhoria</h3>
      ${pendentes.length ? `<p class="text-muted">${pendentes.length} pedido(s) de ${esc(pendentes.map(l => alunoNome(l.p.alunoId)).join(', '))} a aguardar aprovação da Secretaria Académica.</p>` : ''}
      ${porLancar.length ? `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Aluno</th><th style="width:140px;">Nota de Melhoria (0–20)</th><th></th></tr></thead>
          <tbody>
            ${porLancar.map(l => `
              <tr>
                <td>${esc(alunoNome(l.p.alunoId))}</td>
                <td><input class="input" type="number" min="0" max="20" step="0.5" data-melhoria="${l.p.alunoId}" value="${l.n.exameMelhoria ?? ''}"></td>
                <td><button class="btn btn-sm btn-primary" data-gravar-melhoria="${l.p.alunoId}" data-disc-melhoria="${disciplinaId}">Gravar</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table></div>
      ` : ''}
    </div>`;
}
function wireMelhoriaPanel(rerenderFn) {
  document.querySelectorAll('[data-gravar-melhoria]').forEach(btn => {
    btn.onclick = () => {
      const alunoId = btn.dataset.gravarMelhoria;
      const disciplinaId = btn.dataset.discMelhoria;
      const input = document.querySelector(`[data-melhoria="${alunoId}"]`);
      if (input.value === '') { toast('Indique a nota de melhoria.'); return; }
      const n = state.notas.find(x => x.alunoId === alunoId && x.disciplinaId === disciplinaId);
      n.exameMelhoria = Number(input.value);
      registrarLog('Editar', 'notas', `Nota de Exame de Melhoria lançada: ${alunoNome(alunoId)} — ${disciplinaNome(disciplinaId)} = ${n.exameMelhoria}.`);
      saveState();
      toast('Nota de melhoria registada.');
      rerenderFn();
    };
  });
}

/* ================================ Dashboard =============================== */

function renderDashboard() {
  const alunosAtivos = state.alunos.filter(a => a.status === 'Ativo');
  const cursosAtivos = state.cursos.length;
  const turmasAtivas = state.turmas.length;
  const professoresAtivos = state.professores.filter(p => p.status === 'Ativo').length;

  const resumos = state.notas.map(n => avaliacaoResumo(n)).filter(r => r.situacao === 'Aprovado' || r.situacao === 'Reprovado');
  const aprovados = resumos.filter(r => r.situacao === 'Aprovado').length;
  const taxaAprovacao = resumos.length ? Math.round((aprovados / resumos.length) * 100) : 0;

  const receitaPendente = state.financeiro
    .filter(f => f.status !== 'Pago')
    .reduce((s, f) => s + f.valor, 0);

  const porCurso = state.cursos.map(c => ({
    nome: c.nome,
    total: state.alunos.filter(a => a.cursoId === c.id && a.status !== 'Desistente').length,
  }));
  const maxCurso = Math.max(1, ...porCurso.map(c => c.total));

  const finStatusCount = { Pago: 0, Pendente: 0, Atrasado: 0 };
  state.financeiro.forEach(f => { finStatusCount[f.status] = (finStatusCount[f.status] || 0) + 1; });
  const finTotal = Math.max(1, state.financeiro.length);

  const atrasados = state.financeiro.filter(f => f.status === 'Atrasado');

  const financeiroPanel = hasPerm('financeiro', 'view') ? `
    <div class="panel">
      <h3>Situação financeira</h3>
      <div class="panel-sub">${state.financeiro.length} lançamento(s) no total</div>
      <div class="legend">
        ${legendRow('Pago', finStatusCount.Pago, finTotal, 'var(--green)')}
        ${legendRow('Pendente', finStatusCount.Pendente, finTotal, 'var(--amber)')}
        ${legendRow('Atrasado', finStatusCount.Atrasado, finTotal, 'var(--red)')}
      </div>
    </div>
  ` : '';

  const alertasPanel = hasPerm('financeiro', 'view') ? `
    <div class="panel">
      <h3>Alertas — pagamentos em atraso</h3>
      <div class="panel-sub">Alunos com propinas ou taxas vencidas por regularizar</div>
      ${atrasados.length === 0 ? '<p class="text-muted">Sem pagamentos em atraso. ✓</p>' : `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Aluno</th><th>Descrição</th><th>Vencimento</th><th class="text-right">Valor</th></tr></thead>
          <tbody>
            ${atrasados.map(f => `
              <tr>
                <td>${esc(alunoNome(f.alunoId))}</td>
                <td>${esc(f.descricao)}</td>
                <td>${fmtDate(f.vencimento)}</td>
                <td class="text-right mono">${fmtMoney(f.valor)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table></div>
      `}
    </div>
  ` : '';

  document.getElementById('content').innerHTML = `
    <section class="section active" id="sec-dashboard">
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Alunos Ativos</div>
          <div class="kpi-value">${alunosAtivos.length}</div>
          <div class="kpi-sub">${state.alunos.length} no total</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Professores Ativos</div>
          <div class="kpi-value">${professoresAtivos}</div>
          <div class="kpi-sub">${state.professores.length} no total</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Cursos / Turmas</div>
          <div class="kpi-value">${cursosAtivos} / ${turmasAtivas}</div>
          <div class="kpi-sub">${state.disciplinas.length} disciplinas</div>
        </div>
        <div class="kpi-card accent-green">
          <div class="kpi-label">Taxa de Aprovação</div>
          <div class="kpi-value">${taxaAprovacao}%</div>
          <div class="kpi-sub">${resumos.length} avaliação(ões) concluída(s)</div>
        </div>
        ${hasPerm('financeiro', 'view') ? `
        <div class="kpi-card accent-amber">
          <div class="kpi-label">Receita Pendente</div>
          <div class="kpi-value">${fmtMoney(receitaPendente)}</div>
          <div class="kpi-sub">${atrasados.length} pagamento(s) atrasado(s)</div>
        </div>` : ''}
      </div>

      <div class="grid-2">
        <div class="panel">
          <h3>Alunos por curso</h3>
          <div class="panel-sub">Matrículas ativas / trancadas por programa</div>
          <div class="bars">
            ${porCurso.map(c => `
              <div class="bar-row">
                <span>${esc(c.nome)}</span>
                <div class="bar-track"><div class="bar-fill" style="width:${(c.total / maxCurso) * 100}%"></div></div>
                <span class="bar-val">${c.total}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ${financeiroPanel}
      </div>

      ${alertasPanel}
    </section>
  `;
}

function legendRow(label, count, total, color) {
  const pct = Math.round((count / total) * 100);
  return `
    <div class="legend-item">
      <span class="legend-dot" style="background:${color}"></span>
      <span style="flex:1">${label}</span>
      <span class="text-muted">${count} (${pct}%)</span>
    </div>`;
}

/* =========================== Painel do Professor =========================== */

function renderPainelProfessor() {
  const prof = currentUser.refId ? byId(state.professores, currentUser.refId) : null;
  if (!prof) {
    document.getElementById('content').innerHTML = `<section class="section active">${lockedNote('Este utilizador de perfil Professor não está associado a nenhum registo de professor.')}</section>`;
    return;
  }
  const minhasAulas = scopedAulas();
  const minhasDisciplinas = scopedDisciplinas();
  const minhasNotas = scopedNotas();
  const pendentes = minhasNotas.filter(n => ['Em curso', 'Aguarda Exame de Recurso', 'Aguarda Exame Especial'].includes(avaliacaoResumo(n).situacao)).length;
  const alunosAbrangidos = new Set();
  minhasAulas.forEach(a => aulaRoster(a.id).forEach(al => alunosAbrangidos.add(al.id)));
  const alunosEmRisco = new Set();
  minhasAulas.forEach(a => calcularFrequenciaAula(a.id).forEach(l => { if (emRiscoPorFaltas(l.pct)) alunosEmRisco.add(l.aluno.id); }));

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">Minhas Aulas</div><div class="kpi-value">${minhasAulas.length}</div><div class="kpi-sub">${minhasDisciplinas.length} disciplina(s)</div></div>
        <div class="kpi-card"><div class="kpi-label">Alunos Abrangidos</div><div class="kpi-value">${alunosAbrangidos.size}</div><div class="kpi-sub">nas turmas atribuídas</div></div>
        <div class="kpi-card accent-amber"><div class="kpi-label">Notas Pendentes</div><div class="kpi-value">${pendentes}</div><div class="kpi-sub">a aguardar próxima avaliação</div></div>
        <div class="kpi-card ${alunosEmRisco.size ? 'accent-red' : ''}"><div class="kpi-label">Em Risco por Faltas</div><div class="kpi-value">${alunosEmRisco.size}</div><div class="kpi-sub">frequência abaixo de ${FREQUENCIA_MINIMA}%</div></div>
      </div>

      <div class="panel">
        <h3>${avatarHtml(prof.foto, prof.nome, 40)} <span style="vertical-align:middle;">Minhas turmas — estado da avaliação</span></h3>
        <div class="panel-sub">${esc(prof.nome)} — ${esc(prof.especialidade)}</div>
        ${minhasAulas.length === 0 ? '<p class="text-muted">Sem turmas atribuídas.</p>' : `
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Código</th><th>Disciplina</th><th>Curso</th><th>Dia / Hora</th><th>Etapa atual</th><th>Estado</th></tr></thead>
            <tbody>
              ${minhasAulas.map(a => {
                const turma = byId(state.turmas, a.turmaId);
                const estagio = estagioAtual(a.id);
                return `<tr>
                  <td class="mono">${esc(turmaCodigo(turma))}</td>
                  <td>${esc(disciplinaNome(a.disciplinaId))}</td>
                  <td>${esc(cursoNome(turma?.cursoId))}</td>
                  <td>${DIAS[a.dia]}, ${esc(horarioLabel(a.hora))}</td>
                  <td>${estagio ? esc(tipoLabel(estagio)) : 'Concluído'}</td>
                  <td>${estagio ? janelaBadge(janelaStatus(a.id, estagio)) : badge('Tudo submetido', 'green')}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table></div>
        `}
      </div>

      <div class="toolbar">
        ${hasPerm('notas', 'view') ? `<button class="btn btn-primary" id="btnIrNotas">Lançar / consultar notas</button>` : ''}
        ${hasPerm('frequencia', 'view') ? `<button class="btn" id="btnIrFrequencia">Fazer chamada</button>` : ''}
        ${hasPerm('periodos', 'view') ? `<button class="btn" id="btnIrPeriodos">Ver períodos de avaliação</button>` : ''}
      </div>
    </section>
  `;
  const btnNotas = document.getElementById('btnIrNotas');
  const btnFreq = document.getElementById('btnIrFrequencia');
  const btnPer = document.getElementById('btnIrPeriodos');
  if (btnNotas) btnNotas.onclick = () => goTo('notas');
  if (btnFreq) btnFreq.onclick = () => goTo('frequencia');
  if (btnPer) btnPer.onclick = () => goTo('periodos');
}

/* ================================ Meu Painel =============================== */

function renderMeuPainel() {
  const aluno = currentUser.refId ? byId(state.alunos, currentUser.refId) : null;
  if (!aluno) {
    document.getElementById('content').innerHTML = `<section class="section active">${lockedNote('Este utilizador de perfil Estudante não está associado a nenhum registo de aluno.')}</section>`;
    return;
  }
  const notas = state.notas.filter(n => n.alunoId === aluno.id);
  const financeiro = state.financeiro.filter(f => f.alunoId === aluno.id);
  const meusEmprestimos = state.emprestimos.filter(e => e.alunoId === aluno.id);
  const minhasAdesoes = state.trabalhoIntegrantes
    .filter(ti => ti.alunoId === aluno.id)
    .map(ti => ({ ti, trabalho: byId(state.trabalhos, ti.trabalhoId) }))
    .filter(x => x.trabalho);
  const meusMateriais = state.materiais.filter(m => {
    const d = byId(state.disciplinas, m.disciplinaId);
    return d && d.cursoId === aluno.cursoId;
  });
  const minhaMatricula = state.matriculas.find(m => m.alunoId === aluno.id && m.status === 'Ativa');
  const minhaTurma = minhaMatricula ? byId(state.turmas, minhaMatricula.turmaId) : null;
  const minhasAulas = minhaTurma ? state.aulas.filter(a => a.turmaId === minhaTurma.id) : [];

  const presencaPorDisciplina = {};
  state.frequencia.forEach(f => {
    if (!(aluno.id in f.presencas)) return;
    const a = byId(state.aulas, f.aulaId);
    if (!a) return;
    const key = a.disciplinaId;
    presencaPorDisciplina[key] = presencaPorDisciplina[key] || { presente: 0, total: 0 };
    presencaPorDisciplina[key].total += 1;
    if (f.presencas[aluno.id]) presencaPorDisciplina[key].presente += 1;
  });

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="panel">
        <h3>${avatarHtml(aluno.foto, aluno.nome, 40)} <span style="vertical-align:middle;">${esc(aluno.nome)}</span></h3>
        <div class="panel-sub">${esc(aluno.numero)} · ${esc(cursoNome(aluno.cursoId))} · ${esc(anoEstudoNome(aluno.anoCurricular))} · ${statusBadge(aluno.status)}</div>
      </div>

      <div class="panel">
        <h3>O meu horário semanal</h3>
        <div class="panel-sub">Turma ${minhaTurma ? esc(turmaCodigo(minhaTurma)) : '—'} · ${esc(cursoNome(aluno.cursoId))} · Ano letivo ${anoLetivoLabel(state.anoLetivo)}</div>
        ${minhasAulas.length === 0 ? '<p class="text-muted">Ainda não há aulas atribuídas à sua turma.</p>' : `
          <div class="table-wrap" style="overflow-x:auto; border:none; box-shadow:none;">
            ${renderScheduleGrid(minhasAulas)}
          </div>
          <div class="table-wrap" style="margin-top:12px;"><table class="data">
            <thead><tr><th>Código</th><th>Disciplina</th><th>Professor</th><th>Turno / Regime</th><th>Dia / Hora</th><th>Local</th></tr></thead>
            <tbody>
              ${minhasAulas.map(a => `
                <tr>
                  <td class="mono">${esc(turmaCodigo(minhaTurma))}</td>
                  <td>${esc(disciplinaNome(a.disciplinaId))}</td>
                  <td>${esc(professorNome(a.professorId))}</td>
                  <td>${esc(periodoEstudoNome(minhaTurma.turno))} · ${esc(minhaTurma.regime)}</td>
                  <td>${DIAS[a.dia]}, ${esc(horarioLabel(a.hora))}</td>
                  <td>${esc(localTurmaLabel(a))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        `}
      </div>

      <div class="panel">
        <h3>As minhas notas</h3>
        ${notas.length === 0 ? '<p class="text-muted">Ainda sem notas lançadas.</p>' : `
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Disciplina</th>${provaKeys().map((_, i) => `<th>P${i + 1}</th>`).join('')}<th>Média</th><th>Exame</th><th>Recurso</th><th>Especial</th><th>Melhoria</th><th>Nota Final</th><th>Situação</th><th>Observações</th><th></th></tr></thead>
            <tbody>
              ${notas.map(n => {
                const r = avaliacaoResumo(n);
                const req = melhoriaFor(n.alunoId, n.disciplinaId);
                let acaoMelhoria = '';
                if (podeSolicitarMelhoria(n)) acaoMelhoria = `<button class="btn btn-sm" data-solicitar-melhoria="${n.disciplinaId}">Solicitar Exame de Melhoria</button>`;
                else if (req?.status === 'Pendente') acaoMelhoria = `<span class="text-muted" style="font-size:12px;">Pedido de melhoria pendente</span>`;
                else if (req?.status === 'Aprovada' && !present(n.exameMelhoria)) acaoMelhoria = `<span class="text-muted" style="font-size:12px;">Melhoria aprovada — aguarda lançamento do docente</span>`;
                return `
                <tr>
                  <td>${esc(disciplinaNome(n.disciplinaId))}</td>
                  ${provaKeys().map(k => `<td class="mono">${n[k] ?? '—'}</td>`).join('')}
                  <td class="mono">${media(n) ?? '—'}</td>
                  <td class="mono">${celulaExame(n)}</td>
                  <td class="mono">${n.exameRecurso ?? '—'}</td>
                  <td class="mono">${n.exameEspecial ?? '—'}</td>
                  <td class="mono">${n.exameMelhoria ?? '—'}</td>
                  <td class="mono">${r.efetiva ?? '—'}</td>
                  <td>${statusBadge(r.situacao)}</td>
                  <td>${esc(observacoes(n))}</td>
                  <td>${acaoMelhoria}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table></div>
        `}
      </div>

      <div class="panel">
        <h3>A minha frequência</h3>
        <div class="panel-sub">Mínimo exigido: ${FREQUENCIA_MINIMA}%</div>
        ${Object.keys(presencaPorDisciplina).length === 0 ? '<p class="text-muted">Sem registos de chamada ainda.</p>' : `
          <div class="bars">
            ${Object.entries(presencaPorDisciplina).map(([discId, v]) => {
              const pct = Math.round((v.presente / v.total) * 100);
              const risco = emRiscoPorFaltas(pct);
              return `
                <div class="bar-row">
                  <span>${esc(disciplinaNome(discId))}</span>
                  <div class="bar-track"><div class="bar-fill" style="width:${pct}%; ${risco ? 'background:var(--red);' : ''}"></div></div>
                  <span class="bar-val">${pct}%</span>
                </div>
                ${risco ? `<div class="locked-note" style="margin-top:-4px;">⚠️ ${esc(disciplinaNome(discId))}: frequência abaixo de ${FREQUENCIA_MINIMA}% — risco de reprovação por faltas.</div>` : ''}`;
            }).join('')}
          </div>
        `}
      </div>

      <div class="panel">
        <h3>O meu financeiro</h3>
        ${financeiro.length === 0 ? '<p class="text-muted">Sem lançamentos financeiros.</p>' : `
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Descrição</th><th>Vencimento</th><th class="text-right">Valor</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              ${financeiro.map(f => `
                <tr>
                  <td>${esc(f.descricao)}</td>
                  <td>${fmtDate(f.vencimento)}</td>
                  <td class="text-right mono">${fmtMoney(f.valor)}</td>
                  <td>${statusBadge(f.status)}</td>
                  <td>${f.status !== 'Pago' ? `<button class="btn btn-sm btn-primary" data-simular-pag="${f.id}">Simular pagamento (Multicaixa Express)</button>` : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        `}
      </div>

      <div class="panel">
        <h3>Os meus empréstimos (Biblioteca)</h3>
        ${meusEmprestimos.length === 0 ? '<p class="text-muted">Sem livros emprestados.</p>' : `
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Livro</th><th>Emprestado em</th><th>Devolução prevista</th><th>Estado</th></tr></thead>
            <tbody>
              ${meusEmprestimos.map(e => `
                <tr>
                  <td>${esc(livroTitulo(e.livroId))}</td>
                  <td>${fmtDate(e.dataEmprestimo)}</td>
                  <td>${fmtDate(e.dataPrevista)}</td>
                  <td>${statusBadge(emprestimoStatus(e))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        `}
      </div>

      <div class="panel">
        <h3>Trabalhos atribuídos</h3>
        ${minhasAdesoes.length === 0 ? '<p class="text-muted">Sem trabalhos atribuídos.</p>' : minhasAdesoes.map(({ ti, trabalho }) => {
          const turma = byId(state.turmas, trabalho.turmaId);
          const ficheiro = ficheiroDoIntegrante(trabalho.id, aluno.id);
          return `
            <div class="panel" style="margin-bottom:10px; background:var(--bg);">
              <h4 style="margin:0 0 4px;">${esc(trabalho.tema)}</h4>
              <div class="panel-sub">Turma ${esc(turmaCodigo(turma))} · Duração: ${trabalho.duracaoDias} dia(s) · Cotação: ${trabalho.cotacao} valores</div>
              ${ti.aceite === null ? `
                <div class="toolbar">
                  <button class="btn btn-primary btn-sm" data-aceitar-trabalho="${trabalho.id}">Aceitar adesão ao grupo</button>
                  <button class="btn btn-sm btn-danger" data-recusar-trabalho="${trabalho.id}">Recusar</button>
                </div>
              ` : ti.aceite === false ? badge('Adesão recusada', 'red') : `
                ${badge('Adesão aceite', 'green')}
                <div style="margin-top:8px;">
                  ${ficheiro ? `<p class="text-muted" style="font-size:12.5px;">Ficheiro entregue: ${esc(ficheiro.nomeFicheiro)} (${fmtTamanho(ficheiro.tamanho)}) em ${fmtDate(ficheiro.enviadoEm)}</p>` : '<p class="text-muted" style="font-size:12.5px;">Ainda não entregou ficheiro.</p>'}
                  <label class="btn btn-sm" style="cursor:pointer; margin-bottom:0;">${ficheiro ? 'Substituir ficheiro' : 'Carregar ficheiro'}
                    <input type="file" data-upload-trabalho="${trabalho.id}" style="display:none;">
                  </label>
                </div>
              `}
            </div>`;
        }).join('')}
      </div>

      <div class="panel">
        <h3>Materiais das minhas disciplinas</h3>
        ${meusMateriais.length === 0 ? '<p class="text-muted">Sem materiais publicados.</p>' : `
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Disciplina</th><th>Título</th><th>Descrição</th><th></th></tr></thead>
            <tbody>
              ${meusMateriais.map(m => `
                <tr>
                  <td>${esc(disciplinaNome(m.disciplinaId))}</td>
                  <td>${esc(m.titulo)}</td>
                  <td>${esc(m.descricao || '')}</td>
                  <td class="row-actions">${m.link ? `<a class="btn btn-sm" href="${esc(m.link)}" target="_blank" rel="noopener">Abrir link</a>` : (m.conteudo ? `<button class="btn btn-sm" data-descarregar-material="${m.id}">Descarregar</button>` : '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        `}
      </div>
    </section>
  `;

  minhasAdesoes.forEach(({ trabalho }) => {
    const btnAceitar = document.querySelector(`[data-aceitar-trabalho="${trabalho.id}"]`);
    const btnRecusar = document.querySelector(`[data-recusar-trabalho="${trabalho.id}"]`);
    const inputFicheiro = document.querySelector(`[data-upload-trabalho="${trabalho.id}"]`);
    if (btnAceitar) btnAceitar.onclick = () => {
      const ti = state.trabalhoIntegrantes.find(x => x.trabalhoId === trabalho.id && x.alunoId === aluno.id);
      ti.aceite = true;
      ti.respondidoEm = hoje();
      registrarLog('Editar', 'trabalhos', `Adesão aceite: ${aluno.nome} — "${trabalho.tema}".`);
      saveState();
      toast('Adesão ao grupo aceite.');
      renderMeuPainel();
    };
    if (btnRecusar) btnRecusar.onclick = () => {
      if (!confirm('Recusar a adesão a este grupo de trabalho?')) return;
      const ti = state.trabalhoIntegrantes.find(x => x.trabalhoId === trabalho.id && x.alunoId === aluno.id);
      ti.aceite = false;
      ti.respondidoEm = hoje();
      registrarLog('Editar', 'trabalhos', `Adesão recusada: ${aluno.nome} — "${trabalho.tema}".`);
      saveState();
      toast('Adesão recusada.');
      renderMeuPainel();
    };
    if (inputFicheiro) inputFicheiro.onchange = () => {
      const file = inputFicheiro.files[0];
      if (!file) return;
      lerFicheiroComoDataURL(file, 5 * 1024 * 1024, (dataUrl) => {
        let tf = state.trabalhoFicheiros.find(x => x.trabalhoId === trabalho.id && x.alunoId === aluno.id);
        if (!tf) { tf = { id: nextId('tf'), trabalhoId: trabalho.id, alunoId: aluno.id }; state.trabalhoFicheiros.push(tf); }
        tf.nomeFicheiro = file.name;
        tf.tipoFicheiro = file.type;
        tf.tamanho = file.size;
        tf.conteudo = dataUrl;
        tf.enviadoEm = hoje();
        registrarLog('Criar', 'trabalhos', `Ficheiro entregue: ${aluno.nome} — "${trabalho.tema}" (${file.name}).`);
        saveState();
        toast('Ficheiro carregado com sucesso.');
        renderMeuPainel();
      }, (msg) => toast(msg));
    };
  });
  meusMateriais.forEach(m => {
    const btn = document.querySelector(`[data-descarregar-material="${m.id}"]`);
    if (btn) btn.onclick = () => descarregarFicheiroArmazenado(m.nomeFicheiro, m.conteudo);
  });

  financeiro.filter(f => f.status !== 'Pago').forEach(f => {
    const btn = document.querySelector(`[data-simular-pag="${f.id}"]`);
    if (btn) btn.onclick = () => {
      f.status = 'Pago';
      f.dataPagamento = hoje();
      registrarLog('Editar', 'financeiro', `Pagamento simulado pelo estudante: ${aluno.nome} — ${f.descricao} (${fmtMoney(f.valor)}).`);
      saveState();
      toast('Pagamento simulado com sucesso.');
      renderMeuPainel();
    };
  });

  notas.forEach(n => {
    const btn = document.querySelector(`[data-solicitar-melhoria="${n.disciplinaId}"]`);
    if (btn) btn.onclick = () => {
      state.melhorias.push({ id: nextId('me'), alunoId: aluno.id, disciplinaId: n.disciplinaId, solicitadoEm: hoje(), status: 'Pendente', respondidoEm: null });
      registrarLog('Criar', 'notas', `Pedido de Exame de Melhoria solicitado: ${aluno.nome} — ${disciplinaNome(n.disciplinaId)}.`);
      saveState();
      toast('Pedido de Exame de Melhoria enviado à Secretaria Académica.');
      renderMeuPainel();
    };
  });
}

/* ================================= Alunos ================================= */

function renderAlunos(filter = {}) {
  const term = (filter.q || '').toLowerCase();
  const cursoId = filter.curso || '';
  const status = filter.status || '';
  const ano = filter.ano || '';
  const turmaId = filter.turma || '';
  const canCreate = hasPerm('alunos', 'create');
  const canEdit = hasPerm('alunos', 'edit');
  const canDelete = hasPerm('alunos', 'delete');

  const idsRosterTurma = turmaId ? new Set(turmaRoster(turmaId).map(a => a.id)) : null;

  const rows = state.alunos.filter(a => {
    if (term && !(a.nome.toLowerCase().includes(term) || a.numero.toLowerCase().includes(term))) return false;
    if (cursoId && a.cursoId !== cursoId) return false;
    if (status && a.status !== status) return false;
    if (ano && a.anoCurricular !== ano) return false;
    if (idsRosterTurma && !idsRosterTurma.has(a.id)) return false;
    return true;
  });

  const turmasParaFiltro = cursoId ? state.turmas.filter(t => t.cursoId === cursoId) : state.turmas;

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="toolbar">
        <input class="input" id="fltQ" placeholder="Pesquisar nome ou nº de estudante..." value="${esc(filter.q || '')}">
        <select class="input" id="fltCurso">
          <option value="">Todos os cursos</option>
          ${state.cursos.map(c => `<option value="${c.id}" ${c.id === cursoId ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
        </select>
        <select class="input" id="fltAnoAluno">
          <option value="">Todos os anos</option>
          ${state.anosEstudo.slice().sort((a, b) => a.ordem - b.ordem).map(a => `<option value="${a.id}" ${a.id === ano ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}
        </select>
        <select class="input" id="fltTurmaAluno">
          <option value="">Todas as turmas</option>
          ${turmasParaFiltro.map(t => `<option value="${t.id}" ${t.id === turmaId ? 'selected' : ''}>[${esc(turmaCodigo(t))}] ${esc(cursoNome(t.cursoId))}</option>`).join('')}
        </select>
        <select class="input" id="fltStatus">
          <option value="">Todos os estados</option>
          ${['Ativo', 'Trancado', 'Concluído', 'Desistente'].map(s => `<option ${s === status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <div class="spacer"></div>
        <button class="btn" id="btnExportarAlunos">Exportar Excel</button>
        ${canCreate ? `<button class="btn btn-primary" id="btnNovoAluno">+ Novo aluno</button>` : ''}
      </div>

      <div class="table-wrap"><table class="data">
        <thead><tr>
          <th></th><th>Nº Estudante</th><th>Nome</th><th>Curso</th><th>Ano</th><th>Naturalidade</th><th>Contacto</th><th>Estado</th><th></th>
        </tr></thead>
        <tbody>
          ${rows.length === 0 ? `<tr class="empty-row"><td colspan="9">Nenhum aluno encontrado.</td></tr>` : rows.map(a => `
            <tr>
              <td>${avatarHtml(a.foto, a.nome)}</td>
              <td class="mono">${esc(a.numero)}</td>
              <td>${esc(a.nome)}</td>
              <td>${esc(cursoNome(a.cursoId))}</td>
              <td>${esc(anoEstudoNome(a.anoCurricular))}</td>
              <td>${esc(municipioNome(a.municipioId))} / ${esc(provinciaNome(a.provinciaId))}</td>
              <td>${esc(a.telefone)}</td>
              <td>${statusBadge(a.status)}</td>
              <td class="row-actions">
                ${canEdit ? `<button class="btn btn-sm" data-edit-aluno="${a.id}">Editar</button>` : ''}
                ${canDelete ? `<button class="btn btn-sm btn-danger" data-del-aluno="${a.id}">Remover</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table></div>
    </section>
  `;

  document.getElementById('fltQ').oninput = e => renderAlunos({ ...filter, q: e.target.value });
  document.getElementById('fltCurso').onchange = e => renderAlunos({ ...filter, curso: e.target.value, turma: '' });
  document.getElementById('fltAnoAluno').onchange = e => renderAlunos({ ...filter, ano: e.target.value });
  document.getElementById('fltTurmaAluno').onchange = e => renderAlunos({ ...filter, turma: e.target.value });
  document.getElementById('fltStatus').onchange = e => renderAlunos({ ...filter, status: e.target.value });
  const btnNovo = document.getElementById('btnNovoAluno');
  if (btnNovo) btnNovo.onclick = () => openAlunoForm();
  document.getElementById('btnExportarAlunos').onclick = () => exportarExcel('alunos', 'Alunos', rows.map(a => ({
    'Nº Estudante': a.numero, 'Nome': a.nome, 'Email': a.email, 'Telefone': a.telefone,
    'Curso': cursoNome(a.cursoId), 'Ano Curricular': anoEstudoNome(a.anoCurricular), 'Ano de Ingresso': a.ingresso,
    'Género': generoNome(a.generoId), 'Nacionalidade': nacionalidadeNome(a.nacionalidadeId),
    'Província': provinciaNome(a.provinciaId), 'Município': municipioNome(a.municipioId),
    'Nº do BI': a.numeroBI || '', 'Data de Emissão do BI': a.dataEmissaoBI || '',
    'Nome do Pai': a.nomePai || '', 'Nome da Mãe': a.nomeMae || '',
    'Escola de Proveniência': escolaProvenienciaNome(a.escolaProvenienciaId), 'Curso de Proveniência': cursoProvenienciaNome(a.cursoProvenienciaId),
    'Estado': a.status,
  })));
  rows.forEach(a => {
    const editBtn = document.querySelector(`[data-edit-aluno="${a.id}"]`);
    const delBtn = document.querySelector(`[data-del-aluno="${a.id}"]`);
    if (editBtn) editBtn.onclick = () => openAlunoForm(a.id);
    if (delBtn) delBtn.onclick = () => deleteAluno(a.id);
  });
}

function openAlunoForm(id) {
  if (id ? !hasPerm('alunos', 'edit') : !hasPerm('alunos', 'create')) return;
  const a = id ? byId(state.alunos, id) : null;

  openModal(a ? 'Editar aluno' : 'Novo aluno', `
    <div class="form-grid">
      ${fotoFieldHtml(a?.foto)}
      <div class="field"><label>Nº de Estudante</label><input id="fNumero" value="${esc(a?.numero || '')}"></div>
      <div class="field"><label>Nome completo</label><input id="fNome" value="${esc(a?.nome || '')}"></div>
      <div class="field"><label>Email</label><input id="fEmail" type="email" value="${esc(a?.email || '')}"></div>
      <div class="field"><label>Telefone</label><input id="fTelefone" value="${esc(a?.telefone || '')}"></div>
      <div class="field">
        <label>Curso</label>
        <select id="fCurso">${state.cursos.map(c => `<option value="${c.id}" ${a?.cursoId === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label>Ano curricular</label>
        <select id="fAno">${state.anosEstudo.slice().sort((x, y) => x.ordem - y.ordem).map(an => `<option value="${an.id}" ${a?.anoCurricular === an.id ? 'selected' : ''}>${esc(an.nome)}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label>Estado</label>
        <select id="fStatus">${['Ativo', 'Trancado', 'Concluído', 'Desistente'].map(s => `<option ${a?.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Ano de ingresso</label><input id="fIngresso" type="number" value="${a?.ingresso || state.anoLetivo}"></div>
      <div class="field"><label>Género</label>
        <select id="fGenero"><option value="">—</option>${state.generos.map(g => `<option value="${g.id}" ${a?.generoId === g.id ? 'selected' : ''}>${esc(g.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Nacionalidade</label>
        <select id="fNacionalidade"><option value="">—</option>${state.nacionalidades.map(n => `<option value="${n.id}" ${a?.nacionalidadeId === n.id ? 'selected' : ''}>${esc(n.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Província</label>
        <select id="fProvincia"><option value="">—</option>${state.provincias.map(p => `<option value="${p.id}" ${a?.provinciaId === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Município</label>
        <select id="fMunicipio"></select>
      </div>
      <div class="field"><label>Número do BI</label><input id="fNumeroBI" value="${esc(a?.numeroBI || '')}"></div>
      <div class="field"><label>Data de Emissão do BI</label><input id="fDataEmissaoBI" type="date" value="${a?.dataEmissaoBI || ''}"></div>
      <div class="field"><label>Filiação — Nome do Pai</label><input id="fNomePai" value="${esc(a?.nomePai || '')}"></div>
      <div class="field"><label>Filiação — Nome da Mãe</label><input id="fNomeMae" value="${esc(a?.nomeMae || '')}"></div>
      <div class="field"><label>Escola de Proveniência</label>
        <select id="fEscolaProveniencia"><option value="">—</option>${state.escolasProveniencia.map(e => `<option value="${e.id}" ${a?.escolaProvenienciaId === e.id ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Curso de Proveniência</label>
        <select id="fCursoProveniencia"><option value="">—</option>${state.cursosProveniencia.map(cp => `<option value="${cp.id}" ${a?.cursoProvenienciaId === cp.id ? 'selected' : ''}>${esc(cp.nome)}</option>`).join('')}</select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Guardar</button>
    </div>
  `, () => {
    const fProvincia = document.getElementById('fProvincia');
    const fMunicipio = document.getElementById('fMunicipio');
    const getFoto = wireFotoField(a?.foto);
    function refreshMunicipios() {
      const opcoes = state.municipios.filter(m => !fProvincia.value || m.provinciaId === fProvincia.value);
      fMunicipio.innerHTML = `<option value="">—</option>` + opcoes.map(m => `<option value="${m.id}" ${a?.municipioId === m.id ? 'selected' : ''}>${esc(m.nome)}</option>`).join('');
    }
    refreshMunicipios();
    fProvincia.onchange = refreshMunicipios;
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('btnSave').onclick = () => {
      const nome = document.getElementById('fNome').value.trim();
      const numero = document.getElementById('fNumero').value.trim();
      if (!nome || !numero) { toast('Preencha nome e número de estudante.'); return; }
      const payload = {
        numero,
        nome,
        foto: getFoto(),
        email: document.getElementById('fEmail').value.trim(),
        telefone: document.getElementById('fTelefone').value.trim(),
        cursoId: document.getElementById('fCurso').value,
        anoCurricular: document.getElementById('fAno').value,
        status: document.getElementById('fStatus').value,
        ingresso: Number(document.getElementById('fIngresso').value) || state.anoLetivo,
        generoId: document.getElementById('fGenero').value || null,
        nacionalidadeId: document.getElementById('fNacionalidade').value || null,
        provinciaId: fProvincia.value || null,
        municipioId: fMunicipio.value || null,
        numeroBI: document.getElementById('fNumeroBI').value.trim(),
        dataEmissaoBI: document.getElementById('fDataEmissaoBI').value,
        nomePai: document.getElementById('fNomePai').value.trim(),
        nomeMae: document.getElementById('fNomeMae').value.trim(),
        escolaProvenienciaId: document.getElementById('fEscolaProveniencia').value || null,
        cursoProvenienciaId: document.getElementById('fCursoProveniencia').value || null,
      };
      const jaExistia = !!a;
      if (a) Object.assign(a, payload);
      else state.alunos.push({ id: nextId('a'), ...payload });
      registrarLog(jaExistia ? 'Editar' : 'Criar', 'alunos', `Aluno ${jaExistia ? 'editado' : 'criado'}: ${payload.numero} — ${payload.nome}`);
      saveState();
      closeModal();
      toast('Aluno guardado.');
      renderAlunos();
    };
  });
}

function deleteAluno(id) {
  if (!hasPerm('alunos', 'delete')) return;
  if (!confirm('Remover este aluno? Matrículas, notas e lançamentos financeiros associados também serão removidos.')) return;
  const alvo = byId(state.alunos, id);
  state.alunos = state.alunos.filter(a => a.id !== id);
  state.matriculas = state.matriculas.filter(m => m.alunoId !== id);
  state.notas = state.notas.filter(n => n.alunoId !== id);
  state.financeiro = state.financeiro.filter(f => f.alunoId !== id);
  registrarLog('Remover', 'alunos', `Aluno removido: ${alvo?.numero || id} — ${alvo?.nome || ''}`);
  saveState();
  toast('Aluno removido.');
  renderAlunos();
}

/* =============================== Professores =============================== */

function renderProfessores() {
  const canCreate = hasPerm('professores', 'create');
  const canEdit = hasPerm('professores', 'edit');
  const canDelete = hasPerm('professores', 'delete');

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn" id="btnExportarProfessores">Exportar Excel</button>
        ${canCreate ? `<button class="btn btn-primary" id="btnNovoProfessor">+ Novo professor</button>` : ''}
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th></th><th>Nome</th><th>Categoria Docente</th><th>Especialidade</th><th>Contacto</th><th>Disciplinas</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${state.professores.length === 0 ? `<tr class="empty-row"><td colspan="8">Nenhum professor registado.</td></tr>` : state.professores.map(p => {
            const nDisc = state.disciplinas.filter(d => d.professorId === p.id).length;
            return `
              <tr>
                <td>${avatarHtml(p.foto, p.nome)}</td>
                <td>${esc(p.nome)}</td>
                <td>${esc(categoriaDocenteNome(p.categoriaDocenteId))}</td>
                <td>${esc(p.especialidade)}</td>
                <td>${esc(p.email)}<br><span class="text-muted">${esc(p.telefone)}</span></td>
                <td>${nDisc}</td>
                <td>${statusBadge(p.status)}</td>
                <td class="row-actions">
                  ${canEdit ? `<button class="btn btn-sm" data-edit-prof="${p.id}">Editar</button>` : ''}
                  ${canDelete ? `<button class="btn btn-sm btn-danger" data-del-prof="${p.id}">Remover</button>` : ''}
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </section>
  `;
  const btnNovo = document.getElementById('btnNovoProfessor');
  if (btnNovo) btnNovo.onclick = () => openProfessorForm();
  document.getElementById('btnExportarProfessores').onclick = () => exportarExcel('professores', 'Professores', state.professores.map(p => ({
    'Nome': p.nome, 'Categoria Docente': categoriaDocenteNome(p.categoriaDocenteId), 'Email': p.email, 'Telefone': p.telefone, 'Especialidade': p.especialidade,
    'Disciplinas': state.disciplinas.filter(d => d.professorId === p.id).length, 'Estado': p.status,
  })));
  state.professores.forEach(p => {
    const editBtn = document.querySelector(`[data-edit-prof="${p.id}"]`);
    const delBtn = document.querySelector(`[data-del-prof="${p.id}"]`);
    if (editBtn) editBtn.onclick = () => openProfessorForm(p.id);
    if (delBtn) delBtn.onclick = () => deleteProfessor(p.id);
  });
}

function openProfessorForm(id) {
  if (id ? !hasPerm('professores', 'edit') : !hasPerm('professores', 'create')) return;
  const p = id ? byId(state.professores, id) : null;
  openModal(p ? 'Editar professor' : 'Novo professor', `
    <div class="form-grid">
      ${fotoFieldHtml(p?.foto)}
      <div class="field span-2"><label>Nome completo</label><input id="fNome" value="${esc(p?.nome || '')}"></div>
      <div class="field"><label>Email</label><input id="fEmail" type="email" value="${esc(p?.email || '')}"></div>
      <div class="field"><label>Telefone</label><input id="fTelefone" value="${esc(p?.telefone || '')}"></div>
      <div class="field"><label>Especialidade</label><input id="fEsp" value="${esc(p?.especialidade || '')}"></div>
      <div class="field"><label>Categoria Docente</label>
        <select id="fCategoriaDocente">
          <option value="">—</option>
          ${state.categoriasDocentes.slice().sort((a, b) => a.ordem - b.ordem).map(cd => `<option value="${cd.id}" ${p?.categoriaDocenteId === cd.id ? 'selected' : ''}>${esc(cd.nome)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Estado</label>
        <select id="fStatus">${['Ativo', 'Inativo'].map(s => `<option ${p?.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Guardar</button>
    </div>
  `, () => {
    const getFoto = wireFotoField(p?.foto);
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('btnSave').onclick = () => {
      const nome = document.getElementById('fNome').value.trim();
      if (!nome) { toast('Indique o nome do professor.'); return; }
      const payload = {
        nome,
        foto: getFoto(),
        email: document.getElementById('fEmail').value.trim(),
        telefone: document.getElementById('fTelefone').value.trim(),
        especialidade: document.getElementById('fEsp').value.trim(),
        categoriaDocenteId: document.getElementById('fCategoriaDocente').value || null,
        status: document.getElementById('fStatus').value,
      };
      const jaExistia = !!p;
      if (p) Object.assign(p, payload);
      else state.professores.push({ id: nextId('p'), ...payload });
      registrarLog(jaExistia ? 'Editar' : 'Criar', 'professores', `Professor ${jaExistia ? 'editado' : 'criado'}: ${payload.nome}`);
      saveState();
      closeModal();
      toast('Professor guardado.');
      renderProfessores();
    };
  });
}

function deleteProfessor(id) {
  if (!hasPerm('professores', 'delete')) return;
  const emUso = state.disciplinas.some(d => d.professorId === id);
  if (emUso && !confirm('Este professor está associado a disciplinas/turmas. Remover mesmo assim?')) return;
  const alvo = byId(state.professores, id);
  state.professores = state.professores.filter(p => p.id !== id);
  registrarLog('Remover', 'professores', `Professor removido: ${alvo?.nome || id}`);
  saveState();
  toast('Professor removido.');
  renderProfessores();
}

/* =============================== Inscrições (Exame de Ingresso) ================== */
/* Candidatura ao exame de ingresso. A admissão NÃO é decidida por candidato
   isolado — é um concurso: para cada grupo (curso + turno pretendido + ano
   letivo) há um número de vagas declarado pela Secretaria, e só o botão
   "Processar Admissões" decide quem entra, ordenando todos os candidatos
   avaliados desse grupo por nota (desempate por idade) e preenchendo as
   vagas disponíveis (vagas declaradas menos os já admitidos em rondas
   anteriores). O resultado exposto é sempre um de dois: "Admitido" (coube
   nas vagas, nota ≥ mínima e idade ≥ mínima) ou "Não Admitido" (nota
   insuficiente, idade insuficiente, ou passou mas não houve vaga). */

function calcularIdade(dataNascimento, referencia) {
  if (!dataNascimento) return null;
  const nasc = new Date(dataNascimento);
  const ref = new Date(referencia || hoje());
  let idade = ref.getFullYear() - nasc.getFullYear();
  const m = ref.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < nasc.getDate())) idade--;
  return idade;
}

function gerarNumeroAluno(cursoId, anoLetivo) {
  const c = byId(state.cursos, cursoId);
  const prefix = `${anoLetivo}-${cursoSigla(c)}-`;
  let max = 0;
  state.alunos.forEach(a => {
    if (a.numero && a.numero.startsWith(prefix)) {
      const n = parseInt(a.numero.slice(prefix.length), 10);
      if (!isNaN(n)) max = Math.max(max, n);
    }
  });
  return prefix + String(max + 1).padStart(3, '0');
}

function grupoCandidato(c) { return `${c.cursoPretendidoId}|${c.turnoPretendido}|${c.anoLetivo}`; }
function vagaFor(cursoId, turno, anoLetivo) {
  return state.vagas.find(v => v.cursoId === cursoId && v.turno === turno && v.anoLetivo === anoLetivo) || null;
}

function converterCandidatoEmAluno(cand) {
  const primeiroAno = state.anosEstudo.slice().sort((a, b) => a.ordem - b.ordem)[0];
  const aluno = {
    id: nextId('a'),
    numero: gerarNumeroAluno(cand.cursoPretendidoId, cand.anoLetivo),
    nome: cand.nome,
    email: cand.email,
    telefone: cand.telefone,
    cursoId: cand.cursoPretendidoId,
    anoCurricular: primeiroAno ? primeiroAno.id : null,
    ingresso: cand.anoLetivo,
    status: 'Ativo',
    generoId: cand.generoId ?? null,
    provinciaId: cand.provinciaId ?? null,
    municipioId: cand.municipioId ?? null,
    escolaProvenienciaId: cand.escolaProvenienciaId ?? null,
    cursoProvenienciaId: cand.cursoProvenienciaId ?? null,
    nacionalidadeId: cand.nacionalidadeId ?? null,
    numeroBI: cand.numeroBI ?? null,
    dataEmissaoBI: cand.dataEmissaoBI ?? null,
    nomePai: cand.nomePai ?? null,
    nomeMae: cand.nomeMae ?? null,
  };
  state.alunos.push(aluno);
  state.matriculas.push({ id: nextId('m'), alunoId: aluno.id, cursoId: cand.cursoPretendidoId, anoLetivo: cand.anoLetivo, data: hoje(), status: 'Ativa' });
  cand.alunoId = aluno.id;
}

/* Grava a nota sem decidir admissão — a decisão só acontece em processarAdmissoes. */
function salvarNotaCandidato(cand, notaRaw) {
  if (cand.alunoId) return; // já convertido, imutável
  cand.notaExame = notaRaw === '' || notaRaw === null || notaRaw === undefined ? null : Number(notaRaw);
  cand.status = present(cand.notaExame) ? 'Avaliado' : 'Inscrito';
}

/* Concurso por vagas: só mexe em candidatos SEM alunoId (já admitidos ficam
   intocáveis e apenas contam para reduzir as vagas disponíveis). */
function processarAdmissoes(cursoId, turno, anoLetivo) {
  const vaga = vagaFor(cursoId, turno, anoLetivo);
  const vagasDeclaradas = vaga ? vaga.quantidade : 0;
  const doGrupo = state.candidatos.filter(c => c.cursoPretendidoId === cursoId && c.turnoPretendido === turno && c.anoLetivo === anoLetivo);
  const jaAdmitidos = doGrupo.filter(c => c.alunoId).length;
  const vagasRestantes = Math.max(0, vagasDeclaradas - jaAdmitidos);

  const avaliaveis = doGrupo.filter(c => !c.alunoId && present(c.notaExame));
  const reprovados = avaliaveis.filter(c => Number(c.notaExame) < NOTA_MINIMA_ADMISSAO);
  const aprovadosNota = avaliaveis.filter(c => Number(c.notaExame) >= NOTA_MINIMA_ADMISSAO);
  const idadeInsuficiente = aprovadosNota.filter(c => (calcularIdade(c.dataNascimento) ?? 0) < IDADE_MINIMA_ADMISSAO);
  const elegiveis = aprovadosNota.filter(c => (calcularIdade(c.dataNascimento) ?? 0) >= IDADE_MINIMA_ADMISSAO);

  elegiveis.sort((a, b) => {
    if (Number(b.notaExame) !== Number(a.notaExame)) return Number(b.notaExame) - Number(a.notaExame);
    return (calcularIdade(b.dataNascimento) ?? 0) - (calcularIdade(a.dataNascimento) ?? 0); // empate: mais velho primeiro
  });

  const admitidosAgora = elegiveis.slice(0, vagasRestantes);
  // Fora das vagas, reprovado na nota ou abaixo da idade mínima — o resultado
  // exposto é sempre um dos dois: Admitido ou Não Admitido.
  const naoAdmitidos = [...elegiveis.slice(vagasRestantes), ...idadeInsuficiente, ...reprovados];

  admitidosAgora.forEach(converterCandidatoEmAluno);
  admitidosAgora.forEach(c => { c.status = 'Admitido'; });
  naoAdmitidos.forEach(c => { c.status = 'Não Admitido'; });

  registrarLog('Processar', 'inscricoes', `Admissões processadas — ${cursoNome(cursoId)} · ${periodoEstudoNome(turno)} · ${anoLetivoLabel(anoLetivo)}: ${admitidosAgora.length} admitido(s), ${naoAdmitidos.length} não admitido(s).`);

  return {
    vagasDeclaradas, jaAdmitidos, vagasRestantes,
    admitidos: admitidosAgora.length, naoAdmitidos: naoAdmitidos.length,
  };
}

function renderInscricoes(view) {
  if (view === 'lancamento') return renderInscricoesLancamento();
  return renderInscricoesLista();
}

const STATUS_CANDIDATO = ['Inscrito', 'Avaliado', 'Admitido', 'Não Admitido'];

function renderInscricoesLista(filter = {}) {
  const canCreate = hasPerm('inscricoes', 'create');
  const canEdit = hasPerm('inscricoes', 'edit');
  const canDelete = hasPerm('inscricoes', 'delete');
  const termo = (filter.q || '').toLowerCase();
  const cursoId = filter.curso || '';
  const status = filter.status || '';

  const rows = state.candidatos.filter(c => {
    if (termo && !(c.nome.toLowerCase().includes(termo) || c.numero.toLowerCase().includes(termo))) return false;
    if (cursoId && c.cursoPretendidoId !== cursoId) return false;
    if (status && c.status !== status) return false;
    return true;
  });
  const pendentes = state.candidatos.filter(c => c.status === 'Inscrito' && !present(c.notaExame)).length;
  const anoAtual = state.anoLetivo;
  const anoProximo = state.anoLetivo + 1;

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="panel">
        <h3>Calendário Académico</h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Ano Académico</th><th>Início</th><th>Fim</th><th>Candidaturas</th><th></th></tr></thead>
          <tbody>
            <tr>
              <td>${anoLetivoLabel(anoAtual)} <span class="text-muted" style="font-size:11.5px;">(em curso)</span></td>
              <td>${fmtDate(anoLetivoInicio(anoAtual))}</td>
              <td>${fmtDate(anoLetivoFim(anoAtual))}</td>
              <td>—</td>
              <td class="row-actions">${canEdit ? `<button class="btn btn-sm" data-editar-calendario="${anoAtual}">Editar datas</button>` : ''}</td>
            </tr>
            <tr>
              <td>${anoLetivoLabel(anoProximo)} <span class="text-muted" style="font-size:11.5px;">(próximo)</span></td>
              <td>${fmtDate(anoLetivoInicio(anoProximo))}</td>
              <td>${fmtDate(anoLetivoFim(anoProximo))}</td>
              <td>${state.candidatos.filter(c => c.anoLetivo === anoProximo).length} candidato(s)</td>
              <td class="row-actions">${canEdit ? `<button class="btn btn-sm" data-editar-calendario="${anoProximo}">Editar datas</button>` : ''}</td>
            </tr>
          </tbody>
        </table></div>
        ${canEdit ? `<div class="toolbar" style="margin-top:10px;"><button class="btn" id="btnAvancarAno">Avançar para o próximo ano letivo</button></div>` : ''}
      </div>

      <div class="toolbar">
        <input class="input" id="fltQCand" placeholder="Pesquisar nome ou nº de candidatura..." value="${esc(filter.q || '')}">
        <select class="input" id="fltCursoCand">
          <option value="">Todos os cursos</option>
          ${state.cursos.map(c => `<option value="${c.id}" ${c.id === cursoId ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
        </select>
        <select class="input" id="fltStatusCand">
          <option value="">Todos os estados</option>
          ${STATUS_CANDIDATO.map(s => `<option ${s === status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <div class="spacer"></div>
        <button class="btn" id="btnExportarCandidatos">Exportar Excel</button>
        ${canEdit ? `<button class="btn" id="btnLancarNotasExame">Lançar Notas / Processar Admissões${pendentes ? ` (${pendentes} por avaliar)` : ''}</button>` : ''}
        ${canCreate ? `<button class="btn btn-primary" id="btnNovoCandidato">+ Nova inscrição</button>` : ''}
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Nº Candidatura</th><th>Nome do Estudante</th><th>Curso Pretendido</th><th>Turno</th><th>Idade</th><th>Contacto</th><th>Nota Exame</th><th>Situação</th><th>Aluno gerado</th><th></th></tr></thead>
        <tbody>
          ${rows.length === 0 ? `<tr class="empty-row"><td colspan="10">Nenhuma inscrição encontrada.</td></tr>` : rows.map(c => `
            <tr>
              <td class="mono">${esc(c.numero)}</td>
              <td>${esc(c.nome)}</td>
              <td>${esc(cursoNome(c.cursoPretendidoId))}</td>
              <td>${esc(periodoEstudoNome(c.turnoPretendido))}</td>
              <td class="mono">${calcularIdade(c.dataNascimento) ?? '—'}</td>
              <td>${esc(c.telefone)}</td>
              <td class="mono">${c.notaExame ?? '—'}</td>
              <td>${statusBadge(c.status)}</td>
              <td>${c.alunoId ? esc(byId(state.alunos, c.alunoId)?.numero || '—') : '—'}</td>
              <td class="row-actions">
                ${canEdit ? `<button class="btn btn-sm" data-edit-cand="${c.id}">Editar</button>` : ''}
                ${canDelete ? `<button class="btn btn-sm btn-danger" data-del-cand="${c.id}">Remover</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table></div>
    </section>
  `;
  document.getElementById('fltQCand').oninput = e => renderInscricoesLista({ ...filter, q: e.target.value });
  document.getElementById('fltCursoCand').onchange = e => renderInscricoesLista({ ...filter, curso: e.target.value });
  document.getElementById('fltStatusCand').onchange = e => renderInscricoesLista({ ...filter, status: e.target.value });
  const btnNovo = document.getElementById('btnNovoCandidato');
  const btnLancar = document.getElementById('btnLancarNotasExame');
  if (btnNovo) btnNovo.onclick = () => openCandidatoForm();
  if (btnLancar) btnLancar.onclick = () => renderInscricoes('lancamento');
  document.getElementById('btnExportarCandidatos').onclick = () => exportarExcel('inscricoes', 'Inscrições', rows.map(c => ({
    'Nº Candidatura': c.numero, 'Nome': c.nome, 'Email': c.email, 'Telefone': c.telefone,
    'Data de Nascimento': fmtDate(c.dataNascimento), 'Idade': calcularIdade(c.dataNascimento) ?? '',
    'Género': generoNome(c.generoId), 'Nacionalidade': nacionalidadeNome(c.nacionalidadeId),
    'Naturalidade — Província': provinciaNome(c.provinciaId), 'Naturalidade — Município': municipioNome(c.municipioId),
    'Nº do BI': c.numeroBI || '', 'Data de Emissão do BI': c.dataEmissaoBI || '',
    'Nome do Pai': c.nomePai || '', 'Nome da Mãe': c.nomeMae || '',
    'Escola de Proveniência': escolaProvenienciaNome(c.escolaProvenienciaId), 'Curso de Proveniência': cursoProvenienciaNome(c.cursoProvenienciaId),
    'Curso Pretendido': cursoNome(c.cursoPretendidoId), 'Turno Pretendido': periodoEstudoNome(c.turnoPretendido),
    'Ano Letivo': anoLetivoLabel(c.anoLetivo), 'Data de Inscrição': fmtDate(c.dataInscricao),
    'Nota Exame': c.notaExame ?? '', 'Situação': c.status, 'Aluno Gerado': c.alunoId ? (byId(state.alunos, c.alunoId)?.numero || '') : '',
  })));
  [anoAtual, anoProximo].forEach(ano => {
    const btn = document.querySelector(`[data-editar-calendario="${ano}"]`);
    if (btn) btn.onclick = () => openCalendarioForm(ano);
  });
  const btnAvancar = document.getElementById('btnAvancarAno');
  if (btnAvancar) btnAvancar.onclick = () => {
    if (!confirm(`Avançar o ano letivo atual de ${anoLetivoLabel(anoAtual)} para ${anoLetivoLabel(anoProximo)}? Isto muda o valor por defeito usado em todo o sistema (Turmas, Matrículas, Financeiro, Notas, etc.) — os registos já existentes não são alterados.`)) return;
    state.anoLetivo = anoProximo;
    registrarLog('Editar', 'inscricoes', `Ano letivo avançado de ${anoLetivoLabel(anoAtual)} para ${anoLetivoLabel(anoProximo)}.`);
    saveState();
    toast(`Ano letivo avançado para ${anoLetivoLabel(anoProximo)}.`);
    renderInscricoesLista(filter);
  };
  rows.forEach(c => {
    const editBtn = document.querySelector(`[data-edit-cand="${c.id}"]`);
    const delBtn = document.querySelector(`[data-del-cand="${c.id}"]`);
    if (editBtn) editBtn.onclick = () => openCandidatoForm(c.id);
    if (delBtn) delBtn.onclick = () => deleteCandidato(c.id);
  });
}

function renderInscricoesLancamento(cursoId, turno) {
  cursoId = cursoId || state.cursos[0]?.id || '';
  turno = turno || state.periodosEstudo[0]?.id || '';
  const anoLetivo = state.anoLetivo + 1;
  const vaga = vagaFor(cursoId, turno, anoLetivo);
  const doGrupo = state.candidatos.filter(c => c.cursoPretendidoId === cursoId && c.turnoPretendido === turno && c.anoLetivo === anoLetivo);
  const jaAdmitidos = doGrupo.filter(c => c.alunoId).length;
  const editaveis = doGrupo.filter(c => !c.alunoId);
  const vagasRestantes = vaga ? Math.max(0, vaga.quantidade - jaAdmitidos) : null;

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="toolbar">
        <button class="btn" id="btnVoltarInscricoes">← Voltar à lista</button>
        <select class="input" id="fltCursoLancCand">
          ${state.cursos.map(c => `<option value="${c.id}" ${c.id === cursoId ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
        </select>
        <select class="input" id="fltTurnoLancCand">
          ${state.periodosEstudo.map(p => `<option value="${p.id}" ${p.id === turno ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
        </select>
      </div>

      <div class="panel">
        <h3>Vagas — ${esc(cursoNome(cursoId))} · ${esc(periodoEstudoNome(turno))} · ${anoLetivoLabel(anoLetivo)}</h3>
        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-label">Vagas Declaradas</div><div class="kpi-value">${vaga ? vaga.quantidade : '—'}</div></div>
          <div class="kpi-card"><div class="kpi-label">Já Admitidos</div><div class="kpi-value">${jaAdmitidos}</div></div>
          <div class="kpi-card accent-green"><div class="kpi-label">Vagas Restantes</div><div class="kpi-value">${vagasRestantes ?? '—'}</div></div>
        </div>
        <button class="btn btn-sm" id="btnEditarVaga">${vaga ? 'Editar vagas' : 'Declarar vagas'}</button>
      </div>

      ${!vaga ? lockedNote('Declare o número de vagas deste grupo antes de processar admissões.') : `
      <div class="panel">
        <h3>Lançar Notas do Exame de Ingresso</h3>
        <div class="panel-sub">Admissão mínima ${NOTA_MINIMA_ADMISSAO} valores e idade mínima ${IDADE_MINIMA_ADMISSAO} anos — a decisão final só acontece ao "Processar Admissões" (concurso por nota, desempate por idade, dentro das vagas restantes).</div>
        ${editaveis.length === 0 ? '<p class="text-muted">Não há candidatos neste grupo (curso + turno + ano letivo) por avaliar.</p>' : `
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Nº Candidatura</th><th>Nome do Estudante</th><th>Idade</th><th>Situação atual</th><th style="width:140px;">Nota (0–20)</th></tr></thead>
            <tbody>
              ${editaveis.map(c => `
                <tr>
                  <td class="mono">${esc(c.numero)}</td>
                  <td>${esc(c.nome)}</td>
                  <td class="mono">${calcularIdade(c.dataNascimento) ?? '—'}</td>
                  <td>${statusBadge(c.status)}</td>
                  <td><input class="input" type="number" min="0" max="20" step="0.5" data-nota-cand="${c.id}" value="${c.notaExame ?? ''}"></td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
          <div class="modal-footer" style="margin-top:14px;">
            <button class="btn" id="btnGravarNotasCand">Gravar notas</button>
            <button class="btn btn-primary" id="btnProcessarAdmissoes">Processar Admissões</button>
          </div>
        `}
      </div>`}
    </section>
  `;
  document.getElementById('btnVoltarInscricoes').onclick = () => renderInscricoes('lista');
  document.getElementById('fltCursoLancCand').onchange = e => renderInscricoesLancamento(e.target.value, turno);
  document.getElementById('fltTurnoLancCand').onchange = e => renderInscricoesLancamento(cursoId, e.target.value);
  document.getElementById('btnEditarVaga').onclick = () => openVagaForm(cursoId, turno, anoLetivo);

  function gravarNotas() {
    editaveis.forEach(c => {
      const input = document.querySelector(`[data-nota-cand="${c.id}"]`);
      if (input.value !== '' || present(c.notaExame)) salvarNotaCandidato(c, input.value);
    });
    registrarLog('Editar', 'inscricoes', `Notas do exame de ingresso lançadas — ${cursoNome(cursoId)} · ${periodoEstudoNome(turno)} · ${anoLetivoLabel(anoLetivo)}.`);
    saveState();
  }
  const btnGravar = document.getElementById('btnGravarNotasCand');
  if (btnGravar) btnGravar.onclick = () => {
    gravarNotas();
    toast('Notas guardadas.');
    renderInscricoesLancamento(cursoId, turno);
  };
  const btnProcessar = document.getElementById('btnProcessarAdmissoes');
  if (btnProcessar) btnProcessar.onclick = () => {
    gravarNotas();
    const r = processarAdmissoes(cursoId, turno, anoLetivo);
    saveState();
    toast(`${r.admitidos} admitido(s) · ${r.naoAdmitidos} não admitido(s).`);
    renderInscricoesLancamento(cursoId, turno);
  };
}

function openVagaForm(cursoId, turno, anoLetivo) {
  if (!hasPerm('inscricoes', 'edit') && !hasPerm('inscricoes', 'create')) return;
  const v = vagaFor(cursoId, turno, anoLetivo);
  openModal('Vagas de admissão', `
    <div class="form-grid">
      <div class="field"><label>Curso</label><input value="${esc(cursoNome(cursoId))}" disabled></div>
      <div class="field"><label>Turno</label><input value="${esc(periodoEstudoNome(turno))}" disabled></div>
      <div class="field span-2"><label>Ano letivo de ingresso</label><input value="${anoLetivoLabel(anoLetivo)}" disabled></div>
      <div class="field span-2"><label>Número de vagas</label><input id="fQtdVagas" type="number" min="0" value="${v?.quantidade ?? ''}"></div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Guardar</button>
    </div>
  `, () => {
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('btnSave').onclick = () => {
      const quantidade = Number(document.getElementById('fQtdVagas').value);
      if (isNaN(quantidade) || quantidade < 0) { toast('Indique um número de vagas válido.'); return; }
      if (v) v.quantidade = quantidade;
      else state.vagas.push({ id: nextId('vg'), cursoId, turno, anoLetivo, quantidade });
      registrarLog('Editar', 'inscricoes', `Vagas declaradas: ${cursoNome(cursoId)} · ${periodoEstudoNome(turno)} · ${anoLetivoLabel(anoLetivo)} = ${quantidade} vaga(s).`);
      saveState();
      closeModal();
      toast('Vagas guardadas.');
      renderInscricoesLancamento(cursoId, turno);
    };
  });
}

function openCalendarioForm(ano) {
  if (!hasPerm('inscricoes', 'edit')) return;
  const override = calendarioOverride(ano);
  openModal(`Ajustar Calendário — ${anoLetivoLabel(ano)}`, `
    <div class="form-grid">
      <div class="field"><label>Início</label><input id="fCalInicio" type="date" value="${anoLetivoInicio(ano)}"></div>
      <div class="field"><label>Fim</label><input id="fCalFim" type="date" value="${anoLetivoFim(ano)}"></div>
    </div>
    <p class="text-muted" style="font-size:12px;margin-top:8px;">Por defeito, o ano académico ${anoLetivoLabel(ano)} decorre de ${fmtDate(`${Number(ano) - 1}-08-01`)} a ${fmtDate(`${ano}-07-31`)}. Só precisa de ajustar aqui se este ciclo tiver uma exceção (ex.: início atrasado).</p>
    <div class="modal-footer">
      ${override ? `<button class="btn btn-danger" id="btnRestaurarCal">Repor datas padrão</button>` : ''}
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Guardar</button>
    </div>
  `, () => {
    document.getElementById('btnCancel').onclick = closeModal;
    const btnRestaurar = document.getElementById('btnRestaurarCal');
    if (btnRestaurar) btnRestaurar.onclick = () => {
      state.calendarioAcademico = state.calendarioAcademico.filter(c => c.ano !== Number(ano));
      registrarLog('Editar', 'inscricoes', `Calendário académico ${anoLetivoLabel(ano)} — datas padrão repostas.`);
      saveState();
      closeModal();
      toast('Datas padrão repostas.');
      renderInscricoesLista();
    };
    document.getElementById('btnSave').onclick = () => {
      const inicio = document.getElementById('fCalInicio').value;
      const fim = document.getElementById('fCalFim').value;
      if (!inicio || !fim || fim <= inicio) { toast('Indique um intervalo de datas válido.'); return; }
      if (override) { override.inicio = inicio; override.fim = fim; }
      else state.calendarioAcademico.push({ id: nextId('cal'), ano: Number(ano), inicio, fim });
      registrarLog('Editar', 'inscricoes', `Calendário académico ${anoLetivoLabel(ano)} ajustado: ${fmtDate(inicio)} a ${fmtDate(fim)}.`);
      saveState();
      closeModal();
      toast('Calendário atualizado.');
      renderInscricoesLista();
    };
  });
}

function openCandidatoForm(id) {
  if (id ? !hasPerm('inscricoes', 'edit') : !hasPerm('inscricoes', 'create')) return;
  const c = id ? byId(state.candidatos, id) : null;
  const jaConvertido = !!c?.alunoId;
  const idadeInicial = calcularIdade(c?.dataNascimento) ?? '';
  openModal(c ? 'Editar inscrição' : 'Nova inscrição', `
    <div class="form-grid">
      <div class="field span-2"><label>Nome completo</label><input id="fNome" value="${esc(c?.nome || '')}"></div>
      <div class="field"><label>Email</label><input id="fEmail" type="email" value="${esc(c?.email || '')}"></div>
      <div class="field"><label>Telefone</label><input id="fTelefone" value="${esc(c?.telefone || '')}"></div>
      <div class="field"><label>Data de nascimento</label><input id="fNascimento" type="date" value="${c?.dataNascimento || ''}" ${jaConvertido ? 'disabled' : ''}></div>
      <div class="field"><label>Idade</label><input id="fIdade" value="${idadeInicial}" disabled></div>
      <div class="field"><label>Género</label>
        <select id="fGenero"><option value="">—</option>${state.generos.map(g => `<option value="${g.id}" ${c?.generoId === g.id ? 'selected' : ''}>${esc(g.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Nacionalidade</label>
        <select id="fNacionalidade"><option value="">—</option>${state.nacionalidades.map(n => `<option value="${n.id}" ${c?.nacionalidadeId === n.id ? 'selected' : ''}>${esc(n.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Naturalidade — Província</label>
        <select id="fProvincia"><option value="">—</option>${state.provincias.map(p => `<option value="${p.id}" ${c?.provinciaId === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Naturalidade — Município</label>
        <select id="fMunicipio"></select>
      </div>
      <div class="field"><label>Número do BI</label><input id="fNumeroBI" value="${esc(c?.numeroBI || '')}"></div>
      <div class="field"><label>Data de Emissão do BI</label><input id="fDataEmissaoBI" type="date" value="${c?.dataEmissaoBI || ''}"></div>
      <div class="field"><label>Filiação — Nome do Pai</label><input id="fNomePai" value="${esc(c?.nomePai || '')}"></div>
      <div class="field"><label>Filiação — Nome da Mãe</label><input id="fNomeMae" value="${esc(c?.nomeMae || '')}"></div>
      <div class="field"><label>Escola de Proveniência</label>
        <select id="fEscolaProveniencia"><option value="">—</option>${state.escolasProveniencia.map(e => `<option value="${e.id}" ${c?.escolaProvenienciaId === e.id ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Curso de Proveniência</label>
        <select id="fCursoProveniencia"><option value="">—</option>${state.cursosProveniencia.map(cp => `<option value="${cp.id}" ${c?.cursoProvenienciaId === cp.id ? 'selected' : ''}>${esc(cp.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Curso pretendido</label>
        <select id="fCursoPretendido" ${jaConvertido ? 'disabled' : ''}>${state.cursos.map(cu => `<option value="${cu.id}" ${c?.cursoPretendidoId === cu.id ? 'selected' : ''}>${esc(cu.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Turno pretendido</label>
        <select id="fTurnoPretendido" ${jaConvertido ? 'disabled' : ''}>${state.periodosEstudo.map(p => `<option value="${p.id}" ${c?.turnoPretendido === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Ano letivo de ingresso</label><input id="fAnoLetivoCand" type="number" value="${c?.anoLetivo || state.anoLetivo + 1}" ${jaConvertido ? 'disabled' : ''}></div>
      <div class="field"><label>Data de inscrição</label><input id="fDataInscricao" type="date" value="${c?.dataInscricao || hoje()}"></div>
      <div class="field span-2"><label>Nota do exame (0–20)</label><input id="fNotaExame" type="number" min="0" max="20" step="0.5" value="${c?.notaExame ?? ''}" ${jaConvertido ? 'disabled' : ''}></div>
    </div>
    <p class="text-muted" style="font-size:12px;margin-top:8px;">Guardar a nota aqui não decide a admissão — isso só acontece em "Lançar Notas / Processar Admissões", porque depende das vagas e da concorrência com os outros candidatos do mesmo grupo.</p>
    ${jaConvertido ? lockedNote(`Este candidato já foi admitido e convertido no aluno ${esc(byId(state.alunos, c.alunoId)?.numero || '')} — os dados de admissão já não podem ser alterados aqui.`) : ''}
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Guardar</button>
    </div>
  `, () => {
    const fProvincia = document.getElementById('fProvincia');
    const fMunicipio = document.getElementById('fMunicipio');
    function refreshMunicipios() {
      const opcoes = state.municipios.filter(m => !fProvincia.value || m.provinciaId === fProvincia.value);
      fMunicipio.innerHTML = `<option value="">—</option>` + opcoes.map(m => `<option value="${m.id}" ${c?.municipioId === m.id ? 'selected' : ''}>${esc(m.nome)}</option>`).join('');
    }
    refreshMunicipios();
    fProvincia.onchange = refreshMunicipios;
    const fNascimento = document.getElementById('fNascimento');
    fNascimento.onchange = () => { document.getElementById('fIdade').value = calcularIdade(fNascimento.value) ?? ''; };
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('btnSave').onclick = () => {
      const nome = document.getElementById('fNome').value.trim();
      if (!nome) { toast('Indique o nome do candidato.'); return; }
      const payload = {
        nome,
        email: document.getElementById('fEmail').value.trim(),
        telefone: document.getElementById('fTelefone').value.trim(),
        dataInscricao: document.getElementById('fDataInscricao').value,
        generoId: document.getElementById('fGenero').value || null,
        nacionalidadeId: document.getElementById('fNacionalidade').value || null,
        provinciaId: fProvincia.value || null,
        municipioId: fMunicipio.value || null,
        numeroBI: document.getElementById('fNumeroBI').value.trim(),
        dataEmissaoBI: document.getElementById('fDataEmissaoBI').value,
        nomePai: document.getElementById('fNomePai').value.trim(),
        nomeMae: document.getElementById('fNomeMae').value.trim(),
        escolaProvenienciaId: document.getElementById('fEscolaProveniencia').value || null,
        cursoProvenienciaId: document.getElementById('fCursoProveniencia').value || null,
      };
      if (!jaConvertido) {
        payload.dataNascimento = fNascimento.value;
        payload.cursoPretendidoId = document.getElementById('fCursoPretendido').value;
        payload.turnoPretendido = document.getElementById('fTurnoPretendido').value;
        payload.anoLetivo = Number(document.getElementById('fAnoLetivoCand').value) || state.anoLetivo + 1;
      }
      const jaExistia = !!c;
      let candidato;
      if (c) { Object.assign(c, payload); candidato = c; }
      else {
        candidato = { id: nextId('cand'), numero: `${payload.anoLetivo}-CAND-${String(state.candidatos.length + 1).padStart(3, '0')}`, status: 'Inscrito', notaExame: null, alunoId: null, ...payload };
        state.candidatos.push(candidato);
      }
      if (!jaConvertido) salvarNotaCandidato(candidato, document.getElementById('fNotaExame').value);
      registrarLog(jaExistia ? 'Editar' : 'Criar', 'inscricoes', `Inscrição ${jaExistia ? 'editada' : 'criada'}: ${candidato.numero} — ${candidato.nome}`);
      saveState();
      closeModal();
      toast('Inscrição guardada.');
      renderInscricoesLista();
    };
  });
}

function deleteCandidato(id) {
  if (!hasPerm('inscricoes', 'delete')) return;
  const c = byId(state.candidatos, id);
  const msg = c?.alunoId
    ? `Este candidato já foi admitido (aluno ${byId(state.alunos, c.alunoId)?.numero || ''}). Remover só o registo da candidatura — o aluno matriculado não é afetado. Continuar?`
    : 'Remover esta inscrição?';
  if (!confirm(msg)) return;
  state.candidatos = state.candidatos.filter(c => c.id !== id);
  registrarLog('Remover', 'inscricoes', `Inscrição removida: ${c?.numero || id} — ${c?.nome || ''}`);
  saveState();
  toast('Inscrição removida.');
  renderInscricoesLista();
}

/* ============================ Cadastros (tabelas de apoio) ================== */
/* Módulo genérico de CRUD, orientado por CADASTRO_TIPOS — evita escrever 12
   pares render/form quase idênticos para Unidade Orgânica, Edifícios, Salas,
   Laboratórios, Província, Município, Escola de Proveniência, Género, Curso
   de Proveniência, Período de Estudo, Ano de Estudo e Horários. */

function renderCadastros(tipoKey) {
  const tipo = CADASTRO_TIPOS.find(t => t.key === tipoKey) || CADASTRO_TIPOS[0];
  const canCreate = hasPerm('cadastros', 'create');
  const canEdit = hasPerm('cadastros', 'edit');
  const canDelete = hasPerm('cadastros', 'delete');
  const rows = (state[tipo.key] || []).slice().sort((a, b) =>
    (a.ordem ?? 0) - (b.ordem ?? 0) || String(a.nome).localeCompare(String(b.nome)));

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="cadastro-tabs">
        ${CADASTRO_TIPOS.map(t => `<button class="chip-tab ${t.key === tipo.key ? 'active' : ''}" data-cadastro-tab="${t.key}">${esc(t.label)}</button>`).join('')}
      </div>
      <div class="toolbar">
        <h3 style="margin:0;">${esc(tipo.label)}</h3>
        <div class="spacer"></div>
        <button class="btn" id="btnExportarCadastro">Exportar Excel</button>
        ${canCreate ? `<button class="btn btn-primary" id="btnNovoCadastro">+ Novo registo</button>` : ''}
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr>${tipo.campos.map(c => `<th>${esc(c.label)}</th>`).join('')}<th></th></tr></thead>
        <tbody>
          ${rows.length === 0 ? `<tr class="empty-row"><td colspan="${tipo.campos.length + 1}">Nenhum registo cadastrado.</td></tr>` : rows.map(r => `
            <tr>
              ${tipo.campos.map(c => `<td>${esc(cadastroCellValue(c, r))}</td>`).join('')}
              <td class="row-actions">
                ${canEdit ? `<button class="btn btn-sm" data-edit-cadastro="${r.id}">Editar</button>` : ''}
                ${canDelete ? `<button class="btn btn-sm btn-danger" data-del-cadastro="${r.id}">Remover</button>` : ''}
              </td>
            </tr>`).join('')}
        </tbody>
      </table></div>
    </section>
  `;
  document.querySelectorAll('[data-cadastro-tab]').forEach(btn => {
    btn.onclick = () => renderCadastros(btn.dataset.cadastroTab);
  });
  const btnNovo = document.getElementById('btnNovoCadastro');
  if (btnNovo) btnNovo.onclick = () => openCadastroForm(tipo.key);
  document.getElementById('btnExportarCadastro').onclick = () => exportarExcel(
    `cadastro_${tipo.key}`,
    tipo.label,
    rows.map(r => {
      const linha = {};
      tipo.campos.forEach(c => { linha[c.label] = cadastroCellValue(c, r); });
      return linha;
    })
  );
  rows.forEach(r => {
    const editBtn = document.querySelector(`[data-edit-cadastro="${r.id}"]`);
    const delBtn = document.querySelector(`[data-del-cadastro="${r.id}"]`);
    if (editBtn) editBtn.onclick = () => openCadastroForm(tipo.key, r.id);
    if (delBtn) delBtn.onclick = () => deleteCadastro(tipo.key, r.id);
  });
}

function cadastroCellValue(campo, row) {
  const v = row[campo.key];
  if (campo.tipo === 'ref') return cadastroNome(campo.ref, v);
  if (v === null || v === undefined || v === '') return '—';
  return v;
}

function cadastroFieldHtml(campo, r) {
  const val = r ? r[campo.key] : '';
  if (campo.tipo === 'ref') {
    const options = (state[campo.ref] || []);
    return `<div class="field"><label>${esc(campo.label)}${campo.obrigatorio ? ' *' : ''}</label>
      <select id="f_${campo.key}">
        <option value="">—</option>
        ${options.map(o => `<option value="${o.id}" ${val === o.id ? 'selected' : ''}>${esc(o.nome)}</option>`).join('')}
      </select>
    </div>`;
  }
  const inputType = campo.tipo === 'number' ? 'number' : campo.tipo === 'time' ? 'time' : 'text';
  return `<div class="field"><label>${esc(campo.label)}${campo.obrigatorio ? ' *' : ''}</label>
    <input id="f_${campo.key}" type="${inputType}" value="${esc(val ?? '')}">
  </div>`;
}

function openCadastroForm(tipoKey, id) {
  if (id ? !hasPerm('cadastros', 'edit') : !hasPerm('cadastros', 'create')) return;
  const tipo = CADASTRO_TIPOS.find(t => t.key === tipoKey);
  const r = id ? byId(state[tipo.key], id) : null;
  openModal(id ? `Editar — ${tipo.label}` : `Novo — ${tipo.label}`, `
    <div class="form-grid">
      ${tipo.campos.map(c => cadastroFieldHtml(c, r)).join('')}
    </div>
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Guardar</button>
    </div>
  `, () => {
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('btnSave').onclick = () => {
      const payload = {};
      for (const c of tipo.campos) {
        const el = document.getElementById('f_' + c.key);
        let val = el.value;
        if (c.tipo === 'number') val = val === '' ? null : Number(val);
        else if (c.tipo === 'ref') val = val || null;
        else val = val.trim();
        if (c.obrigatorio && (val === '' || val === null || val === undefined)) {
          toast(`Preencha o campo obrigatório: ${c.label}`);
          return;
        }
        payload[c.key] = val;
      }
      const jaExistia = !!r;
      if (r) Object.assign(r, payload);
      else state[tipo.key].push({ id: nextId(tipo.prefixo), ...payload });
      registrarLog(jaExistia ? 'Editar' : 'Criar', 'cadastros', `${tipo.label} ${jaExistia ? 'editado' : 'criado'}: ${payload.nome || ''}`);
      saveState();
      closeModal();
      toast('Registo guardado.');
      renderCadastros(tipo.key);
    };
  });
}

function deleteCadastro(tipoKey, id) {
  if (!hasPerm('cadastros', 'delete')) return;
  const deps = CADASTRO_DEPENDENCIAS[tipoKey] || [];
  const emUso = deps.some(dep => {
    const tabela = state[dep.tabela] || [];
    return tabela.some(x => (dep.filtro ? dep.filtro(x) : true) && x[dep.campo] === id);
  });
  if (emUso && !confirm('Este registo está a ser usado noutros módulos (cursos, turmas, alunos, etc.). Remover mesmo assim?')) return;
  const tipo = CADASTRO_TIPOS.find(t => t.key === tipoKey);
  const alvo = byId(state[tipoKey], id);
  state[tipoKey] = state[tipoKey].filter(x => x.id !== id);
  registrarLog('Remover', 'cadastros', `${tipo?.label || tipoKey} removido: ${alvo?.nome || id}`);
  saveState();
  toast('Registo removido.');
  renderCadastros(tipoKey);
}

/* ================================== Cursos ================================= */

function renderCursos(filter = {}) {
  const canCreate = hasPerm('cursos', 'create');
  const canEdit = hasPerm('cursos', 'edit');
  const canDelete = hasPerm('cursos', 'delete');
  const term = (filter.q || '').toLowerCase();
  const rows = state.cursos.filter(c => !term || c.nome.toLowerCase().includes(term) || cursoSigla(c).toLowerCase().includes(term));

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="toolbar">
        <input class="input" id="fltQCurso" placeholder="Pesquisar curso ou sigla..." value="${esc(filter.q || '')}">
        <div class="spacer"></div>
        <button class="btn" id="btnExportarCursos">Exportar Excel</button>
        ${canCreate ? `<button class="btn btn-primary" id="btnNovoCurso">+ Novo curso</button>` : ''}
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Sigla</th><th>Curso</th><th>Unidade Orgânica</th><th>Grau</th><th>Duração</th><th>Coordenador</th><th>Alunos</th><th>Disciplinas</th><th></th></tr></thead>
        <tbody>
          ${rows.length === 0 ? `<tr class="empty-row"><td colspan="9">Nenhum curso encontrado.</td></tr>` : rows.map(c => {
            const nAlunos = state.alunos.filter(a => a.cursoId === c.id && a.status !== 'Desistente').length;
            const nDisc = state.disciplinas.filter(d => d.cursoId === c.id).length;
            return `
              <tr>
                <td class="mono">${esc(cursoSigla(c))}</td>
                <td>${esc(c.nome)}</td>
                <td>${esc(unidadeOrganicaNome(c.unidadeOrganicaId))}</td>
                <td>${esc(c.grau)}</td>
                <td>${c.duracaoAnos} anos</td>
                <td>${esc(c.coordenador)}</td>
                <td>${nAlunos}</td>
                <td>${nDisc}</td>
                <td class="row-actions">
                  ${canEdit ? `<button class="btn btn-sm" data-edit-curso="${c.id}">Editar</button>` : ''}
                  ${canDelete ? `<button class="btn btn-sm btn-danger" data-del-curso="${c.id}">Remover</button>` : ''}
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </section>
  `;
  document.getElementById('fltQCurso').oninput = e => renderCursos({ q: e.target.value });
  const btnNovo = document.getElementById('btnNovoCurso');
  if (btnNovo) btnNovo.onclick = () => openCursoForm();
  document.getElementById('btnExportarCursos').onclick = () => exportarExcel('cursos', 'Cursos', rows.map(c => ({
    'Sigla': cursoSigla(c), 'Curso': c.nome, 'Unidade Orgânica': unidadeOrganicaNome(c.unidadeOrganicaId),
    'Grau': c.grau, 'Duração (anos)': c.duracaoAnos, 'Coordenador': c.coordenador,
    'Alunos': state.alunos.filter(a => a.cursoId === c.id && a.status !== 'Desistente').length,
    'Disciplinas': state.disciplinas.filter(d => d.cursoId === c.id).length,
  })));
  rows.forEach(c => {
    const editBtn = document.querySelector(`[data-edit-curso="${c.id}"]`);
    const delBtn = document.querySelector(`[data-del-curso="${c.id}"]`);
    if (editBtn) editBtn.onclick = () => openCursoForm(c.id);
    if (delBtn) delBtn.onclick = () => deleteCurso(c.id);
  });
}

function openCursoForm(id) {
  if (id ? !hasPerm('cursos', 'edit') : !hasPerm('cursos', 'create')) return;
  const c = id ? byId(state.cursos, id) : null;
  openModal(c ? 'Editar curso' : 'Novo curso', `
    <div class="form-grid">
      <div class="field span-2"><label>Nome do curso</label><input id="fNome" value="${esc(c?.nome || '')}"></div>
      <div class="field"><label>Sigla (usada no código das turmas)</label><input id="fSigla" maxlength="4" style="text-transform:uppercase;" value="${esc(c?.sigla || '')}" placeholder="Ex.: EI"></div>
      <div class="field span-2"><label>Unidade Orgânica</label>
        <select id="fUnidadeOrganica">
          <option value="">—</option>
          ${state.unidadesOrganicas.map(u => `<option value="${u.id}" ${c?.unidadeOrganicaId === u.id ? 'selected' : ''}>${esc(u.nome)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Grau</label>
        <select id="fGrau">${['Técnico Superior', 'Licenciatura', 'Mestrado'].map(g => `<option ${c?.grau === g ? 'selected' : ''}>${g}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Duração (anos)</label><input id="fDuracao" type="number" min="1" max="6" value="${c?.duracaoAnos || 4}"></div>
      <div class="field span-2"><label>Coordenador</label><input id="fCoord" value="${esc(c?.coordenador || '')}"></div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Guardar</button>
    </div>
  `, () => {
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('btnSave').onclick = () => {
      const nome = document.getElementById('fNome').value.trim();
      if (!nome) { toast('Indique o nome do curso.'); return; }
      const payload = {
        nome,
        sigla: document.getElementById('fSigla').value.trim().toUpperCase() || null,
        unidadeOrganicaId: document.getElementById('fUnidadeOrganica').value || null,
        grau: document.getElementById('fGrau').value,
        duracaoAnos: Number(document.getElementById('fDuracao').value) || 4,
        coordenador: document.getElementById('fCoord').value.trim(),
      };
      const jaExistia = !!c;
      if (c) Object.assign(c, payload);
      else state.cursos.push({ id: nextId('c'), ...payload });
      registrarLog(jaExistia ? 'Editar' : 'Criar', 'cursos', `Curso ${jaExistia ? 'editado' : 'criado'}: ${payload.nome}`);
      saveState();
      closeModal();
      toast('Curso guardado.');
      renderCursos();
    };
  });
}

function deleteCurso(id) {
  if (!hasPerm('cursos', 'delete')) return;
  const emUso = state.alunos.some(a => a.cursoId === id) || state.disciplinas.some(d => d.cursoId === id);
  if (emUso && !confirm('Este curso tem alunos ou disciplinas associadas. Remover mesmo assim?')) return;
  const alvo = byId(state.cursos, id);
  state.cursos = state.cursos.filter(c => c.id !== id);
  registrarLog('Remover', 'cursos', `Curso removido: ${alvo?.nome || id}`);
  saveState();
  toast('Curso removido.');
  renderCursos();
}

/* ================================ Disciplinas =============================== */

function renderDisciplinas(filterCurso = '') {
  const canCreate = hasPerm('disciplinas', 'create');
  const canEdit = hasPerm('disciplinas', 'edit');
  const canDelete = hasPerm('disciplinas', 'delete');
  const rows = state.disciplinas.filter(d => !filterCurso || d.cursoId === filterCurso);

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="toolbar">
        <select class="input" id="fltCursoDisc">
          <option value="">Todos os cursos</option>
          ${state.cursos.map(c => `<option value="${c.id}" ${c.id === filterCurso ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
        </select>
        <div class="spacer"></div>
        <button class="btn" id="btnExportarDisciplinas">Exportar Excel</button>
        ${canCreate ? `<button class="btn btn-primary" id="btnNovaDisciplina">+ Nova disciplina</button>` : ''}
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Disciplina</th><th>Curso</th><th>Ano/Sem.</th><th>Carga horária</th><th>Professor</th><th></th></tr></thead>
        <tbody>
          ${rows.length === 0 ? `<tr class="empty-row"><td colspan="6">Nenhuma disciplina encontrada.</td></tr>` : rows.map(d => `
            <tr>
              <td>${esc(d.nome)}</td>
              <td>${esc(cursoNome(d.cursoId))}</td>
              <td>${esc(anoEstudoNome(d.ano))} / ${d.semestre}º sem.</td>
              <td>${d.cargaHoraria}h</td>
              <td>${esc(professorNome(d.professorId))}</td>
              <td class="row-actions">
                ${canEdit ? `<button class="btn btn-sm" data-edit-disc="${d.id}">Editar</button>` : ''}
                ${canDelete ? `<button class="btn btn-sm btn-danger" data-del-disc="${d.id}">Remover</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table></div>
    </section>
  `;
  document.getElementById('fltCursoDisc').onchange = e => renderDisciplinas(e.target.value);
  const btnNova = document.getElementById('btnNovaDisciplina');
  if (btnNova) btnNova.onclick = () => openDisciplinaForm();
  document.getElementById('btnExportarDisciplinas').onclick = () => exportarExcel('disciplinas', 'Disciplinas', rows.map(d => ({
    'Disciplina': d.nome, 'Curso': cursoNome(d.cursoId), 'Ano': anoEstudoNome(d.ano), 'Semestre': d.semestre,
    'Carga Horária (h)': d.cargaHoraria, 'Professor': professorNome(d.professorId),
  })));
  rows.forEach(d => {
    const editBtn = document.querySelector(`[data-edit-disc="${d.id}"]`);
    const delBtn = document.querySelector(`[data-del-disc="${d.id}"]`);
    if (editBtn) editBtn.onclick = () => openDisciplinaForm(d.id);
    if (delBtn) delBtn.onclick = () => deleteDisciplina(d.id);
  });
}

function openDisciplinaForm(id) {
  if (id ? !hasPerm('disciplinas', 'edit') : !hasPerm('disciplinas', 'create')) return;
  const d = id ? byId(state.disciplinas, id) : null;
  openModal(d ? 'Editar disciplina' : 'Nova disciplina', `
    <div class="form-grid">
      <div class="field span-2"><label>Nome da disciplina</label><input id="fNome" value="${esc(d?.nome || '')}"></div>
      <div class="field"><label>Curso</label>
        <select id="fCurso">${state.cursos.map(c => `<option value="${c.id}" ${d?.cursoId === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Professor</label>
        <select id="fProf">${state.professores.map(p => `<option value="${p.id}" ${d?.professorId === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Ano curricular</label>
        <select id="fAno">${state.anosEstudo.slice().sort((a, b) => a.ordem - b.ordem).map(a => `<option value="${a.id}" ${d?.ano === a.id ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Semestre</label>
        <select id="fSem">${[1, 2].map(n => `<option value="${n}" ${d?.semestre === n ? 'selected' : ''}>${n}º semestre</option>`).join('')}</select>
      </div>
      <div class="field span-2"><label>Carga horária (horas)</label><input id="fCarga" type="number" min="10" value="${d?.cargaHoraria || 60}"></div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Guardar</button>
    </div>
  `, () => {
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('btnSave').onclick = () => {
      const nome = document.getElementById('fNome').value.trim();
      if (!nome) { toast('Indique o nome da disciplina.'); return; }
      const payload = {
        nome,
        cursoId: document.getElementById('fCurso').value,
        professorId: document.getElementById('fProf').value,
        ano: document.getElementById('fAno').value,
        semestre: Number(document.getElementById('fSem').value),
        cargaHoraria: Number(document.getElementById('fCarga').value) || 60,
      };
      const jaExistia = !!d;
      if (d) Object.assign(d, payload);
      else state.disciplinas.push({ id: nextId('d'), ...payload });
      registrarLog(jaExistia ? 'Editar' : 'Criar', 'disciplinas', `Disciplina ${jaExistia ? 'editada' : 'criada'}: ${payload.nome}`);
      saveState();
      closeModal();
      toast('Disciplina guardada.');
      renderDisciplinas();
    };
  });
}

function deleteDisciplina(id) {
  if (!hasPerm('disciplinas', 'delete')) return;
  const emUso = state.aulas.some(a => a.disciplinaId === id) || state.notas.some(n => n.disciplinaId === id);
  if (emUso && !confirm('Esta disciplina tem aulas ou notas associadas. Remover mesmo assim?')) return;
  const alvo = byId(state.disciplinas, id);
  const aulasDaDisciplina = state.aulas.filter(a => a.disciplinaId === id).map(a => a.id);
  state.disciplinas = state.disciplinas.filter(d => d.id !== id);
  state.aulas = state.aulas.filter(a => a.disciplinaId !== id);
  state.notas = state.notas.filter(n => n.disciplinaId !== id);
  state.periodos = state.periodos.filter(p => !aulasDaDisciplina.includes(p.aulaId));
  state.submissoes = state.submissoes.filter(s => !aulasDaDisciplina.includes(s.aulaId));
  state.reaberturas = state.reaberturas.filter(r => !aulasDaDisciplina.includes(r.aulaId));
  state.frequencia = state.frequencia.filter(f => !aulasDaDisciplina.includes(f.aulaId));
  registrarLog('Remover', 'disciplinas', `Disciplina removida: ${alvo?.nome || id}`);
  saveState();
  toast('Disciplina removida.');
  renderDisciplinas();
}

/* ============================== Turmas / Horários ============================ */

/* Turmas & Horários divide-se em duas abas: "Turmas" (CRUD da coorte) e
   "Aulas" (CRUD da relação turma+disciplina+professor+horário). */
function renderTurmas(filter = {}) {
  const tab = filter.tab || 'turmas';
  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="tabs" id="turmasTabs">
        <button class="tab-btn ${tab === 'turmas' ? 'active' : ''}" data-tab="turmas">Turmas</button>
        <button class="tab-btn ${tab === 'aulas' ? 'active' : ''}" data-tab="aulas">Aulas</button>
      </div>
      <div id="turmasTabBody"></div>
    </section>
  `;
  document.querySelectorAll('#turmasTabs [data-tab]').forEach(btn => {
    btn.onclick = () => renderTurmas({ tab: btn.dataset.tab });
  });
  if (tab === 'aulas') renderAulasTab(filter);
  else renderTurmasTab(filter);
}

function renderTurmasTab(filter = {}) {
  const canCreate = hasPerm('turmas', 'create');
  const canEdit = hasPerm('turmas', 'edit');
  const canDelete = hasPerm('turmas', 'delete');
  const cursoId = filter.curso || '';
  const ano = filter.ano || '';
  const turno = filter.turno || '';
  const regime = filter.regime || '';

  const turmas = state.turmas.filter(t => {
    if (cursoId && t.cursoId !== cursoId) return false;
    if (ano && t.anoEstudo !== ano) return false;
    if (turno && t.turno !== turno) return false;
    if (regime && t.regime !== regime) return false;
    return true;
  });

  document.getElementById('turmasTabBody').innerHTML = `
    <div class="toolbar">
      <select class="input" id="fltCursoTurma">
        <option value="">Todos os cursos</option>
        ${state.cursos.map(c => `<option value="${c.id}" ${c.id === cursoId ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
      </select>
      <select class="input" id="fltAnoTurma">
        <option value="">Todos os anos</option>
        ${state.anosEstudo.slice().sort((a, b) => a.ordem - b.ordem).map(a => `<option value="${a.id}" ${a.id === ano ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}
      </select>
      <select class="input" id="fltTurnoTurma">
        <option value="">Todos os períodos</option>
        ${state.periodosEstudo.map(p => `<option value="${p.id}" ${p.id === turno ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
      </select>
      <select class="input" id="fltRegimeTurma">
        <option value="">Todos os regimes</option>
        ${REGIMES.map(r => `<option ${r === regime ? 'selected' : ''}>${r}</option>`).join('')}
      </select>
      <div class="spacer"></div>
      <button class="btn" id="btnExportarTurmas">Exportar Excel</button>
      ${canCreate ? `<button class="btn btn-primary" id="btnNovaTurma">+ Nova turma</button>` : ''}
    </div>

    <div class="table-wrap"><table class="data">
      <thead><tr><th>Código</th><th>Curso</th><th>Ano</th><th>Turno / Regime</th><th>Vagas</th><th>Aulas</th><th>Alunos</th><th></th></tr></thead>
      <tbody>
        ${turmas.length === 0 ? `<tr class="empty-row"><td colspan="8">Nenhuma turma encontrada.</td></tr>` : turmas.map(t => {
          const numAulas = state.aulas.filter(a => a.turmaId === t.id).length;
          const numAlunos = turmaRoster(t.id).length;
          return `
            <tr>
              <td class="mono">${esc(turmaCodigo(t))}</td>
              <td>${esc(cursoNome(t.cursoId))}</td>
              <td>${esc(anoEstudoNome(t.anoEstudo))}</td>
              <td>${esc(periodoEstudoNome(t.turno))} · ${esc(t.regime)}</td>
              <td class="mono">${t.vagas}</td>
              <td class="mono">${numAulas}</td>
              <td class="mono">${numAlunos}</td>
              <td class="row-actions">
                ${canEdit ? `<button class="btn btn-sm" data-edit-turma="${t.id}">Editar</button>` : ''}
                ${canDelete ? `<button class="btn btn-sm btn-danger" data-del-turma="${t.id}">Remover</button>` : ''}
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table></div>
  `;
  document.getElementById('fltCursoTurma').onchange = e => renderTurmas({ tab: 'turmas', ...filter, curso: e.target.value });
  document.getElementById('fltAnoTurma').onchange = e => renderTurmas({ tab: 'turmas', ...filter, ano: e.target.value });
  document.getElementById('fltTurnoTurma').onchange = e => renderTurmas({ tab: 'turmas', ...filter, turno: e.target.value });
  document.getElementById('fltRegimeTurma').onchange = e => renderTurmas({ tab: 'turmas', ...filter, regime: e.target.value });
  const btnNova = document.getElementById('btnNovaTurma');
  if (btnNova) btnNova.onclick = () => openTurmaForm();
  document.getElementById('btnExportarTurmas').onclick = () => exportarExcel('turmas', 'Turmas', turmas.map(t => ({
    'Código': turmaCodigo(t), 'Curso': cursoNome(t.cursoId), 'Ano': anoEstudoNome(t.anoEstudo),
    'Turno': periodoEstudoNome(t.turno), 'Regime': t.regime, 'Vagas': t.vagas,
  })));
  turmas.forEach(t => {
    const editBtn = document.querySelector(`[data-edit-turma="${t.id}"]`);
    const delBtn = document.querySelector(`[data-del-turma="${t.id}"]`);
    if (editBtn) editBtn.onclick = () => openTurmaForm(t.id);
    if (delBtn) delBtn.onclick = () => deleteTurma(t.id);
  });
}

function renderAulasTab(filter = {}) {
  const canCreate = hasPerm('turmas', 'create');
  const canEdit = hasPerm('turmas', 'edit');
  const canDelete = hasPerm('turmas', 'delete');
  const term = (filter.q || '').toLowerCase();
  const cursoId = filter.curso || '';
  const ano = filter.ano || '';

  const aulas = state.aulas.filter(a => {
    const turma = byId(state.turmas, a.turmaId);
    if (term && !(disciplinaNome(a.disciplinaId).toLowerCase().includes(term) || turmaCodigo(turma).toLowerCase().includes(term) || professorNome(a.professorId).toLowerCase().includes(term))) return false;
    if (cursoId && turma?.cursoId !== cursoId) return false;
    if (ano && turma?.anoEstudo !== ano) return false;
    return true;
  });

  document.getElementById('turmasTabBody').innerHTML = `
    <div class="toolbar">
      <input class="input" id="fltQAula" placeholder="Pesquisar turma, disciplina ou professor..." value="${esc(filter.q || '')}">
      <select class="input" id="fltCursoAula">
        <option value="">Todos os cursos</option>
        ${state.cursos.map(c => `<option value="${c.id}" ${c.id === cursoId ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
      </select>
      <select class="input" id="fltAnoAula">
        <option value="">Todos os anos</option>
        ${state.anosEstudo.slice().sort((a, b) => a.ordem - b.ordem).map(a => `<option value="${a.id}" ${a.id === ano ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}
      </select>
      <div class="spacer"></div>
      <button class="btn" id="btnExportarAulas">Exportar Excel</button>
      ${canCreate ? `<button class="btn btn-primary" id="btnNovaAula">+ Nova aula</button>` : ''}
    </div>

    <div class="panel">
      <h3>Mapa semanal de horários</h3>
      <div class="panel-sub">Ano letivo ${anoLetivoLabel(state.anoLetivo)} · ${aulas.length} aula(s) encontrada(s)</div>
      <div class="table-wrap" style="overflow-x:auto; border:none; box-shadow:none;">
        ${renderScheduleGrid(aulas)}
      </div>
    </div>

    <div class="table-wrap"><table class="data">
      <thead><tr><th>Turma</th><th>Disciplina</th><th>Curso</th><th>Professor</th><th>Dia / Hora</th><th>Local</th><th></th></tr></thead>
      <tbody>
        ${aulas.length === 0 ? `<tr class="empty-row"><td colspan="7">Nenhuma aula encontrada.</td></tr>` : aulas.map(a => {
          const turma = byId(state.turmas, a.turmaId);
          return `
            <tr>
              <td class="mono">${esc(turmaCodigo(turma))}</td>
              <td>${esc(disciplinaNome(a.disciplinaId))}</td>
              <td>${esc(cursoNome(turma?.cursoId))}</td>
              <td>${esc(professorNome(a.professorId))}</td>
              <td>${DIAS[a.dia]}, ${esc(horarioLabel(a.hora))}</td>
              <td>${esc(localTurmaLabel(a))}</td>
              <td class="row-actions">
                ${canEdit ? `<button class="btn btn-sm" data-edit-aula="${a.id}">Editar</button>` : ''}
                ${canDelete ? `<button class="btn btn-sm btn-danger" data-del-aula="${a.id}">Remover</button>` : ''}
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table></div>
  `;
  document.getElementById('fltQAula').oninput = e => renderTurmas({ tab: 'aulas', ...filter, q: e.target.value });
  document.getElementById('fltCursoAula').onchange = e => renderTurmas({ tab: 'aulas', ...filter, curso: e.target.value });
  document.getElementById('fltAnoAula').onchange = e => renderTurmas({ tab: 'aulas', ...filter, ano: e.target.value });
  const btnNova = document.getElementById('btnNovaAula');
  if (btnNova) btnNova.onclick = () => openAulaForm();
  document.getElementById('btnExportarAulas').onclick = () => exportarExcel('aulas', 'Aulas', aulas.map(a => {
    const turma = byId(state.turmas, a.turmaId);
    return {
      'Turma': turmaCodigo(turma), 'Disciplina': disciplinaNome(a.disciplinaId), 'Curso': cursoNome(turma?.cursoId),
      'Professor': professorNome(a.professorId), 'Dia': DIAS[a.dia], 'Horário': horarioLabel(a.hora), 'Local': localTurmaLabel(a),
    };
  }));
  aulas.forEach(a => {
    const editBtn = document.querySelector(`[data-edit-aula="${a.id}"]`);
    const delBtn = document.querySelector(`[data-del-aula="${a.id}"]`);
    if (editBtn) editBtn.onclick = () => openAulaForm(a.id);
    if (delBtn) delBtn.onclick = () => deleteAula(a.id);
  });
}

function renderScheduleGrid(aulas) {
  const horarios = state.horarios.slice().sort((a, b) => a.inicio.localeCompare(b.inicio));
  let html = `<div class="schedule-grid">
    <div class="head-cell"></div>
    ${DIAS.map(d => `<div class="head-cell">${d}</div>`).join('')}`;
  horarios.forEach(h => {
    html += `<div class="time-cell">${esc(h.nome)}<br><span class="text-muted" style="font-size:11px;">${h.inicio}–${h.fim}</span></div>`;
    DIAS.forEach((_, dayIdx) => {
      const a = aulas.find(a => a.dia === dayIdx && a.hora === h.id);
      if (a) {
        html += `<div class="schedule-slot filled">
          <strong>[${esc(turmaCodigo(byId(state.turmas, a.turmaId)))}] ${esc(disciplinaNome(a.disciplinaId))}</strong>
          <span>${esc(localTurmaLabel(a))} · ${esc(professorNome(a.professorId))}</span>
        </div>`;
      } else {
        html += `<div class="schedule-slot"></div>`;
      }
    });
  });
  html += `</div>`;
  return html;
}

function openTurmaForm(id) {
  if (id ? !hasPerm('turmas', 'edit') : !hasPerm('turmas', 'create')) return;
  const t = id ? byId(state.turmas, id) : null;
  openModal(t ? 'Editar turma' : 'Nova turma', `
    <div class="form-grid">
      <div class="field span-2"><label>Curso</label>
        <select id="fCursoT">${state.cursos.map(c => `<option value="${c.id}" ${t?.cursoId === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Ano de Estudo</label>
        <select id="fAnoT">${state.anosEstudo.slice().sort((a, b) => a.ordem - b.ordem).map(a => `<option value="${a.id}" ${t?.anoEstudo === a.id ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Ano letivo</label><input id="fAnoLetivoT" type="number" value="${t?.anoLetivo || state.anoLetivo}"></div>
      <div class="field"><label>Turno</label>
        <select id="fTurnoT">${state.periodosEstudo.map(p => `<option value="${p.id}" ${t?.turno === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Regime</label>
        <select id="fRegimeT">${REGIMES.map(r => `<option ${t?.regime === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Vagas</label><input id="fVagasT" type="number" min="1" value="${t?.vagas || 30}"></div>
    </div>
    <p class="text-muted" style="font-size:12px;margin-top:8px;">Código gerado automaticamente a partir do curso, ano, turno e regime (ex.: EI2-MR).</p>
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Guardar</button>
    </div>
  `, () => {
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('btnSave').onclick = () => {
      const payload = {
        cursoId: document.getElementById('fCursoT').value,
        anoEstudo: document.getElementById('fAnoT').value,
        anoLetivo: Number(document.getElementById('fAnoLetivoT').value) || state.anoLetivo,
        turno: document.getElementById('fTurnoT').value,
        regime: document.getElementById('fRegimeT').value,
        vagas: Number(document.getElementById('fVagasT').value) || 30,
      };
      const duplicada = state.turmas.find(x => x.id !== id && x.cursoId === payload.cursoId && x.anoEstudo === payload.anoEstudo && x.turno === payload.turno && x.regime === payload.regime);
      if (duplicada) { toast('Já existe uma turma para este curso, ano, turno e regime.'); return; }
      const jaExistia = !!t;
      let registo = t;
      if (t) Object.assign(t, payload);
      else { registo = { id: nextId('t'), ...payload }; state.turmas.push(registo); }
      registrarLog(jaExistia ? 'Editar' : 'Criar', 'turmas', `Turma ${jaExistia ? 'editada' : 'criada'}: ${turmaCodigo(registo)}`);
      saveState();
      closeModal();
      toast('Turma guardada.');
      renderTurmas({ tab: 'turmas' });
    };
  });
}

function deleteTurma(id) {
  if (!hasPerm('turmas', 'delete')) return;
  const matriculasAtivas = state.matriculas.filter(m => m.turmaId === id && m.status === 'Ativa');
  if (matriculasAtivas.length > 0) { toast(`Não é possível remover: há ${matriculasAtivas.length} aluno(s) com matrícula ativa nesta turma.`); return; }
  if (!confirm('Remover esta turma? As aulas associadas e os respetivos lançamentos (notas, períodos, frequência, trabalhos) também serão eliminados.')) return;
  const alvo = byId(state.turmas, id);
  const codigo = alvo ? turmaCodigo(alvo) : id;
  const aulasDaTurma = state.aulas.filter(a => a.turmaId === id).map(a => a.id);
  const trabalhosDaTurma = state.trabalhos.filter(tb => tb.turmaId === id).map(tb => tb.id);
  state.turmas = state.turmas.filter(t => t.id !== id);
  state.aulas = state.aulas.filter(a => a.turmaId !== id);
  state.notas = state.notas.filter(n => !aulasDaTurma.includes(n.aulaId));
  state.periodos = state.periodos.filter(p => !aulasDaTurma.includes(p.aulaId));
  state.submissoes = state.submissoes.filter(s => !aulasDaTurma.includes(s.aulaId));
  state.reaberturas = state.reaberturas.filter(r => !aulasDaTurma.includes(r.aulaId));
  state.frequencia = state.frequencia.filter(f => !aulasDaTurma.includes(f.aulaId));
  state.trabalhos = state.trabalhos.filter(tb => tb.turmaId !== id);
  state.trabalhoIntegrantes = state.trabalhoIntegrantes.filter(ti => !trabalhosDaTurma.includes(ti.trabalhoId));
  state.trabalhoFicheiros = state.trabalhoFicheiros.filter(tf => !trabalhosDaTurma.includes(tf.trabalhoId));
  registrarLog('Remover', 'turmas', `Turma removida: ${codigo}`);
  saveState();
  toast('Turma removida.');
  renderTurmas({ tab: 'turmas' });
}

function openAulaForm(id) {
  if (id ? !hasPerm('turmas', 'edit') : !hasPerm('turmas', 'create')) return;
  const a = id ? byId(state.aulas, id) : null;
  if (!state.turmas.length) { toast('Cadastre pelo menos uma turma antes de criar aulas.'); return; }
  const localTipo = a?.localTipo || 'Sala';
  openModal(a ? 'Editar aula' : 'Nova aula', `
    <div class="form-grid">
      <div class="field span-2"><label>Turma</label>
        <select id="fTurmaA">${state.turmas.map(t => `<option value="${t.id}" ${a?.turmaId === t.id ? 'selected' : ''}>[${esc(turmaCodigo(t))}] ${esc(cursoNome(t.cursoId))}</option>`).join('')}</select>
      </div>
      <div class="field span-2"><label>Disciplina</label>
        <select id="fDisc">${state.disciplinas.map(d => `<option value="${d.id}" ${a?.disciplinaId === d.id ? 'selected' : ''}>${esc(d.nome)} (${esc(cursoNome(d.cursoId))})</option>`).join('')}</select>
      </div>
      <div class="field"><label>Professor</label>
        <select id="fProf">${state.professores.map(p => `<option value="${p.id}" ${a?.professorId === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Tipo de local</label>
        <select id="fLocalTipo">
          <option value="Sala" ${localTipo === 'Sala' ? 'selected' : ''}>Sala</option>
          <option value="Laboratorio" ${localTipo === 'Laboratorio' ? 'selected' : ''}>Laboratório</option>
        </select>
      </div>
      <div class="field"><label>Local</label>
        <select id="fLocalId"></select>
      </div>
      <div class="field"><label>Dia da semana</label>
        <select id="fDia">${DIAS.map((d, i) => `<option value="${i}" ${a?.dia === i ? 'selected' : ''}>${d}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Horário (tempo letivo)</label>
        <select id="fHora">${state.horarios.slice().sort((x, y) => x.inicio.localeCompare(y.inicio)).map(h => `<option value="${h.id}" ${a?.hora === h.id ? 'selected' : ''}>${esc(h.nome)} (${h.inicio}–${h.fim})</option>`).join('')}</select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Guardar</button>
    </div>
  `, () => {
    const fLocalTipo = document.getElementById('fLocalTipo');
    const fLocalId = document.getElementById('fLocalId');
    function refreshLocais() {
      const tabela = fLocalTipo.value === 'Laboratorio' ? state.laboratorios : state.salas;
      fLocalId.innerHTML = tabela.map(l => `<option value="${l.id}" ${a?.localId === l.id ? 'selected' : ''}>${esc(l.nome)}</option>`).join('');
    }
    refreshLocais();
    fLocalTipo.onchange = refreshLocais;
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('btnSave').onclick = () => {
      const payload = {
        turmaId: document.getElementById('fTurmaA').value,
        disciplinaId: document.getElementById('fDisc').value,
        professorId: document.getElementById('fProf').value,
        localTipo: fLocalTipo.value,
        localId: fLocalId.value,
        dia: Number(document.getElementById('fDia').value),
        hora: document.getElementById('fHora').value,
      };
      if (!payload.localId) { toast('Cadastre pelo menos uma sala ou laboratório antes de criar aulas.'); return; }
      const clash = state.aulas.find(x => x.id !== id && x.localTipo === payload.localTipo && x.localId === payload.localId && x.dia === payload.dia && x.hora === payload.hora);
      if (clash) { toast('Conflito: já existe uma aula nesse local, dia e hora.'); return; }
      const jaExistia = !!a;
      let registo = a;
      if (a) Object.assign(a, payload);
      else { registo = { id: nextId('au'), ...payload }; state.aulas.push(registo); }
      registrarLog(jaExistia ? 'Editar' : 'Criar', 'turmas', `Aula ${jaExistia ? 'editada' : 'criada'}: ${disciplinaNome(registo.disciplinaId)} — ${turmaCodigo(byId(state.turmas, registo.turmaId))}`);
      saveState();
      closeModal();
      toast('Aula guardada.');
      renderTurmas({ tab: 'aulas' });
    };
  });
}

function deleteAula(id) {
  if (!hasPerm('turmas', 'delete')) return;
  if (!confirm('Remover esta aula? Notas, períodos e chamadas de frequência lançados para esta aula também serão eliminados.')) return;
  const alvo = byId(state.aulas, id);
  const label = alvo ? `${disciplinaNome(alvo.disciplinaId)} — ${turmaCodigo(byId(state.turmas, alvo.turmaId))}` : id;
  state.aulas = state.aulas.filter(a => a.id !== id);
  state.notas = state.notas.filter(n => n.aulaId !== id);
  state.periodos = state.periodos.filter(p => p.aulaId !== id);
  state.submissoes = state.submissoes.filter(s => s.aulaId !== id);
  state.reaberturas = state.reaberturas.filter(r => r.aulaId !== id);
  state.frequencia = state.frequencia.filter(f => f.aulaId !== id);
  registrarLog('Remover', 'turmas', `Aula removida: ${label}`);
  saveState();
  toast('Aula removida.');
  renderTurmas({ tab: 'aulas' });
}

/* ================================= Matrículas ================================ */

function renderMatriculas() {
  const canCreate = hasPerm('matriculas', 'create');
  const canEdit = hasPerm('matriculas', 'edit');
  const canDelete = hasPerm('matriculas', 'delete');

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn" id="btnExportarMatriculas">Exportar Excel</button>
        ${canCreate ? `<button class="btn btn-primary" id="btnNovaMatricula">+ Nova matrícula</button>` : ''}
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Aluno</th><th>Curso</th><th>Turma</th><th>Ano letivo</th><th>Data</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${state.matriculas.length === 0 ? `<tr class="empty-row"><td colspan="7">Nenhuma matrícula registada.</td></tr>` : state.matriculas.map(m => `
            <tr>
              <td>${esc(alunoNome(m.alunoId))}</td>
              <td>${esc(cursoNome(m.cursoId))}</td>
              <td class="mono">${esc(turmaCodigo(byId(state.turmas, m.turmaId)))}</td>
              <td>${anoLetivoLabel(m.anoLetivo)}</td>
              <td>${fmtDate(m.data)}</td>
              <td>${statusBadge(m.status)}</td>
              <td class="row-actions">
                ${canEdit ? `<button class="btn btn-sm" data-edit-mat="${m.id}">Editar</button>` : ''}
                ${canDelete ? `<button class="btn btn-sm btn-danger" data-del-mat="${m.id}">Remover</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table></div>
    </section>
  `;
  const btnNova = document.getElementById('btnNovaMatricula');
  if (btnNova) btnNova.onclick = () => openMatriculaForm();
  document.getElementById('btnExportarMatriculas').onclick = () => exportarExcel('matriculas', 'Matrículas', state.matriculas.map(m => ({
    'Aluno': alunoNome(m.alunoId), 'Curso': cursoNome(m.cursoId), 'Turma': turmaCodigo(byId(state.turmas, m.turmaId)), 'Ano Letivo': anoLetivoLabel(m.anoLetivo),
    'Data': fmtDate(m.data), 'Estado': m.status,
  })));
  state.matriculas.forEach(m => {
    const editBtn = document.querySelector(`[data-edit-mat="${m.id}"]`);
    const delBtn = document.querySelector(`[data-del-mat="${m.id}"]`);
    if (editBtn) editBtn.onclick = () => openMatriculaForm(m.id);
    if (delBtn) delBtn.onclick = () => deleteMatricula(m.id);
  });
}

function openMatriculaForm(id) {
  if (id ? !hasPerm('matriculas', 'edit') : !hasPerm('matriculas', 'create')) return;
  const m = id ? byId(state.matriculas, id) : null;
  openModal(m ? 'Editar matrícula' : 'Nova matrícula', `
    <div class="form-grid">
      ${alunoBuscaFieldHtml(m?.alunoId)}
      <div class="field"><label>Curso</label>
        <select id="fCurso">${state.cursos.map(c => `<option value="${c.id}" ${m?.cursoId === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Turma</label>
        <select id="fTurmaMat"></select>
      </div>
      <div class="field"><label>Ano letivo</label><input id="fAnoLetivo" type="number" value="${m?.anoLetivo || state.anoLetivo}"></div>
      <div class="field"><label>Data da matrícula</label><input id="fData" type="date" value="${m?.data || hoje()}"></div>
      <div class="field"><label>Estado</label>
        <select id="fStatus">${['Ativa', 'Trancada', 'Concluída', 'Cancelada'].map(s => `<option ${m?.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Guardar</button>
    </div>
  `, () => {
    const getAlunoId = wireAlunoBusca(m?.alunoId);
    const fCurso = document.getElementById('fCurso');
    const fTurmaMat = document.getElementById('fTurmaMat');
    function refreshTurmasMat() {
      const turmasDoCurso = state.turmas.filter(t => t.cursoId === fCurso.value);
      fTurmaMat.innerHTML = turmasDoCurso.length === 0
        ? `<option value="">Nenhuma turma cadastrada para este curso</option>`
        : turmasDoCurso.map(t => `<option value="${t.id}" ${m?.turmaId === t.id ? 'selected' : ''}>${esc(turmaCodigo(t))}</option>`).join('');
    }
    refreshTurmasMat();
    fCurso.onchange = refreshTurmasMat;
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('btnSave').onclick = () => {
      const alunoId = getAlunoId();
      if (!alunoId) { toast('Procure o aluno pelo número de matrícula antes de guardar.'); return; }
      const payload = {
        alunoId,
        cursoId: fCurso.value,
        turmaId: fTurmaMat.value || null,
        anoLetivo: Number(document.getElementById('fAnoLetivo').value) || state.anoLetivo,
        data: document.getElementById('fData').value,
        status: document.getElementById('fStatus').value,
      };
      if (!m && state.matriculas.some(x => x.alunoId === payload.alunoId && x.anoLetivo === payload.anoLetivo && x.cursoId === payload.cursoId)) {
        toast('Este aluno já tem matrícula nesse curso e ano letivo.');
        return;
      }
      const jaExistia = !!m;
      if (m) Object.assign(m, payload);
      else state.matriculas.push({ id: nextId('m'), ...payload });
      registrarLog(jaExistia ? 'Editar' : 'Criar', 'matriculas', `Matrícula ${jaExistia ? 'editada' : 'criada'}: ${alunoNome(payload.alunoId)} — ${cursoNome(payload.cursoId)} · turma ${turmaCodigo(byId(state.turmas, payload.turmaId))} (${anoLetivoLabel(payload.anoLetivo)})`);
      saveState();
      closeModal();
      toast('Matrícula guardada.');
      renderMatriculas();
    };
  });
}

function deleteMatricula(id) {
  if (!hasPerm('matriculas', 'delete')) return;
  if (!confirm('Remover esta matrícula?')) return;
  const alvo = byId(state.matriculas, id);
  state.matriculas = state.matriculas.filter(m => m.id !== id);
  registrarLog('Remover', 'matriculas', `Matrícula removida: ${alvo ? alunoNome(alvo.alunoId) + ' — ' + cursoNome(alvo.cursoId) : id}`);
  saveState();
  toast('Matrícula removida.');
  renderMatriculas();
}

/* ============================ Períodos de Avaliação =========================== */

function renderPeriodos(selAulaId) {
  const aulas = state.aulas;
  const aulaId = selAulaId || aulas[0]?.id || '';
  const canEdit = hasPerm('periodos', 'edit') || hasPerm('periodos', 'create');
  const pendentes = state.reaberturas.filter(r => r.status === 'Pendente');
  const respondidas = state.reaberturas.filter(r => r.status !== 'Pendente').slice(-10).reverse();
  const melhoriasPendentes = state.melhorias.filter(m => m.status === 'Pendente');
  const melhoriasRespondidas = state.melhorias.filter(m => m.status !== 'Pendente').slice(-10).reverse();

  document.getElementById('content').innerHTML = `
    <section class="section active">
      ${canEdit ? `
      <div class="panel">
        <h3>Configuração da Avaliação</h3>
        <div class="panel-sub">Número de provas lançadas antes do Exame Final (a Média é a média simples de todas). Aplica-se a partir de já a todas as turmas.</div>
        <div class="toolbar">
          <select class="input" id="fltNumProvas">
            ${Array.from({ length: NUM_PROVAS_MAX - NUM_PROVAS_MIN + 1 }, (_, i) => NUM_PROVAS_MIN + i).map(n => `<option value="${n}" ${n === numProvas() ? 'selected' : ''}>${n} provas (Prova 1${n > 1 ? ` a Prova ${n}` : ''})</option>`).join('')}
          </select>
          <select class="input" id="fltArredondar">
            <option value="nao" ${!state.configAvaliacao.arredondarNotaFinal ? 'selected' : ''}>Nota Final com 1 casa decimal (ex.: 13,7)</option>
            <option value="sim" ${state.configAvaliacao.arredondarNotaFinal ? 'selected' : ''}>Nota Final arredondada ao inteiro (ex.: 14)</option>
          </select>
        </div>
      </div>` : ''}
      <div class="panel">
        <h3>Janelas de lançamento por turma</h3>
        <div class="panel-sub">Enquanto uma etapa não tiver período definido e aberto, o docente não consegue lançar essa avaliação.</div>
        <div class="toolbar">
          <select class="input" id="fltTurmaPer">
            ${aulas.map(a => `<option value="${a.id}" ${a.id === aulaId ? 'selected' : ''}>${aulaLabel(a)}</option>`).join('')}
          </select>
        </div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Etapa</th><th>Início</th><th>Fim</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${tiposAvaliacao().map(t => {
              const p = periodoFor(aulaId, t.key);
              const status = janelaStatus(aulaId, t.key);
              return `
                <tr>
                  <td>${esc(t.label)}</td>
                  <td>${p ? fmtDate(p.inicio) : '—'}</td>
                  <td>${p ? fmtDate(p.fim) : '—'}</td>
                  <td>${janelaBadge(status)}</td>
                  <td class="row-actions">
                    ${canEdit ? `<button class="btn btn-sm" data-edit-periodo="${t.key}">${p ? 'Editar período' : 'Definir período'}</button>` : ''}
                    ${canEdit && status === 'submetido' ? `<button class="btn btn-sm btn-danger" data-reabrir="${t.key}">Reabrir agora</button>` : ''}
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table></div>
      </div>

      ${hasPerm('periodos', 'edit') ? `
      <div class="panel">
        <h3>Solicitações de reabertura pendentes</h3>
        ${pendentes.length === 0 ? '<p class="text-muted">Nenhum pedido pendente.</p>' : `
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Turma</th><th>Etapa</th><th>Motivo</th><th>Solicitado em</th><th></th></tr></thead>
            <tbody>
              ${pendentes.map(r => {
                const a = byId(state.aulas, r.aulaId);
                return `
                  <tr>
                    <td>${esc(disciplinaNome(a?.disciplinaId))}</td>
                    <td>${esc(tipoLabel(r.tipo))}</td>
                    <td>${esc(r.motivo)}</td>
                    <td>${fmtDate(r.solicitadoEm)}</td>
                    <td class="row-actions">
                      <button class="btn btn-sm btn-primary" data-aprovar-reab="${r.id}">Aprovar</button>
                      <button class="btn btn-sm btn-danger" data-rejeitar-reab="${r.id}">Rejeitar</button>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table></div>
        `}
      </div>

      <div class="panel">
        <h3>Histórico de solicitações</h3>
        ${respondidas.length === 0 ? '<p class="text-muted">Sem histórico ainda.</p>' : `
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Turma</th><th>Etapa</th><th>Motivo</th><th>Resultado</th></tr></thead>
            <tbody>
              ${respondidas.map(r => {
                const a = byId(state.aulas, r.aulaId);
                return `<tr><td>${esc(disciplinaNome(a?.disciplinaId))}</td><td>${esc(tipoLabel(r.tipo))}</td><td>${esc(r.motivo)}</td><td>${statusBadge(r.status === 'Aprovada' ? 'Aprovado' : 'Reprovado')}</td></tr>`;
              }).join('')}
            </tbody>
          </table></div>
        `}
      </div>

      <div class="panel">
        <h3>Pedidos de Exame de Melhoria</h3>
        <div class="panel-sub">Pedido individual do aluno (feito em "Meu Painel") — só o docente lança a nota depois de aprovado aqui.</div>
        ${melhoriasPendentes.length === 0 ? '<p class="text-muted">Nenhum pedido pendente.</p>' : `
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Aluno</th><th>Disciplina</th><th>Solicitado em</th><th></th></tr></thead>
            <tbody>
              ${melhoriasPendentes.map(m => `
                <tr>
                  <td>${esc(alunoNome(m.alunoId))}</td>
                  <td>${esc(disciplinaNome(m.disciplinaId))}</td>
                  <td>${fmtDate(m.solicitadoEm)}</td>
                  <td class="row-actions">
                    <button class="btn btn-sm btn-primary" data-aprovar-melhoria="${m.id}">Aprovar</button>
                    <button class="btn btn-sm btn-danger" data-rejeitar-melhoria="${m.id}">Rejeitar</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        `}
        ${melhoriasRespondidas.length === 0 ? '' : `
          <div class="table-wrap" style="margin-top:12px;"><table class="data">
            <thead><tr><th>Aluno</th><th>Disciplina</th><th>Resultado</th></tr></thead>
            <tbody>
              ${melhoriasRespondidas.map(m => `<tr><td>${esc(alunoNome(m.alunoId))}</td><td>${esc(disciplinaNome(m.disciplinaId))}</td><td>${statusBadge(m.status === 'Aprovada' ? 'Aprovado' : 'Reprovado')}</td></tr>`).join('')}
            </tbody>
          </table></div>
        `}
      </div>` : ''}
    </section>
  `;

  document.getElementById('fltTurmaPer').onchange = e => renderPeriodos(e.target.value);
  const fltNumProvas = document.getElementById('fltNumProvas');
  if (fltNumProvas) fltNumProvas.onchange = e => {
    const n = Number(e.target.value);
    if (!confirm(`Alterar o número de provas para ${n}? Isto passa a valer para o lançamento de notas em todas as turmas a partir de agora.`)) { renderPeriodos(aulaId); return; }
    const anterior = state.configAvaliacao.numProvas;
    state.configAvaliacao.numProvas = n;
    registrarLog('Configurar', 'periodos', `Número de provas alterado de ${anterior} para ${n}.`);
    saveState();
    toast('Configuração da avaliação atualizada.');
    renderPeriodos(aulaId);
  };
  const fltArredondar = document.getElementById('fltArredondar');
  if (fltArredondar) fltArredondar.onchange = e => {
    const novo = e.target.value === 'sim';
    state.configAvaliacao.arredondarNotaFinal = novo;
    registrarLog('Configurar', 'periodos', `Arredondamento da Nota Final ${novo ? 'ativado (inteiro)' : 'desativado (1 casa decimal)'}.`);
    saveState();
    toast('Configuração da avaliação atualizada.');
    renderPeriodos(aulaId);
  };
  tiposAvaliacao().forEach(t => {
    const editBtn = document.querySelector(`[data-edit-periodo="${t.key}"]`);
    const reabrirBtn = document.querySelector(`[data-reabrir="${t.key}"]`);
    if (editBtn) editBtn.onclick = () => openPeriodoForm(aulaId, t.key);
    if (reabrirBtn) reabrirBtn.onclick = () => {
      if (!confirm(`Reabrir "${t.label}" para esta turma? O docente poderá voltar a editar e submeter esta etapa.`)) return;
      state.submissoes = state.submissoes.filter(s => !(s.aulaId === aulaId && s.tipo === t.key));
      registrarLog('Editar', 'periodos', `Etapa "${t.label}" reaberta para a turma ${turmaCodigo(byId(state.turmas, byId(state.aulas, aulaId)?.turmaId))}.`);
      saveState();
      toast('Etapa reaberta.');
      renderPeriodos(aulaId);
    };
  });
  pendentes.forEach(r => {
    const aprovar = document.querySelector(`[data-aprovar-reab="${r.id}"]`);
    const rejeitar = document.querySelector(`[data-rejeitar-reab="${r.id}"]`);
    if (aprovar) aprovar.onclick = () => {
      state.submissoes = state.submissoes.filter(s => !(s.aulaId === r.aulaId && s.tipo === r.tipo));
      r.status = 'Aprovada';
      r.respondidoEm = hoje();
      registrarLog('Aprovar', 'periodos', `Pedido de reabertura aprovado: ${tipoLabel(r.tipo)} — turma ${turmaCodigo(byId(state.turmas, byId(state.aulas, r.aulaId)?.turmaId))}.`);
      saveState();
      toast('Pedido aprovado — etapa reaberta.');
      renderPeriodos(aulaId);
    };
    if (rejeitar) rejeitar.onclick = () => {
      r.status = 'Rejeitada';
      r.respondidoEm = hoje();
      registrarLog('Rejeitar', 'periodos', `Pedido de reabertura rejeitado: ${tipoLabel(r.tipo)} — turma ${turmaCodigo(byId(state.turmas, byId(state.aulas, r.aulaId)?.turmaId))}.`);
      saveState();
      toast('Pedido rejeitado.');
      renderPeriodos(aulaId);
    };
  });
  melhoriasPendentes.forEach(m => {
    const aprovar = document.querySelector(`[data-aprovar-melhoria="${m.id}"]`);
    const rejeitar = document.querySelector(`[data-rejeitar-melhoria="${m.id}"]`);
    if (aprovar) aprovar.onclick = () => {
      m.status = 'Aprovada';
      m.respondidoEm = hoje();
      registrarLog('Aprovar', 'periodos', `Exame de Melhoria aprovado: ${alunoNome(m.alunoId)} — ${disciplinaNome(m.disciplinaId)}.`);
      saveState();
      toast('Exame de Melhoria aprovado — o docente já pode lançar a nota.');
      renderPeriodos(aulaId);
    };
    if (rejeitar) rejeitar.onclick = () => {
      m.status = 'Rejeitada';
      m.respondidoEm = hoje();
      registrarLog('Rejeitar', 'periodos', `Exame de Melhoria rejeitado: ${alunoNome(m.alunoId)} — ${disciplinaNome(m.disciplinaId)}.`);
      saveState();
      toast('Pedido de melhoria rejeitado.');
      renderPeriodos(aulaId);
    };
  });
}

function openPeriodoForm(aulaId, tipo) {
  if (!hasPerm('periodos', 'edit') && !hasPerm('periodos', 'create')) return;
  const p = periodoFor(aulaId, tipo);
  openModal(`Período — ${tipoLabel(tipo)}`, `
    <div class="form-grid">
      <div class="field"><label>Início</label><input id="fInicio" type="date" value="${p?.inicio || ''}"></div>
      <div class="field"><label>Fim</label><input id="fFim" type="date" value="${p?.fim || ''}"></div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Guardar</button>
    </div>
  `, () => {
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('btnSave').onclick = () => {
      const inicio = document.getElementById('fInicio').value;
      const fim = document.getElementById('fFim').value;
      if (!inicio || !fim || fim < inicio) { toast('Indique um intervalo de datas válido.'); return; }
      if (p) { p.inicio = inicio; p.fim = fim; }
      else state.periodos.push({ id: nextId('pr'), aulaId, tipo, inicio, fim });
      registrarLog('Editar', 'periodos', `Período definido: ${tipoLabel(tipo)} — turma ${turmaCodigo(byId(state.turmas, byId(state.aulas, aulaId)?.turmaId))} (${fmtDate(inicio)} a ${fmtDate(fim)}).`);
      saveState();
      closeModal();
      toast('Período guardado.');
      renderPeriodos(aulaId);
    };
  });
}

/* ==================================== Notas =================================== */

function renderNotas() {
  if (hasPerm('notas', 'create')) return renderNotasLancamento();
  return renderNotasConsolidado();
}

function renderNotasConsolidado(selAulaId) {
  const aulas = scopedAulas();
  if (!aulas.length) {
    document.getElementById('content').innerHTML = `<section class="section active">${lockedNote('Nenhuma turma disponível.')}</section>`;
    return;
  }
  const aulaId = selAulaId || aulas[0].id;
  const aula = byId(state.aulas, aulaId);
  const rows = state.notas.filter(n => n.disciplinaId === aula.disciplinaId);

  const provas = provaKeys();
  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="toolbar">
        <select class="input" id="fltTurmaNotas">
          ${aulas.map(a => `<option value="${a.id}" ${a.id === aulaId ? 'selected' : ''}>${aulaLabel(a)}</option>`).join('')}
        </select>
        <div class="spacer"></div>
        <button class="btn" id="btnExportarNotas">Exportar Excel</button>
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Nome do Estudante</th>${provas.map((_, i) => `<th>P${i + 1}</th>`).join('')}<th>Média</th><th>Exame</th><th>Recurso</th><th>Especial</th><th>Melhoria</th><th>Nota Final</th><th>Situação</th><th>Observações</th></tr></thead>
        <tbody>
          ${rows.length === 0 ? `<tr class="empty-row"><td colspan="${9 + provas.length}">Nenhuma nota lançada para esta turma.</td></tr>` : rows.map(n => {
            const r = avaliacaoResumo(n);
            return `
              <tr>
                <td>${esc(alunoNome(n.alunoId))}</td>
                ${provas.map(k => `<td class="mono">${n[k] ?? '—'}</td>`).join('')}
                <td class="mono">${media(n) ?? '—'}</td>
                <td class="mono">${celulaExame(n)}</td>
                <td class="mono">${n.exameRecurso ?? '—'}</td>
                <td class="mono">${n.exameEspecial ?? '—'}</td>
                <td class="mono">${n.exameMelhoria ?? '—'}</td>
                <td class="mono">${r.efetiva ?? '—'}</td>
                <td>${statusBadge(r.situacao)}</td>
                <td>${esc(observacoes(n))}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </section>
  `;
  document.getElementById('fltTurmaNotas').onchange = e => renderNotasConsolidado(e.target.value);
  document.getElementById('btnExportarNotas').onclick = () => exportarExcel(
    `notas_${turmaCodigo(byId(state.turmas, aula.turmaId))}_${aula.disciplinaId}`,
    'Notas',
    rows.map(n => {
      const r = avaliacaoResumo(n);
      const linha = { 'Nome do Estudante': alunoNome(n.alunoId) };
      provas.forEach((k, i) => { linha[`P${i + 1}`] = n[k] ?? ''; });
      linha['Média'] = media(n) ?? '';
      linha['Exame'] = present(n.exameFinal) ? n.exameFinal : '';
      linha['Recurso'] = n.exameRecurso ?? '';
      linha['Especial'] = n.exameEspecial ?? '';
      linha['Melhoria'] = n.exameMelhoria ?? '';
      linha['Nota Final'] = r.efetiva ?? '';
      linha['Situação'] = r.situacao;
      linha['Observações'] = observacoes(n);
      return linha;
    })
  );
}

function renderNotasLancamento(selAulaId) {
  const aulas = scopedAulas();
  if (!aulas.length) {
    document.getElementById('content').innerHTML = `<section class="section active">${lockedNote('Nenhuma turma atribuída.')}</section>`;
    return;
  }
  const aulaId = selAulaId || aulas[0].id;
  const aula = byId(state.aulas, aulaId);
  const disciplina = byId(state.disciplinas, aula.disciplinaId);
  const estagio = estagioAtual(aulaId);
  const etapasSubmetidas = tiposAvaliacao().filter(t => isSubmetido(aulaId, t.key));

  const historicoHtml = etapasSubmetidas.length === 0 ? '' : `
    <div class="panel">
      <h3>Etapas já submetidas nesta turma</h3>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Etapa</th><th></th></tr></thead>
        <tbody>
          ${etapasSubmetidas.map(t => `
            <tr><td>${esc(t.label)}</td><td class="row-actions"><button class="btn btn-sm" data-solicitar-reab="${t.key}">Solicitar reabertura</button></td></tr>
          `).join('')}
        </tbody>
      </table></div>
    </div>`;

  let corpoHtml = '';
  let relevantes = [];
  let mostraTabelaEntrada = false;

  if (estagio === null) {
    corpoHtml = `<div class="panel"><p class="text-muted">✓ Todas as avaliações desta turma foram submetidas.</p></div>` + renderConsolidadoTurmaHtml(aulaId, aula.disciplinaId);
  } else {
    const status = janelaStatus(aulaId, estagio);
    if (status !== 'aberto') {
      const p = periodoFor(aulaId, estagio);
      let msg;
      if (status === 'nao-definido') msg = `A Secretaria Académica ainda não definiu o período de lançamento de "${tipoLabel(estagio)}" para esta turma.`;
      else if (status === 'agendado') msg = `O período de lançamento de "${tipoLabel(estagio)}" abre em ${fmtDate(p.inicio)}.`;
      else msg = `O período de lançamento de "${tipoLabel(estagio)}" encerrou em ${fmtDate(p.fim)}.`;
      corpoHtml = lockedNote(msg) + `
        <div class="toolbar"><button class="btn" id="btnSolicitarAbertura">Solicitar abertura/reabertura à Secretaria</button></div>
      `;
    } else {
      relevantes = alunosRelevantesEstagio(aulaId, estagio, aula.disciplinaId);
      if (relevantes.length === 0 && !provaKeys().includes(estagio)) {
        const motivoVazio = estagio === 'exameFinal'
          ? 'Todos os alunos desta turma têm Média ≥ 15 e ficaram dispensados do Exame Final.'
          : `Nenhum aluno desta turma precisa de ${esc(tipoLabel(estagio))}.`;
        corpoHtml = `
          <div class="panel">
            <p class="text-muted">${motivoVazio}</p>
            <button class="btn btn-primary" id="btnSubmeterVazio">Submeter etapa (sem lançamentos) e avançar</button>
          </div>` + renderConsolidadoTurmaHtml(aulaId, aula.disciplinaId);
      } else {
        mostraTabelaEntrada = true;
        const colunasPauta = [
          ...provaKeys().map((k, i) => ({ key: k, label: `P${i + 1}` })),
          { key: 'media', label: 'Média' },
          { key: 'exameFinal', label: 'Exame Final' },
          { key: 'exameRecurso', label: 'Recurso' },
          { key: 'exameEspecial', label: 'Especial' },
        ];
        // No Exame Final mostra-se a turma inteira (para ver quem ficou dispensado);
        // nas outras etapas mostra-se só quem precisa de facto de a fazer.
        const linhasPauta = estagio === 'exameFinal' ? aulaRoster(aulaId) : relevantes;
        corpoHtml = `
          <div class="panel">
            <h3>${esc(tipoLabel(estagio))}</h3>
            <div class="panel-sub">${esc(disciplina.nome)} · período aberto até ${fmtDate(periodoFor(aulaId, estagio)?.fim)} · ${relevantes.length} aluno(s) por avaliar · pauta com as notas já lançadas</div>
            <div class="table-wrap"><table class="data">
              <thead><tr><th>Nº</th><th>Nome do Estudante</th>${colunasPauta.map(c => `<th>${c.label}</th>`).join('')}<th>Observações</th></tr></thead>
              <tbody>
                ${linhasPauta.map(a => {
                  const n = state.notas.find(x => x.alunoId === a.id && x.disciplinaId === aula.disciplinaId);
                  const editavel = estagio === 'exameFinal' ? relevantes.some(r => r.id === a.id) : true;
                  const celulas = colunasPauta.map(c => {
                    if (c.key === estagio && editavel) {
                      const val = n ? n[estagio] : null;
                      return `<td><input class="input" type="number" min="0" max="20" step="0.5" data-grade="${a.id}" value="${val ?? ''}"></td>`;
                    }
                    if (c.key === 'media') return `<td class="mono">${n ? (media(n) ?? '—') : '—'}</td>`;
                    return `<td class="mono">${n && present(n[c.key]) ? n[c.key] : '—'}</td>`;
                  }).join('');
                  return `<tr><td class="mono">${esc(a.numero)}</td><td>${esc(a.nome)}</td>${celulas}<td>${n ? esc(observacoes(n)) : '—'}</td></tr>`;
                }).join('')}
              </tbody>
            </table></div>
            <div class="modal-footer" style="margin-top:14px;">
              <button class="btn" id="btnGravarRascunho">Gravar rascunho</button>
              <button class="btn btn-primary" id="btnSubmeterEtapa">Gravar e Submeter</button>
            </div>
          </div>`;
      }
    }
  }

  const melhoriaHtml = renderMelhoriaPanelHtml(aula.disciplinaId);

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="toolbar">
        <select class="input" id="fltTurmaLanc">
          ${aulas.map(a => `<option value="${a.id}" ${a.id === aulaId ? 'selected' : ''}>${aulaLabel(a)}</option>`).join('')}
        </select>
        <div class="spacer"></div>
        <button class="btn" id="btnExportarNotasTurma">Exportar Excel (pauta desta turma)</button>
      </div>
      ${corpoHtml}
      ${historicoHtml}
      ${melhoriaHtml}
    </section>
  `;

  document.getElementById('fltTurmaLanc').onchange = e => renderNotasLancamento(e.target.value);
  document.getElementById('btnExportarNotasTurma').onclick = () => {
    const provas = provaKeys();
    exportarExcel(`notas_${turmaCodigo(byId(state.turmas, aula.turmaId))}_${aula.disciplinaId}`, 'Notas', state.notas.filter(n => n.disciplinaId === aula.disciplinaId).map(n => {
      const r = avaliacaoResumo(n);
      const linha = { 'Nome do Estudante': alunoNome(n.alunoId) };
      provas.forEach((k, i) => { linha[`P${i + 1}`] = n[k] ?? ''; });
      linha['Média'] = media(n) ?? '';
      linha['Exame'] = present(n.exameFinal) ? n.exameFinal : '';
      linha['Recurso'] = n.exameRecurso ?? '';
      linha['Especial'] = n.exameEspecial ?? '';
      linha['Melhoria'] = n.exameMelhoria ?? '';
      linha['Nota Final'] = r.efetiva ?? '';
      linha['Situação'] = r.situacao;
      linha['Observações'] = observacoes(n);
      return linha;
    }));
  };
  wireMelhoriaPanel(() => renderNotasLancamento(aulaId));

  function persistirNotas(marcarSubmetido) {
    let semNota = 0;
    relevantes.forEach(a => {
      const input = document.querySelector(`[data-grade="${a.id}"]`);
      const raw = input.value;
      const n = getOrCreateNota(a.id, aula.disciplinaId, aulaId);
      n[estagio] = raw === '' ? null : Number(raw);
      aplicarDispensaAutomatica(n);
      if (raw === '') semNota++;
    });
    if (marcarSubmetido && semNota > 0 && !confirm(`${semNota} aluno(s) sem nota lançada nesta etapa. Submeter mesmo assim?`)) return false;
    registrarLog('Editar', 'notas', `Notas de "${tipoLabel(estagio)}" gravadas — turma ${turmaCodigo(byId(state.turmas, aula.turmaId))}${marcarSubmetido ? '' : ' (rascunho)'}.`);
    saveState();
    if (marcarSubmetido) {
      state.submissoes.push({ id: nextId('sb'), aulaId, tipo: estagio, submetidoEm: hoje(), submetidoPor: currentUser.id });
      registrarLog('Processar', 'notas', `Etapa "${tipoLabel(estagio)}" submetida — turma ${turmaCodigo(byId(state.turmas, aula.turmaId))}.`);
      saveState();
    }
    return true;
  }

  if (mostraTabelaEntrada) {
    document.getElementById('btnGravarRascunho').onclick = () => {
      persistirNotas(false);
      toast('Rascunho guardado.');
      renderNotasLancamento(aulaId);
    };
    document.getElementById('btnSubmeterEtapa').onclick = () => {
      if (persistirNotas(true)) {
        toast('Etapa submetida — já pode avançar para a próxima avaliação.');
        renderNotasLancamento(aulaId);
      }
    };
  }
  const btnVazio = document.getElementById('btnSubmeterVazio');
  if (btnVazio) btnVazio.onclick = () => {
    state.submissoes.push({ id: nextId('sb'), aulaId, tipo: estagio, submetidoEm: hoje(), submetidoPor: currentUser.id });
    registrarLog('Processar', 'notas', `Etapa "${tipoLabel(estagio)}" submetida sem lançamentos — turma ${turmaCodigo(byId(state.turmas, aula.turmaId))}.`);
    saveState();
    toast('Etapa submetida — já pode avançar para a próxima avaliação.');
    renderNotasLancamento(aulaId);
  };
  const btnSolicitarAbertura = document.getElementById('btnSolicitarAbertura');
  if (btnSolicitarAbertura) btnSolicitarAbertura.onclick = () => openReaberturaForm(aulaId, estagio);
  etapasSubmetidas.forEach(t => {
    const btn = document.querySelector(`[data-solicitar-reab="${t.key}"]`);
    if (btn) btn.onclick = () => openReaberturaForm(aulaId, t.key);
  });
}

function renderConsolidadoTurmaHtml(aulaId, disciplinaId) {
  const rows = state.notas.filter(n => n.disciplinaId === disciplinaId);
  const provas = provaKeys();
  return `
    <div class="panel">
      <h3>Notas da turma</h3>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Nome do Estudante</th>${provas.map((_, i) => `<th>P${i + 1}</th>`).join('')}<th>Média</th><th>Exame</th><th>Recurso</th><th>Especial</th><th>Melhoria</th><th>Nota Final</th><th>Situação</th><th>Observações</th></tr></thead>
        <tbody>
          ${rows.map(n => {
            const r = avaliacaoResumo(n);
            return `<tr>
              <td>${esc(alunoNome(n.alunoId))}</td>
              ${provas.map(k => `<td class="mono">${n[k] ?? '—'}</td>`).join('')}
              <td class="mono">${media(n) ?? '—'}</td>
              <td class="mono">${celulaExame(n)}</td>
              <td class="mono">${n.exameRecurso ?? '—'}</td>
              <td class="mono">${n.exameEspecial ?? '—'}</td>
              <td class="mono">${n.exameMelhoria ?? '—'}</td>
              <td class="mono">${r.efetiva ?? '—'}</td>
              <td>${statusBadge(r.situacao)}</td>
              <td>${esc(observacoes(n))}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </div>`;
}

function openReaberturaForm(aulaId, tipo) {
  openModal(`Solicitar abertura — ${tipoLabel(tipo)}`, `
    <div class="field">
      <label>Motivo do pedido</label>
      <textarea id="fMotivo" placeholder="Explique à Secretaria Académica porque precisa de lançar/corrigir esta avaliação..."></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Enviar pedido</button>
    </div>
  `, () => {
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('btnSave').onclick = () => {
      const motivo = document.getElementById('fMotivo').value.trim();
      if (!motivo) { toast('Descreva o motivo do pedido.'); return; }
      state.reaberturas.push({ id: nextId('rb'), aulaId, tipo, motivo, solicitadoPor: currentUser.id, solicitadoEm: hoje(), status: 'Pendente', respondidoEm: null });
      registrarLog('Criar', 'periodos', `Pedido de reabertura solicitado: ${tipoLabel(tipo)} — turma ${turmaCodigo(byId(state.turmas, byId(state.aulas, aulaId)?.turmaId))}.`);
      saveState();
      closeModal();
      toast('Pedido enviado à Secretaria Académica.');
      renderNotasLancamento(aulaId);
    };
  });
}

/* ================================= Frequência ================================= */

/* Alunos com matrícula ativa nesta turma (coorte) — agora um vínculo real
   (matricula.turmaId), não uma aproximação por curso. */
function turmaRoster(turmaId) {
  if (!turmaId) return [];
  const alunoIds = new Set(state.matriculas.filter(m => m.turmaId === turmaId && m.status === 'Ativa').map(m => m.alunoId));
  return state.alunos.filter(a => alunoIds.has(a.id));
}
/* Roster de uma aula = roster da turma (coorte) a que ela pertence. */
function aulaRoster(aulaId) {
  const a = byId(state.aulas, aulaId);
  return a ? turmaRoster(a.turmaId) : [];
}

function emprestimoStatus(e) {
  if (e.dataDevolucao) return 'Devolvido';
  return e.dataPrevista < hoje() ? 'Atrasado' : 'Emprestado';
}

/* Extrato de frequência: aulas dadas/presenças/faltas/% por aluno de uma
   turma — base do alerta de risco de reprovação por faltas (< 75%). */
function calcularFrequenciaAula(aulaId) {
  const roster = aulaRoster(aulaId);
  const registos = state.frequencia.filter(f => f.aulaId === aulaId);
  return roster.map(a => {
    let total = 0, presentes = 0;
    registos.forEach(f => {
      if (a.id in f.presencas) { total++; if (f.presencas[a.id]) presentes++; }
    });
    const pct = total > 0 ? Math.round((presentes / total) * 100) : null;
    return { aluno: a, total, presentes, faltas: total - presentes, pct };
  });
}
function emRiscoPorFaltas(pct) { return pct !== null && pct < FREQUENCIA_MINIMA; }

function renderFrequencia(selAula, selData, view) {
  if (view === 'extrato') return renderFrequenciaExtrato(selAula);

  const canCreate = hasPerm('frequencia', 'create');
  const canEdit = hasPerm('frequencia', 'edit');
  const aulasDisponiveis = scopedAulas();
  const aulaId = selAula || aulasDisponiveis[0]?.id || '';
  const data = selData || hoje();
  const roster = aulaRoster(aulaId);
  const registo = state.frequencia.find(f => f.aulaId === aulaId && f.data === data);
  const podeEditar = registo ? canEdit : canCreate;

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="toolbar">
        <select class="input" id="fltTurmaFreq">
          ${aulasDisponiveis.map(a => `<option value="${a.id}" ${a.id === aulaId ? 'selected' : ''}>[${esc(turmaCodigo(byId(state.turmas, a.turmaId)))}] ${esc(disciplinaNome(a.disciplinaId))} — ${DIAS[a.dia]} ${esc(horarioLabel(a.hora))}</option>`).join('')}
        </select>
        <input class="input" id="fltDataFreq" type="date" value="${data}">
        <div class="spacer"></div>
        <button class="btn" id="btnExtratoFreq">Extrato de Frequência</button>
      </div>

      <div class="panel">
        <h3>Lista de presenças</h3>
        <div class="panel-sub">${roster.length} aluno(s) matriculado(s) nesta turma</div>
        ${roster.length === 0 ? '<p class="text-muted">Sem alunos matriculados nesta turma.</p>' : `
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Nº</th><th>Aluno</th><th style="width:110px;">Presente</th></tr></thead>
            <tbody>
              ${roster.map(a => `
                <tr>
                  <td class="mono">${esc(a.numero)}</td>
                  <td>${esc(a.nome)}</td>
                  <td><input type="checkbox" data-presenca="${a.id}" ${registo?.presencas?.[a.id] !== false ? 'checked' : ''} ${podeEditar ? '' : 'disabled'}></td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
          ${podeEditar ? `
          <div class="modal-footer" style="margin-top:14px;">
            <button class="btn btn-primary" id="btnSalvarFreq">Guardar chamada</button>
          </div>` : ''}
        `}
      </div>
    </section>
  `;

  document.getElementById('fltTurmaFreq').onchange = e => renderFrequencia(e.target.value, data);
  document.getElementById('fltDataFreq').onchange = e => renderFrequencia(aulaId, e.target.value);
  document.getElementById('btnExtratoFreq').onclick = () => renderFrequencia(aulaId, data, 'extrato');

  const btnSalvar = document.getElementById('btnSalvarFreq');
  if (btnSalvar) {
    btnSalvar.onclick = () => {
      const presencas = {};
      roster.forEach(a => {
        presencas[a.id] = document.querySelector(`[data-presenca="${a.id}"]`).checked;
      });
      if (registo) registo.presencas = presencas;
      else state.frequencia.push({ id: nextId('f'), aulaId, data, presencas });
      registrarLog('Editar', 'frequencia', `Chamada guardada — turma ${turmaCodigo(byId(state.turmas, byId(state.aulas, aulaId)?.turmaId))} em ${fmtDate(data)}.`);
      saveState();
      toast('Chamada guardada.');
      renderFrequencia(aulaId, data);
    };
  }
}

function renderFrequenciaExtrato(selAula) {
  const aulasDisponiveis = scopedAulas();
  const aulaId = selAula || aulasDisponiveis[0]?.id || '';
  const linhas = calcularFrequenciaAula(aulaId);
  const emRisco = linhas.filter(l => emRiscoPorFaltas(l.pct));

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="toolbar no-print">
        <button class="btn" id="btnVoltarChamada">← Voltar à chamada</button>
        <select class="input" id="fltTurmaExtrato">
          ${aulasDisponiveis.map(a => `<option value="${a.id}" ${a.id === aulaId ? 'selected' : ''}>[${esc(turmaCodigo(byId(state.turmas, a.turmaId)))}] ${esc(disciplinaNome(a.disciplinaId))} — ${DIAS[a.dia]} ${esc(horarioLabel(a.hora))}</option>`).join('')}
        </select>
        <div class="spacer"></div>
        <div class="export-tools">
          <button class="btn" id="btnImprimirExtrato">Imprimir (PDF)</button>
          <button class="btn" id="btnExportarExtrato">Exportar Excel</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">Alunos</div><div class="kpi-value">${linhas.length}</div></div>
        <div class="kpi-card ${emRisco.length ? 'accent-red' : 'accent-green'}"><div class="kpi-label">Em Risco (&lt;${FREQUENCIA_MINIMA}%)</div><div class="kpi-value">${emRisco.length}</div></div>
      </div>

      <div class="panel">
        <h3>Extrato de Frequência</h3>
        <div class="panel-sub">${esc(disciplinaNome(byId(state.aulas, aulaId)?.disciplinaId))} — mínimo exigido: ${FREQUENCIA_MINIMA}%</div>
        ${linhas.length === 0 ? '<p class="text-muted">Sem alunos matriculados nesta turma.</p>' : `
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Nº</th><th>Nome do Estudante</th><th>Aulas Dadas</th><th>Presenças</th><th>Faltas</th><th>% Frequência</th><th>Situação</th></tr></thead>
            <tbody>
              ${linhas.map(l => `
                <tr>
                  <td class="mono">${esc(l.aluno.numero)}</td>
                  <td>${esc(l.aluno.nome)}</td>
                  <td class="mono">${l.total}</td>
                  <td class="mono">${l.presentes}</td>
                  <td class="mono">${l.faltas}</td>
                  <td class="mono">${l.pct ?? '—'}${l.pct !== null ? '%' : ''}</td>
                  <td>${l.pct === null ? badge('Sem registos', 'gray') : emRiscoPorFaltas(l.pct) ? badge('Risco de Reprovação por Faltas', 'red') : badge('Normal', 'green')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        `}
      </div>
    </section>
  `;
  document.getElementById('btnVoltarChamada').onclick = () => renderFrequencia(aulaId);
  document.getElementById('fltTurmaExtrato').onchange = e => renderFrequenciaExtrato(e.target.value);
  const aulaExtrato = byId(state.aulas, aulaId);
  const tituloExtrato = `Extrato de Frequência — ${disciplinaNome(aulaExtrato?.disciplinaId)} (${turmaCodigo(byId(state.turmas, aulaExtrato?.turmaId))})`;
  document.getElementById('btnImprimirExtrato').onclick = () => imprimirSecao(tituloExtrato);
  document.getElementById('btnExportarExtrato').onclick = () => exportarExcel(
    `extrato_frequencia_${turmaCodigo(byId(state.turmas, aulaExtrato?.turmaId))}_${aulaExtrato?.disciplinaId}`,
    'Frequência',
    linhas.map(l => ({
      'Nº': l.aluno.numero,
      'Nome do Estudante': l.aluno.nome,
      'Aulas Dadas': l.total,
      'Presenças': l.presentes,
      'Faltas': l.faltas,
      '% Frequência': l.pct ?? '',
      'Situação': l.pct === null ? 'Sem registos' : (emRiscoPorFaltas(l.pct) ? 'Risco de Reprovação por Faltas' : 'Normal'),
    }))
  );
}

/* ================================== Trabalhos ================================= */
/* Trabalho de grupo atribuído pelo docente a uma turma: tema, duração (dias),
   cotação e os alunos selecionados como integrantes (a partir do roster da
   turma). Cada integrante tem de aceitar a adesão antes de poder submeter um
   ficheiro — ver painel correspondente em "Meu Painel" (renderMeuPainel). */

function integrantesDoTrabalho(trabalhoId) {
  return state.trabalhoIntegrantes.filter(ti => ti.trabalhoId === trabalhoId);
}
function ficheiroDoIntegrante(trabalhoId, alunoId) {
  return state.trabalhoFicheiros.find(tf => tf.trabalhoId === trabalhoId && tf.alunoId === alunoId) || null;
}

function renderTrabalhos(selTurmaId) {
  const turmas = scopedTurmasDoProfessor();
  const canCreate = hasPerm('trabalhos', 'create');
  const canEdit = hasPerm('trabalhos', 'edit');
  const canDelete = hasPerm('trabalhos', 'delete');
  if (!turmas.length) {
    document.getElementById('content').innerHTML = `<section class="section active">${lockedNote('Nenhuma turma disponível.')}</section>`;
    return;
  }
  const turmaId = selTurmaId || turmas[0].id;
  const rows = state.trabalhos.filter(tb => tb.turmaId === turmaId);

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="toolbar">
        <select class="input" id="fltTurmaTrabalho">
          ${turmas.map(t => `<option value="${t.id}" ${t.id === turmaId ? 'selected' : ''}>[${esc(turmaCodigo(t))}] ${esc(cursoNome(t.cursoId))}</option>`).join('')}
        </select>
        <div class="spacer"></div>
        ${canCreate ? `<button class="btn btn-primary" id="btnNovoTrabalho">+ Atribuir trabalho</button>` : ''}
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Tema</th><th>Duração</th><th>Cotação</th><th>Integrantes</th><th>Adesões</th><th>Ficheiros entregues</th><th></th></tr></thead>
        <tbody>
          ${rows.length === 0 ? `<tr class="empty-row"><td colspan="7">Nenhum trabalho atribuído a esta turma.</td></tr>` : rows.map(tb => {
            const integrantes = integrantesDoTrabalho(tb.id);
            const aceites = integrantes.filter(i => i.aceite === true).length;
            const recusados = integrantes.filter(i => i.aceite === false).length;
            const pendentes = integrantes.filter(i => i.aceite === null).length;
            const entregues = integrantes.filter(i => ficheiroDoIntegrante(tb.id, i.alunoId)).length;
            return `
              <tr>
                <td>${esc(tb.tema)}</td>
                <td class="mono">${tb.duracaoDias} dia(s)</td>
                <td class="mono">${tb.cotacao} val.</td>
                <td class="mono">${integrantes.length}</td>
                <td>${badge(`${aceites} aceite(s)`, 'green')} ${badge(`${pendentes} pendente(s)`, 'amber')} ${badge(`${recusados} recusado(s)`, 'red')}</td>
                <td class="mono">${entregues} / ${integrantes.length}</td>
                <td class="row-actions">
                  <button class="btn btn-sm" data-ver-trabalho="${tb.id}">Ver</button>
                  ${canEdit ? `<button class="btn btn-sm" data-edit-trabalho="${tb.id}">Editar</button>` : ''}
                  ${canDelete ? `<button class="btn btn-sm btn-danger" data-del-trabalho="${tb.id}">Remover</button>` : ''}
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </section>
  `;
  document.getElementById('fltTurmaTrabalho').onchange = e => renderTrabalhos(e.target.value);
  const btnNovo = document.getElementById('btnNovoTrabalho');
  if (btnNovo) btnNovo.onclick = () => openTrabalhoForm(turmaId);
  rows.forEach(tb => {
    const verBtn = document.querySelector(`[data-ver-trabalho="${tb.id}"]`);
    const editBtn = document.querySelector(`[data-edit-trabalho="${tb.id}"]`);
    const delBtn = document.querySelector(`[data-del-trabalho="${tb.id}"]`);
    if (verBtn) verBtn.onclick = () => openTrabalhoDetalhe(tb.id, turmaId);
    if (editBtn) editBtn.onclick = () => openTrabalhoForm(turmaId, tb.id);
    if (delBtn) delBtn.onclick = () => deleteTrabalho(tb.id, turmaId);
  });
}

function openTrabalhoForm(turmaId, id) {
  if (id ? !hasPerm('trabalhos', 'edit') : !hasPerm('trabalhos', 'create')) return;
  const tb = id ? byId(state.trabalhos, id) : null;
  const roster = turmaRoster(turmaId);
  const integrantesAtuais = tb ? integrantesDoTrabalho(tb.id).map(i => i.alunoId) : [];
  openModal(tb ? 'Editar trabalho' : 'Atribuir trabalho à turma', `
    <div class="form-grid">
      <div class="field span-2"><label>Tema</label><textarea id="fTema" placeholder="Tema do trabalho...">${esc(tb?.tema || '')}</textarea></div>
      <div class="field"><label>Duração (dias)</label><input id="fDuracao" type="number" min="1" value="${tb?.duracaoDias || 15}"></div>
      <div class="field"><label>Cotação (valores)</label><input id="fCotacao" type="number" min="0" max="20" step="0.5" value="${tb?.cotacao ?? 20}"></div>
      <div class="field span-2"><label>Integrantes (selecione os alunos da turma)</label>
        <div class="table-wrap" style="max-height:220px; overflow-y:auto;">
          ${roster.length === 0 ? '<p class="text-muted" style="padding:10px;">Sem alunos matriculados nesta turma.</p>' : roster.map(a => `
            <label style="display:flex; align-items:center; gap:8px; padding:6px 10px; border-bottom:1px solid var(--border);">
              <input type="checkbox" data-integrante="${a.id}" ${integrantesAtuais.includes(a.id) ? 'checked' : ''}>
              <span>${esc(a.numero)} — ${esc(a.nome)}</span>
            </label>
          `).join('')}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Guardar</button>
    </div>
  `, () => {
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('btnSave').onclick = () => {
      const tema = document.getElementById('fTema').value.trim();
      if (!tema) { toast('Indique o tema do trabalho.'); return; }
      const selecionados = roster.filter(a => document.querySelector(`[data-integrante="${a.id}"]`)?.checked).map(a => a.id);
      if (selecionados.length === 0) { toast('Selecione pelo menos um integrante.'); return; }
      const payload = {
        turmaId,
        tema,
        duracaoDias: Number(document.getElementById('fDuracao').value) || 15,
        cotacao: Number(document.getElementById('fCotacao').value) || 0,
      };
      let trabalho;
      const jaExistia = !!tb;
      if (tb) { Object.assign(tb, payload); trabalho = tb; }
      else { trabalho = { id: nextId('tb'), criadoEm: hoje(), criadoPor: currentUser.id, ...payload }; state.trabalhos.push(trabalho); }

      // sincroniza integrantes: remove quem foi desmarcado, adiciona quem é novo
      state.trabalhoIntegrantes = state.trabalhoIntegrantes.filter(ti => ti.trabalhoId !== trabalho.id || selecionados.includes(ti.alunoId));
      selecionados.forEach(alunoId => {
        if (!state.trabalhoIntegrantes.some(ti => ti.trabalhoId === trabalho.id && ti.alunoId === alunoId)) {
          state.trabalhoIntegrantes.push({ id: nextId('ti'), trabalhoId: trabalho.id, alunoId, aceite: null, respondidoEm: null });
        }
      });
      registrarLog(jaExistia ? 'Editar' : 'Criar', 'trabalhos', `Trabalho ${jaExistia ? 'editado' : 'atribuído'}: "${tema}" — turma ${turmaCodigo(byId(state.turmas, turmaId) || {})} (${selecionados.length} integrante(s)).`);
      saveState();
      closeModal();
      toast('Trabalho guardado.');
      renderTrabalhos(turmaId);
    };
  });
}

function deleteTrabalho(id, turmaId) {
  if (!hasPerm('trabalhos', 'delete')) return;
  const alvo = byId(state.trabalhos, id);
  if (!confirm('Remover este trabalho? Adesões e ficheiros entregues também serão eliminados.')) return;
  state.trabalhos = state.trabalhos.filter(tb => tb.id !== id);
  state.trabalhoIntegrantes = state.trabalhoIntegrantes.filter(ti => ti.trabalhoId !== id);
  state.trabalhoFicheiros = state.trabalhoFicheiros.filter(tf => tf.trabalhoId !== id);
  registrarLog('Remover', 'trabalhos', `Trabalho removido: "${alvo?.tema || id}"`);
  saveState();
  toast('Trabalho removido.');
  renderTrabalhos(turmaId);
}

function openTrabalhoDetalhe(trabalhoId, turmaId) {
  const tb = byId(state.trabalhos, trabalhoId);
  const integrantes = integrantesDoTrabalho(trabalhoId);
  const statusLabel = { true: 'Aceite', false: 'Recusado', null: 'Pendente' };
  const statusTone = { true: 'green', false: 'red', null: 'amber' };
  openModal(`Trabalho — ${esc(tb.tema)}`, `
    <p class="text-muted" style="font-size:12.5px;">Duração: ${tb.duracaoDias} dia(s) · Cotação: ${tb.cotacao} valores</p>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Aluno</th><th>Adesão</th><th>Ficheiro entregue</th><th></th></tr></thead>
      <tbody>
        ${integrantes.map(i => {
          const aluno = byId(state.alunos, i.alunoId);
          const ficheiro = ficheiroDoIntegrante(trabalhoId, i.alunoId);
          return `
            <tr>
              <td>${esc(aluno?.nome || i.alunoId)}</td>
              <td>${badge(statusLabel[i.aceite], statusTone[i.aceite])}</td>
              <td>${ficheiro ? `${esc(ficheiro.nomeFicheiro)} (${fmtTamanho(ficheiro.tamanho)})` : '—'}</td>
              <td class="row-actions">${ficheiro ? `<button class="btn btn-sm" data-descarregar-tf="${i.alunoId}">Descarregar</button>` : ''}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table></div>
    <div class="modal-footer">
      <button class="btn" id="btnFechar">Fechar</button>
    </div>
  `, () => {
    document.getElementById('btnFechar').onclick = closeModal;
    integrantes.forEach(i => {
      const btn = document.querySelector(`[data-descarregar-tf="${i.alunoId}"]`);
      if (btn) btn.onclick = () => {
        const ficheiro = ficheiroDoIntegrante(trabalhoId, i.alunoId);
        descarregarFicheiroArmazenado(ficheiro.nomeFicheiro, ficheiro.conteudo);
      };
    });
  });
}

/* ================================== Materiais ================================= */
/* Materiais de apoio por unidade curricular (disciplina) — o docente publica
   um ficheiro ou um link, os alunos do curso correspondente veem-nos em
   "Meu Painel" (ver renderMeuPainel). */

function renderMateriais(selDisciplinaId) {
  const disciplinas = scopedDisciplinas();
  const canCreate = hasPerm('materiais', 'create');
  const canDelete = hasPerm('materiais', 'delete');
  if (!disciplinas.length) {
    document.getElementById('content').innerHTML = `<section class="section active">${lockedNote('Nenhuma disciplina disponível.')}</section>`;
    return;
  }
  const disciplinaId = selDisciplinaId || disciplinas[0].id;
  const rows = state.materiais.filter(m => m.disciplinaId === disciplinaId);

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="toolbar">
        <select class="input" id="fltDiscMaterial">
          ${disciplinas.map(d => `<option value="${d.id}" ${d.id === disciplinaId ? 'selected' : ''}>${esc(d.nome)} (${esc(cursoNome(d.cursoId))})</option>`).join('')}
        </select>
        <div class="spacer"></div>
        ${canCreate ? `<button class="btn btn-primary" id="btnNovoMaterial">+ Publicar material</button>` : ''}
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Título</th><th>Descrição</th><th>Tipo</th><th>Publicado em</th><th></th></tr></thead>
        <tbody>
          ${rows.length === 0 ? `<tr class="empty-row"><td colspan="5">Nenhum material publicado para esta disciplina.</td></tr>` : rows.map(m => `
            <tr>
              <td>${esc(m.titulo)}</td>
              <td>${esc(m.descricao || '—')}</td>
              <td>${m.link ? 'Link' : esc(m.tipoFicheiro || 'Ficheiro')}</td>
              <td>${fmtDate(m.publicadoEm)}</td>
              <td class="row-actions">
                ${m.link ? `<a class="btn btn-sm" href="${esc(m.link)}" target="_blank" rel="noopener">Abrir</a>` : `<button class="btn btn-sm" data-descarregar-material="${m.id}">Descarregar</button>`}
                ${canDelete ? `<button class="btn btn-sm btn-danger" data-del-material="${m.id}">Remover</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table></div>
    </section>
  `;
  document.getElementById('fltDiscMaterial').onchange = e => renderMateriais(e.target.value);
  const btnNovo = document.getElementById('btnNovoMaterial');
  if (btnNovo) btnNovo.onclick = () => openMaterialForm(disciplinaId);
  rows.forEach(m => {
    const dlBtn = document.querySelector(`[data-descarregar-material="${m.id}"]`);
    const delBtn = document.querySelector(`[data-del-material="${m.id}"]`);
    if (dlBtn) dlBtn.onclick = () => descarregarFicheiroArmazenado(m.nomeFicheiro, m.conteudo);
    if (delBtn) delBtn.onclick = () => deleteMaterial(m.id, disciplinaId);
  });
}

function openMaterialForm(disciplinaId) {
  if (!hasPerm('materiais', 'create')) return;
  openModal('Publicar material', `
    <div class="form-grid">
      <div class="field span-2"><label>Título</label><input id="fTitulo" placeholder="Ex.: Slides — Aula 1"></div>
      <div class="field span-2"><label>Descrição (opcional)</label><input id="fDescricao"></div>
      <div class="field span-2"><label>Link (opcional — se preenchido, ignora o ficheiro abaixo)</label><input id="fLink" placeholder="https://..."></div>
      <div class="field span-2"><label>Ou carregar ficheiro (máx. 5 MB)</label><input id="fFicheiro" type="file"></div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Publicar</button>
    </div>
  `, () => {
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('btnSave').onclick = () => {
      const titulo = document.getElementById('fTitulo').value.trim();
      if (!titulo) { toast('Indique o título do material.'); return; }
      const descricao = document.getElementById('fDescricao').value.trim();
      const link = document.getElementById('fLink').value.trim();
      const file = document.getElementById('fFicheiro').files[0];

      function gravar(extra) {
        const material = {
          id: nextId('mt'), disciplinaId, titulo, descricao: descricao || null,
          link: link || null, nomeFicheiro: null, tipoFicheiro: null, tamanho: null, conteudo: null,
          publicadoPor: currentUser.id, publicadoEm: hoje(),
          ...extra,
        };
        state.materiais.push(material);
        registrarLog('Criar', 'materiais', `Material publicado: "${titulo}" — ${disciplinaNome(disciplinaId)}.`);
        saveState();
        closeModal();
        toast('Material publicado.');
        renderMateriais(disciplinaId);
      }

      if (!link && file) {
        lerFicheiroComoDataURL(file, 5 * 1024 * 1024, (dataUrl) => {
          gravar({ nomeFicheiro: file.name, tipoFicheiro: file.type, tamanho: file.size, conteudo: dataUrl });
        }, (msg) => toast(msg));
      } else if (!link && !file) {
        toast('Indique um link ou carregue um ficheiro.');
      } else {
        gravar({});
      }
    };
  });
}

function deleteMaterial(id, disciplinaId) {
  if (!hasPerm('materiais', 'delete')) return;
  if (!confirm('Remover este material?')) return;
  const alvo = byId(state.materiais, id);
  state.materiais = state.materiais.filter(m => m.id !== id);
  registrarLog('Remover', 'materiais', `Material removido: "${alvo?.titulo || id}"`);
  saveState();
  toast('Material removido.');
  renderMateriais(disciplinaId);
}

/* ================================== Financeiro ================================= */

function renderFinanceiro(filter = {}) {
  const canCreate = hasPerm('financeiro', 'create');
  const canEdit = hasPerm('financeiro', 'edit');
  const canDelete = hasPerm('financeiro', 'delete');
  const filterStatus = filter.status || '';
  const filterAno = filter.ano || '';
  const filterTurno = filter.turno || '';
  const filterRegime = filter.regime || '';

  const anosDisponiveis = [...new Set(state.financeiro.map(f => f.anoLetivo))].sort((a, b) => b - a);

  const rows = state.financeiro.filter(f => {
    if (filterStatus && f.status !== filterStatus) return false;
    if (filterAno && String(f.anoLetivo) !== filterAno) return false;
    if (filterTurno && f.turno !== filterTurno) return false;
    if (filterRegime && f.regime !== filterRegime) return false;
    return true;
  });
  const total = rows.reduce((s, f) => s + f.valor, 0);

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="toolbar">
        <select class="input" id="fltStatusFin">
          <option value="">Todos os estados</option>
          ${['Pago', 'Pendente', 'Atrasado'].map(s => `<option ${s === filterStatus ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <select class="input" id="fltAnoFin">
          <option value="">Todos os anos</option>
          ${anosDisponiveis.map(a => `<option value="${a}" ${String(a) === filterAno ? 'selected' : ''}>${anoLetivoLabel(a)}</option>`).join('')}
        </select>
        <select class="input" id="fltTurnoFin">
          <option value="">Todos os períodos</option>
          ${state.periodosEstudo.map(p => `<option value="${p.id}" ${p.id === filterTurno ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
        </select>
        <select class="input" id="fltRegimeFin">
          <option value="">Todos os regimes</option>
          ${REGIMES.map(r => `<option ${r === filterRegime ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
        <div class="spacer"></div>
        <span class="text-muted" style="font-size:12.5px;">Total filtrado: <strong>${fmtMoney(total)}</strong></span>
        <button class="btn" id="btnExportarFinanceiro">Exportar Excel</button>
        ${canCreate ? `<button class="btn btn-primary" id="btnNovoLancamento">+ Novo lançamento</button>` : ''}
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Aluno</th><th>Descrição</th><th>Ano</th><th>Período</th><th>Regime</th><th>Vencimento</th><th class="text-right">Valor</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${rows.length === 0 ? `<tr class="empty-row"><td colspan="9">Nenhum lançamento encontrado.</td></tr>` : rows.map(f => `
            <tr>
              <td>${esc(alunoNome(f.alunoId))}</td>
              <td>${esc(f.descricao)}</td>
              <td>${anoLetivoLabel(f.anoLetivo)}</td>
              <td>${esc(periodoEstudoNome(f.turno))}</td>
              <td>${esc(f.regime)}</td>
              <td>${fmtDate(f.vencimento)}</td>
              <td class="text-right mono">${fmtMoney(f.valor)}</td>
              <td>${statusBadge(f.status)}</td>
              <td class="row-actions">
                ${f.status !== 'Pago' && canEdit ? `<button class="btn btn-sm" data-pay-fin="${f.id}">Marcar pago</button>` : ''}
                ${f.status === 'Pago' ? `<button class="btn btn-sm" data-recibo-fin="${f.id}">Recibo</button>` : ''}
                ${canEdit ? `<button class="btn btn-sm" data-edit-fin="${f.id}">Editar</button>` : ''}
                ${canDelete ? `<button class="btn btn-sm btn-danger" data-del-fin="${f.id}">Remover</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table></div>
    </section>
  `;
  document.getElementById('fltStatusFin').onchange = e => renderFinanceiro({ ...filter, status: e.target.value });
  document.getElementById('fltAnoFin').onchange = e => renderFinanceiro({ ...filter, ano: e.target.value });
  document.getElementById('fltTurnoFin').onchange = e => renderFinanceiro({ ...filter, turno: e.target.value });
  document.getElementById('fltRegimeFin').onchange = e => renderFinanceiro({ ...filter, regime: e.target.value });
  const btnNovo = document.getElementById('btnNovoLancamento');
  if (btnNovo) btnNovo.onclick = () => openFinanceiroForm();
  document.getElementById('btnExportarFinanceiro').onclick = () => exportarExcel('financeiro', 'Financeiro', rows.map(f => ({
    'Aluno': alunoNome(f.alunoId), 'Descrição': f.descricao, 'Ano Letivo': anoLetivoLabel(f.anoLetivo),
    'Período': periodoEstudoNome(f.turno), 'Regime': f.regime, 'Vencimento': fmtDate(f.vencimento),
    'Valor': f.valor, 'Estado': f.status, 'Data de Pagamento': f.dataPagamento ? fmtDate(f.dataPagamento) : '',
  })));
  rows.forEach(f => {
    const editBtn = document.querySelector(`[data-edit-fin="${f.id}"]`);
    const delBtn = document.querySelector(`[data-del-fin="${f.id}"]`);
    const payBtn = document.querySelector(`[data-pay-fin="${f.id}"]`);
    const reciboBtn = document.querySelector(`[data-recibo-fin="${f.id}"]`);
    if (editBtn) editBtn.onclick = () => openFinanceiroForm(f.id);
    if (delBtn) delBtn.onclick = () => deleteFinanceiro(f.id);
    if (payBtn) payBtn.onclick = () => marcarPago(f.id);
    if (reciboBtn) reciboBtn.onclick = () => renderRecibo(f.id);
  });
}

function marcarPago(id) {
  if (!hasPerm('financeiro', 'edit')) return;
  const f = byId(state.financeiro, id);
  f.status = 'Pago';
  f.dataPagamento = hoje();
  assegurarRecibo(f);
  registrarLog('Editar', 'financeiro', `Pagamento registado: ${alunoNome(f.alunoId)} — ${f.descricao} (${fmtMoney(f.valor)}). Recibo ${f.numeroRecibo}.`);
  saveState();
  toast('Pagamento registado. Recibo gerado.');
  renderRecibo(f.id);
}

function openFinanceiroForm(id) {
  if (!hasPerm('financeiro', id ? 'edit' : 'create')) return;
  const f = id ? byId(state.financeiro, id) : null;
  openModal(f ? 'Editar lançamento' : 'Novo lançamento', `
    <div class="form-grid">
      ${alunoBuscaFieldHtml(f?.alunoId)}
      <div class="field span-2"><label>Descrição</label><input id="fDesc" value="${esc(f?.descricao || '')}" placeholder="Ex.: Propina — Julho 2026"></div>
      <div class="field"><label>Valor (Kz)</label><input id="fValor" type="number" min="0" step="100" value="${f?.valor ?? ''}"></div>
      <div class="field"><label>Vencimento</label><input id="fVenc" type="date" value="${f?.vencimento || ''}"></div>
      <div class="field"><label>Ano letivo</label><input id="fAnoLetivoFin" type="number" value="${f?.anoLetivo || state.anoLetivo}"></div>
      <div class="field"><label>Estado</label>
        <select id="fStatus">${['Pendente', 'Pago', 'Atrasado'].map(s => `<option ${f?.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Período</label>
        <select id="fTurnoFin">${state.periodosEstudo.map(p => `<option value="${p.id}" ${f?.turno === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Regime</label>
        <select id="fRegimeFin">${REGIMES.map(r => `<option ${f?.regime === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Guardar</button>
    </div>
  `, () => {
    const getAlunoId = wireAlunoBusca(f?.alunoId);
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('btnSave').onclick = () => {
      const desc = document.getElementById('fDesc').value.trim();
      const valor = Number(document.getElementById('fValor').value);
      if (!desc || !valor) { toast('Preencha a descrição e o valor.'); return; }
      const alunoId = getAlunoId();
      if (!alunoId) { toast('Procure o aluno pelo número de matrícula antes de guardar.'); return; }
      const status = document.getElementById('fStatus').value;
      const payload = {
        alunoId,
        descricao: desc,
        valor,
        vencimento: document.getElementById('fVenc').value,
        status,
        anoLetivo: Number(document.getElementById('fAnoLetivoFin').value) || state.anoLetivo,
        turno: document.getElementById('fTurnoFin').value,
        regime: document.getElementById('fRegimeFin').value,
        dataPagamento: status === 'Pago' ? (f?.dataPagamento || hoje()) : null,
      };
      const jaExistia = !!f;
      const passouAPago = status === 'Pago' && f?.status !== 'Pago';
      let alvo;
      if (f) { Object.assign(f, payload); alvo = f; }
      else { alvo = { id: nextId('fi'), ...payload }; state.financeiro.push(alvo); }
      if (passouAPago) assegurarRecibo(alvo);
      registrarLog(jaExistia ? 'Editar' : 'Criar', 'financeiro', `Lançamento ${jaExistia ? 'editado' : 'criado'}: ${alunoNome(payload.alunoId)} — ${payload.descricao} (${fmtMoney(payload.valor)}).${passouAPago ? ` Recibo ${alvo.numeroRecibo}.` : ''}`);
      saveState();
      closeModal();
      toast(passouAPago ? 'Lançamento guardado. Recibo gerado.' : 'Lançamento guardado.');
      if (passouAPago) renderRecibo(alvo.id);
      else renderFinanceiro();
    };
  });
}

function deleteFinanceiro(id) {
  if (!hasPerm('financeiro', 'delete')) return;
  if (!confirm('Remover este lançamento financeiro?')) return;
  const alvo = byId(state.financeiro, id);
  state.financeiro = state.financeiro.filter(f => f.id !== id);
  registrarLog('Remover', 'financeiro', `Lançamento removido: ${alvo ? alunoNome(alvo.alunoId) + ' — ' + alvo.descricao : id}`);
  saveState();
  toast('Lançamento removido.');
  renderFinanceiro();
}

/* --------------------------------- Recibo --------------------------------- */
/* Gerado automaticamente sempre que um lançamento passa a "Pago" (via
   "Marcar pago" ou ao guardar o formulário com Estado = Pago) — numeração
   sequencial por ano letivo, formato RC-{anoLetivo}-{sequencial}. O recibo
   sai em DUPLICADO (Via do Cliente + Via da Instituição) numa única folha,
   pronto a imprimir com o mesmo mecanismo já usado no Extrato de Frequência. */
function gerarNumeroRecibo() {
  const ano = state.anoLetivo;
  const prefix = `RC-${ano}-`;
  let max = 0;
  state.financeiro.forEach(f => {
    if (f.numeroRecibo && f.numeroRecibo.startsWith(prefix)) {
      const n = parseInt(f.numeroRecibo.slice(prefix.length), 10);
      if (!isNaN(n)) max = Math.max(max, n);
    }
  });
  return prefix + String(max + 1).padStart(4, '0');
}
/* Garante que o lançamento tem número de recibo (gera na primeira vez que
   fica Pago; reimpressões posteriores reutilizam o mesmo número). */
function assegurarRecibo(f) {
  if (!f.numeroRecibo) {
    f.numeroRecibo = gerarNumeroRecibo();
    f.dataEmissaoRecibo = hoje();
  }
}
function reciboViaHtml(f, aluno, viaLabel) {
  return `
    <div class="recibo-via">
      <div class="recibo-header">
        <div>
          <strong>SIGA — Sistema Integrado de Gestão Académica</strong>
          <div class="text-muted" style="font-size:11.5px;">Recibo de Pagamento</div>
        </div>
        <div style="text-align:right;">
          <div><strong>Nº ${esc(f.numeroRecibo)}</strong></div>
          <div class="text-muted" style="font-size:11.5px;">Emitido em ${fmtDate(f.dataEmissaoRecibo)}</div>
        </div>
      </div>
      <div class="recibo-via-label">${esc(viaLabel)}</div>
      <table class="recibo-tabela">
        <tr><td>Aluno</td><td>${esc(aluno?.nome || '—')} (${esc(aluno?.numero || '—')})</td></tr>
        <tr><td>Descrição</td><td>${esc(f.descricao)}</td></tr>
        <tr><td>Ano Letivo</td><td>${anoLetivoLabel(f.anoLetivo)}</td></tr>
        <tr><td>Período / Regime</td><td>${esc(periodoEstudoNome(f.turno))} / ${esc(f.regime)}</td></tr>
        <tr><td>Data de Pagamento</td><td>${fmtDate(f.dataPagamento)}</td></tr>
        <tr class="recibo-valor"><td>Valor Pago</td><td><strong>${fmtMoney(f.valor)}</strong></td></tr>
      </table>
      <div class="recibo-assinatura">Recebido por: _____________________________</div>
    </div>`;
}
function renderRecibo(financeiroId) {
  const f = byId(state.financeiro, financeiroId);
  if (!f) { renderFinanceiro(); return; }
  if (!f.numeroRecibo) { assegurarRecibo(f); saveState(); }
  const aluno = byId(state.alunos, f.alunoId);
  document.getElementById('pageTitle').textContent = `Recibo ${f.numeroRecibo}`;
  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="toolbar no-print">
        <button class="btn" id="btnVoltarRecibo">← Voltar ao Financeiro</button>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="btnImprimirRecibo">Imprimir Recibo (PDF)</button>
      </div>
      <div class="recibo-folha">
        ${reciboViaHtml(f, aluno, '1ª Via — Via do Cliente')}
        <div class="recibo-corte no-print">✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>
        ${reciboViaHtml(f, aluno, '2ª Via — Via da Instituição')}
      </div>
    </section>
  `;
  document.getElementById('btnVoltarRecibo').onclick = () => renderFinanceiro();
  document.getElementById('btnImprimirRecibo').onclick = () => imprimirSecao(`Recibo ${f.numeroRecibo}`);
}

/* ================================== Biblioteca ================================= */

function renderBiblioteca(view) {
  if (view === 'relatorio') return renderRelatorioLeitura();
  const canCreate = hasPerm('biblioteca', 'create');
  const canEdit = hasPerm('biblioteca', 'edit');
  const canDelete = hasPerm('biblioteca', 'delete');
  const emprestimosAtivos = state.emprestimos.filter(e => e.tipo !== 'Leitura Local' && !e.dataDevolucao);
  const leiturasLocais = state.emprestimos.filter(e => e.tipo === 'Leitura Local').slice().reverse();

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn" id="btnExportarLivros">Exportar Excel (Catálogo)</button>
        <button class="btn" id="btnExportarObras">Exportar lista de obras (por norma)</button>
        <button class="btn" id="btnExportarEmprestimos">Exportar Excel (Empréstimos)</button>
        <button class="btn" id="btnVerRelatorio">Relatório de Leitura</button>
        ${canCreate ? `<button class="btn" id="btnNovoEmprestimo">+ Registar empréstimo/leitura</button>` : ''}
        ${canCreate ? `<button class="btn btn-primary" id="btnNovoLivro">+ Novo livro</button>` : ''}
      </div>

      <div class="panel">
        <h3>Catálogo</h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Título</th><th>Autor</th><th>Categoria</th><th>Exemplares</th><th>Disponíveis</th><th>Norma</th><th>Referência</th><th></th></tr></thead>
          <tbody>
            ${state.livros.map(l => `
              <tr>
                <td>${esc(l.titulo)}</td>
                <td>${esc(l.autor)}</td>
                <td>${esc(l.categoria)}</td>
                <td>${l.exemplares}</td>
                <td>${badge(l.disponiveis, l.disponiveis > 0 ? 'green' : 'red')}</td>
                <td>${esc(l.normaCitacao || 'APA')}</td>
                <td style="max-width:260px;"><span title="${esc(formatarCitacao(l, l.normaCitacao || 'APA'))}" style="font-size:12px; color:var(--muted); display:inline-block; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; vertical-align:middle;">${esc(formatarCitacao(l, l.normaCitacao || 'APA'))}</span></td>
                <td class="row-actions">
                  ${canEdit ? `<button class="btn btn-sm" data-edit-livro="${l.id}">Editar</button>` : ''}
                  ${canDelete ? `<button class="btn btn-sm btn-danger" data-del-livro="${l.id}">Remover</button>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table></div>
      </div>

      <div class="panel">
        <h3>Empréstimos ativos</h3>
        ${emprestimosAtivos.length === 0 ? '<p class="text-muted">Nenhum livro emprestado de momento.</p>' : `
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Livro</th><th>Aluno</th><th>Emprestado em</th><th>Devolução prevista</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              ${emprestimosAtivos.map(e => `
                <tr>
                  <td>${esc(livroTitulo(e.livroId))}</td>
                  <td>${esc(alunoNome(e.alunoId))}</td>
                  <td>${fmtDate(e.dataEmprestimo)}</td>
                  <td>${fmtDate(e.dataPrevista)}</td>
                  <td>${statusBadge(emprestimoStatus(e))}</td>
                  <td class="row-actions">
                    ${canEdit ? `<button class="btn btn-sm" data-devolver="${e.id}">Registar devolução</button>` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        `}
      </div>

      <div class="panel">
        <h3>Controlo de leitura no local</h3>
        <div class="panel-sub">Consultas de livros dentro da biblioteca, sem saírem do local (não contam como empréstimo).</div>
        ${leiturasLocais.length === 0 ? '<p class="text-muted">Sem registos de leitura no local.</p>' : `
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Livro</th><th>Aluno</th><th>Data</th></tr></thead>
            <tbody>
              ${leiturasLocais.map(e => `
                <tr>
                  <td>${esc(livroTitulo(e.livroId))}</td>
                  <td>${esc(alunoNome(e.alunoId))}</td>
                  <td>${fmtDate(e.dataEmprestimo)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        `}
      </div>
    </section>
  `;

  const btnNovoLivro = document.getElementById('btnNovoLivro');
  const btnNovoEmprestimo = document.getElementById('btnNovoEmprestimo');
  if (btnNovoLivro) btnNovoLivro.onclick = () => openLivroForm();
  if (btnNovoEmprestimo) btnNovoEmprestimo.onclick = () => openEmprestimoForm();
  document.getElementById('btnVerRelatorio').onclick = () => renderBiblioteca('relatorio');
  document.getElementById('btnExportarObras').onclick = () => openExportarObrasForm();
  document.getElementById('btnExportarLivros').onclick = () => exportarExcel('biblioteca_catalogo', 'Catálogo', state.livros.map(l => ({
    'Título': l.titulo, 'Autor': l.autor, 'Categoria': l.categoria, 'Exemplares': l.exemplares, 'Disponíveis': l.disponiveis,
    'Editora': l.editora || '', 'Local': l.local || '', 'Ano': l.anoPublicacao || '', 'Edição': l.edicao || '', 'ISBN': l.isbn || '',
    'Norma': l.normaCitacao || 'APA', 'Referência': formatarCitacao(l, l.normaCitacao || 'APA'),
  })));
  document.getElementById('btnExportarEmprestimos').onclick = () => exportarExcel('biblioteca_emprestimos', 'Empréstimos', state.emprestimos.map(e => ({
    'Livro': livroTitulo(e.livroId), 'Aluno': alunoNome(e.alunoId), 'Tipo': e.tipo || 'Emprestimo', 'Emprestado em': fmtDate(e.dataEmprestimo),
    'Devolução Prevista': fmtDate(e.dataPrevista), 'Estado': e.tipo === 'Leitura Local' ? 'Leitura Local' : emprestimoStatus(e),
  })));

  state.livros.forEach(l => {
    const editBtn = document.querySelector(`[data-edit-livro="${l.id}"]`);
    const delBtn = document.querySelector(`[data-del-livro="${l.id}"]`);
    if (editBtn) editBtn.onclick = () => openLivroForm(l.id);
    if (delBtn) delBtn.onclick = () => deleteLivro(l.id);
  });
  emprestimosAtivos.forEach(e => {
    const devBtn = document.querySelector(`[data-devolver="${e.id}"]`);
    if (devBtn) devBtn.onclick = () => registarDevolucao(e.id);
  });
}

function openLivroForm(id) {
  if (!hasPerm('biblioteca', id ? 'edit' : 'create')) return;
  const l = id ? byId(state.livros, id) : null;
  openModal(l ? 'Editar livro' : 'Novo livro', `
    <div class="form-grid">
      <div class="field span-2"><label>Título</label><input id="fTitulo" value="${esc(l?.titulo || '')}"></div>
      <div class="field"><label>Autor</label><input id="fAutor" value="${esc(l?.autor || '')}"></div>
      <div class="field"><label>Categoria</label><input id="fCategoria" value="${esc(l?.categoria || '')}"></div>
      <div class="field"><label>Editora</label><input id="fEditora" value="${esc(l?.editora || '')}"></div>
      <div class="field"><label>Local de edição</label><input id="fLocal" value="${esc(l?.local || '')}"></div>
      <div class="field"><label>Ano de publicação</label><input id="fAnoPub" type="number" value="${l?.anoPublicacao || ''}"></div>
      <div class="field"><label>Edição</label><input id="fEdicao" value="${esc(l?.edicao || '')}" placeholder="Ex.: 3"></div>
      <div class="field"><label>ISBN</label><input id="fIsbn" value="${esc(l?.isbn || '')}"></div>
      <div class="field"><label>Norma de citação</label>
        <select id="fNorma">${NORMAS_CITACAO.map(n => `<option ${(l?.normaCitacao || 'APA') === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Exemplares</label><input id="fExemplares" type="number" min="1" value="${l?.exemplares ?? 1}"></div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Guardar</button>
    </div>
  `, () => {
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('btnSave').onclick = () => {
      const titulo = document.getElementById('fTitulo').value.trim();
      if (!titulo) { toast('Indique o título do livro.'); return; }
      const exemplares = Number(document.getElementById('fExemplares').value) || 1;
      const emprestados = l ? l.exemplares - l.disponiveis : 0;
      const payload = {
        titulo,
        autor: document.getElementById('fAutor').value.trim(),
        categoria: document.getElementById('fCategoria').value.trim(),
        editora: document.getElementById('fEditora').value.trim() || null,
        local: document.getElementById('fLocal').value.trim() || null,
        anoPublicacao: Number(document.getElementById('fAnoPub').value) || null,
        edicao: document.getElementById('fEdicao').value.trim() || null,
        isbn: document.getElementById('fIsbn').value.trim() || null,
        normaCitacao: document.getElementById('fNorma').value,
        exemplares,
        disponiveis: Math.max(0, exemplares - emprestados),
      };
      const jaExistia = !!l;
      if (l) Object.assign(l, payload);
      else state.livros.push({ id: nextId('l'), ...payload });
      registrarLog(jaExistia ? 'Editar' : 'Criar', 'biblioteca', `Livro ${jaExistia ? 'editado' : 'criado'}: ${payload.titulo}`);
      saveState();
      closeModal();
      toast('Livro guardado.');
      renderBiblioteca();
    };
  });
}

function deleteLivro(id) {
  if (!hasPerm('biblioteca', 'delete')) return;
  const emUso = state.emprestimos.some(e => e.livroId === id && !e.dataDevolucao);
  if (emUso) { toast('Este livro tem empréstimos ativos — registe a devolução primeiro.'); return; }
  if (!confirm('Remover este livro do catálogo?')) return;
  const alvo = byId(state.livros, id);
  state.livros = state.livros.filter(l => l.id !== id);
  registrarLog('Remover', 'biblioteca', `Livro removido: ${alvo?.titulo || id}`);
  saveState();
  toast('Livro removido.');
  renderBiblioteca();
}

function openExportarObrasForm() {
  openModal('Exportar lista de obras', `
    <div class="field">
      <label>Norma de citação para a exportação</label>
      <select id="fNormaExport">${NORMAS_CITACAO.map(n => `<option>${n}</option>`).join('')}</select>
    </div>
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Exportar</button>
    </div>
  `, () => {
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('btnSave').onclick = () => {
      const norma = document.getElementById('fNormaExport').value;
      exportarExcel(`biblioteca_obras_${norma.replace(/\s+/g, '')}`, 'Obras', state.livros.map(l => ({
        'Título': l.titulo, 'Categoria': l.categoria, 'Norma': norma, 'Referência': formatarCitacao(l, norma),
      })));
      registrarLog('Backup', 'biblioteca', `Lista de obras exportada segundo a norma ${norma}.`);
      closeModal();
    };
  });
}

function openEmprestimoForm() {
  if (!hasPerm('biblioteca', 'create')) return;
  const livrosDisponiveis = state.livros.filter(l => l.disponiveis > 0);
  if (livrosDisponiveis.length === 0) { toast('Não há exemplares disponíveis de momento.'); return; }
  const h = hoje();
  openModal('Registar empréstimo / leitura no local', `
    <div class="form-grid">
      <div class="field span-2"><label>Livro</label>
        <select id="fLivro">${livrosDisponiveis.map(l => `<option value="${l.id}">${esc(l.titulo)} (${l.disponiveis} disponível(is))</option>`).join('')}</select>
      </div>
      ${alunoBuscaFieldHtml()}
      <div class="field span-2"><label>Tipo</label>
        <select id="fTipo">
          <option value="Emprestimo">Empréstimo (leva o livro)</option>
          <option value="Leitura Local">Leitura no local (consulta na biblioteca, não sai)</option>
        </select>
      </div>
      <div class="field"><label>Data</label><input id="fData" type="date" value="${h}"></div>
      <div class="field" id="wrapPrevista"><label>Devolução prevista</label><input id="fPrevista" type="date" value="${new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)}"></div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Registar</button>
    </div>
  `, () => {
    const getAlunoId = wireAlunoBusca();
    const fTipo = document.getElementById('fTipo');
    const wrapPrevista = document.getElementById('wrapPrevista');
    fTipo.onchange = () => { wrapPrevista.style.display = fTipo.value === 'Leitura Local' ? 'none' : ''; };
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('btnSave').onclick = () => {
      const livroId = document.getElementById('fLivro').value;
      const livro = byId(state.livros, livroId);
      if (!livro || livro.disponiveis <= 0) { toast('Sem exemplares disponíveis.'); return; }
      const alunoId = getAlunoId();
      if (!alunoId) { toast('Procure o aluno pelo número de matrícula antes de registar.'); return; }
      const tipo = fTipo.value;
      const data = document.getElementById('fData').value || h;
      const ehLeituraLocal = tipo === 'Leitura Local';
      state.emprestimos.push({
        id: nextId('e'),
        livroId,
        alunoId,
        tipo,
        dataEmprestimo: data,
        dataPrevista: ehLeituraLocal ? data : document.getElementById('fPrevista').value,
        dataDevolucao: ehLeituraLocal ? data : null,
      });
      // leitura no local não retira o exemplar de circulação
      if (!ehLeituraLocal) livro.disponiveis -= 1;
      registrarLog('Criar', 'biblioteca', `${ehLeituraLocal ? 'Leitura no local' : 'Empréstimo'} registado: ${livro.titulo} — ${alunoNome(alunoId)}.`);
      saveState();
      closeModal();
      toast(ehLeituraLocal ? 'Leitura no local registada.' : 'Empréstimo registado.');
      renderBiblioteca();
    };
  });
}

function registarDevolucao(id) {
  if (!hasPerm('biblioteca', 'edit')) return;
  const e = byId(state.emprestimos, id);
  if (!e) return;
  e.dataDevolucao = hoje();
  const livro = byId(state.livros, e.livroId);
  if (livro) livro.disponiveis = Math.min(livro.exemplares, livro.disponiveis + 1);
  registrarLog('Editar', 'biblioteca', `Devolução registada: ${livro?.titulo || e.livroId} — ${alunoNome(e.alunoId)}.`);
  saveState();
  toast('Devolução registada.');
  renderBiblioteca();
}

/* Relatório de leitura: agrega empréstimos + leituras no local por categoria
   do livro, destacando o aluno com mais leituras em cada categoria ("melhor
   leitor por área de especialidade"). */
function relatorioLeituraPorCategoria() {
  const porCategoria = {};
  state.emprestimos.forEach(e => {
    const livro = byId(state.livros, e.livroId);
    if (!livro) return;
    const cat = livro.categoria || 'Sem categoria';
    porCategoria[cat] = porCategoria[cat] || {};
    porCategoria[cat][e.alunoId] = (porCategoria[cat][e.alunoId] || 0) + 1;
  });
  return Object.keys(porCategoria).sort().map(categoria => {
    const ranking = Object.entries(porCategoria[categoria])
      .map(([alunoId, total]) => ({ alunoId, total }))
      .sort((a, b) => b.total - a.total);
    return { categoria, ranking };
  });
}

function renderRelatorioLeitura() {
  const relatorio = relatorioLeituraPorCategoria();
  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="toolbar">
        <button class="btn" id="btnVoltarBiblioteca">← Voltar à Biblioteca</button>
        <div class="spacer"></div>
        <button class="btn" id="btnExportarRelatorio">Exportar Excel</button>
      </div>
      <div class="panel">
        <h3>Relatório de Leitura — melhor leitor por área de especialidade</h3>
        <div class="panel-sub">Inclui empréstimos e leituras no local, agrupados pela categoria do livro.</div>
        ${relatorio.length === 0 ? '<p class="text-muted">Sem registos de leitura ainda.</p>' : relatorio.map(({ categoria, ranking }) => `
          <div class="panel" style="background:var(--bg); margin-bottom:10px;">
            <h4 style="margin:0 0 8px;">${esc(categoria)} ${ranking[0] ? badge(`Melhor leitor: ${alunoNome(ranking[0].alunoId)} (${ranking[0].total})`, 'green') : ''}</h4>
            <div class="table-wrap"><table class="data">
              <thead><tr><th>#</th><th>Aluno</th><th>Total de leituras</th></tr></thead>
              <tbody>
                ${ranking.map((r, i) => `<tr><td class="mono">${i + 1}</td><td>${esc(alunoNome(r.alunoId))}</td><td class="mono">${r.total}</td></tr>`).join('')}
              </tbody>
            </table></div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
  document.getElementById('btnVoltarBiblioteca').onclick = () => renderBiblioteca();
  document.getElementById('btnExportarRelatorio').onclick = () => {
    const linhas = [];
    relatorio.forEach(({ categoria, ranking }) => {
      ranking.forEach((r, i) => linhas.push({
        'Categoria': categoria, 'Posição': i + 1, 'Aluno': alunoNome(r.alunoId), 'Total de Leituras': r.total,
        'Melhor Leitor da Categoria': i === 0 ? 'Sim' : 'Não',
      }));
    });
    exportarExcel('relatorio_leitura', 'Relatório de Leitura', linhas);
  };
}

/* ============================== Recursos Humanos =============================== */

function renderRH() {
  const canCreate = hasPerm('rh', 'create');
  const canEdit = hasPerm('rh', 'edit');
  const canDelete = hasPerm('rh', 'delete');

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn" id="btnExportarRH">Exportar Excel</button>
        ${canCreate ? `<button class="btn btn-primary" id="btnNovoFuncionario">+ Novo funcionário</button>` : ''}
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th></th><th>Nome</th><th>Cargo</th><th>Departamento</th><th>Tipo</th><th>Admissão</th><th class="text-right">Salário</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${state.funcionarios.length === 0 ? `<tr class="empty-row"><td colspan="9">Nenhum funcionário registado.</td></tr>` : state.funcionarios.map(f => `
            <tr>
              <td>${avatarHtml(f.foto, f.nome)}</td>
              <td>${esc(f.nome)}</td>
              <td>${esc(f.cargo)}</td>
              <td>${esc(f.departamento)}</td>
              <td>${esc(f.tipo)}</td>
              <td>${fmtDate(f.dataAdmissao)}</td>
              <td class="text-right mono">${fmtMoney(f.salario)}</td>
              <td>${statusBadge(f.status)}</td>
              <td class="row-actions">
                ${canEdit ? `<button class="btn btn-sm" data-edit-func="${f.id}">Editar</button>` : ''}
                ${canDelete ? `<button class="btn btn-sm btn-danger" data-del-func="${f.id}">Remover</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table></div>
    </section>
  `;
  const btnNovo = document.getElementById('btnNovoFuncionario');
  if (btnNovo) btnNovo.onclick = () => openFuncionarioForm();
  document.getElementById('btnExportarRH').onclick = () => exportarExcel('recursos_humanos', 'Funcionários', state.funcionarios.map(f => ({
    'Nome': f.nome, 'Cargo': f.cargo, 'Departamento': f.departamento, 'Tipo': f.tipo,
    'Professor Associado': f.professorId ? professorNome(f.professorId) : '', 'Data de Admissão': fmtDate(f.dataAdmissao),
    'Salário': f.salario, 'Estado': f.status,
  })));
  state.funcionarios.forEach(f => {
    const editBtn = document.querySelector(`[data-edit-func="${f.id}"]`);
    const delBtn = document.querySelector(`[data-del-func="${f.id}"]`);
    if (editBtn) editBtn.onclick = () => openFuncionarioForm(f.id);
    if (delBtn) delBtn.onclick = () => deleteFuncionario(f.id);
  });
}

function openFuncionarioForm(id) {
  if (id ? !hasPerm('rh', 'edit') : !hasPerm('rh', 'create')) return;
  const f = id ? byId(state.funcionarios, id) : null;
  openModal(f ? 'Editar funcionário' : 'Novo funcionário', `
    <div class="form-grid">
      ${fotoFieldHtml(f?.foto)}
      <div class="field span-2"><label>Nome completo</label><input id="fNome" value="${esc(f?.nome || '')}"></div>
      <div class="field"><label>Cargo</label><input id="fCargo" value="${esc(f?.cargo || '')}"></div>
      <div class="field"><label>Departamento</label><input id="fDepto" value="${esc(f?.departamento || '')}"></div>
      <div class="field"><label>Tipo</label>
        <select id="fTipo">${['Docente', 'Não-Docente'].map(t => `<option ${f?.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Professor associado (se docente)</label>
        <select id="fProf">
          <option value="">— Nenhum —</option>
          ${state.professores.map(p => `<option value="${p.id}" ${f?.professorId === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Data de admissão</label><input id="fAdmissao" type="date" value="${f?.dataAdmissao || ''}"></div>
      <div class="field"><label>Salário (Kz)</label><input id="fSalario" type="number" min="0" step="1000" value="${f?.salario ?? ''}"></div>
      <div class="field"><label>Estado</label>
        <select id="fStatus">${['Ativo', 'Inativo', 'Licença'].map(s => `<option ${f?.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Guardar</button>
    </div>
  `, () => {
    const getFoto = wireFotoField(f?.foto);
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('btnSave').onclick = () => {
      const nome = document.getElementById('fNome').value.trim();
      if (!nome) { toast('Indique o nome do funcionário.'); return; }
      const payload = {
        nome,
        foto: getFoto(),
        cargo: document.getElementById('fCargo').value.trim(),
        departamento: document.getElementById('fDepto').value.trim(),
        tipo: document.getElementById('fTipo').value,
        professorId: document.getElementById('fProf').value || null,
        dataAdmissao: document.getElementById('fAdmissao').value,
        salario: Number(document.getElementById('fSalario').value) || 0,
        status: document.getElementById('fStatus').value,
      };
      const jaExistia = !!f;
      if (f) Object.assign(f, payload);
      else state.funcionarios.push({ id: nextId('rh'), ...payload });
      registrarLog(jaExistia ? 'Editar' : 'Criar', 'rh', `Funcionário ${jaExistia ? 'editado' : 'criado'}: ${payload.nome}`);
      saveState();
      closeModal();
      toast('Funcionário guardado.');
      renderRH();
    };
  });
}

function deleteFuncionario(id) {
  if (!hasPerm('rh', 'delete')) return;
  if (!confirm('Remover este funcionário?')) return;
  const alvo = byId(state.funcionarios, id);
  state.funcionarios = state.funcionarios.filter(f => f.id !== id);
  registrarLog('Remover', 'rh', `Funcionário removido: ${alvo?.nome || id}`);
  saveState();
  toast('Funcionário removido.');
  renderRH();
}

/* ================================= Utilizadores ================================ */

function renderUtilizadores() {
  const canCreate = hasPerm('utilizadores', 'create');
  const canEdit = hasPerm('utilizadores', 'edit');
  const canDelete = hasPerm('utilizadores', 'delete');

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn" id="btnExportarUsuarios">Exportar Excel</button>
        ${canCreate ? `<button class="btn btn-primary" id="btnNovoUsuario">+ Novo utilizador</button>` : ''}
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th></th><th>Nome</th><th>Email</th><th>Perfil</th><th>Associado a</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${state.usuarios.map(u => {
            let assoc = '—';
            if (u.papel === 'professor') assoc = professorNome(u.refId);
            if (u.papel === 'estudante') assoc = alunoNome(u.refId);
            return `
              <tr>
                <td>${avatarHtml(u.foto, u.nome)}</td>
                <td>${esc(u.nome)}</td>
                <td>${esc(u.email)}</td>
                <td>${rolePill(u.papel)}</td>
                <td>${esc(assoc)}</td>
                <td>${statusBadge(u.status)}</td>
                <td class="row-actions">
                  ${canEdit ? `<button class="btn btn-sm" data-edit-user="${u.id}">Editar</button>` : ''}
                  ${canDelete ? `<button class="btn btn-sm btn-danger" data-del-user="${u.id}">Remover</button>` : ''}
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </section>
  `;
  const btnNovo = document.getElementById('btnNovoUsuario');
  if (btnNovo) btnNovo.onclick = () => openUsuarioForm();
  document.getElementById('btnExportarUsuarios').onclick = () => exportarExcel('utilizadores', 'Utilizadores', state.usuarios.map(u => ({
    'Nome': u.nome, 'Email': u.email, 'Perfil': ROLE_LABELS[u.papel] || u.papel,
    'Associado a': u.papel === 'professor' ? professorNome(u.refId) : (u.papel === 'estudante' ? alunoNome(u.refId) : ''),
    'Estado': u.status,
  })));
  state.usuarios.forEach(u => {
    const editBtn = document.querySelector(`[data-edit-user="${u.id}"]`);
    const delBtn = document.querySelector(`[data-del-user="${u.id}"]`);
    if (editBtn) editBtn.onclick = () => openUsuarioForm(u.id);
    if (delBtn) delBtn.onclick = () => deleteUsuario(u.id);
  });
}

function refFieldHtml(papel, currentRefId) {
  if (papel === 'professor') {
    return `<div class="field span-2" id="wrapRef"><label>Professor associado</label>
      <select id="fRef">${state.professores.map(p => `<option value="${p.id}" ${currentRefId === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
    </div>`;
  }
  if (papel === 'estudante') {
    return `<div id="wrapRef" style="display:contents">${alunoBuscaFieldHtml(currentRefId)}</div>`;
  }
  return `<div class="field span-2" id="wrapRef"></div>`;
}
/* Liga o(s) campo(s) de referência gerados por refFieldHtml() para o papel
   atual — devolve um getter do refId, ou null se o papel não precisar de
   referência (nesse caso o próprio elemento #fRef, quando existir, é lido
   diretamente no handler de guardar). */
function wireRefField(papel, currentRefId) {
  if (papel === 'estudante') return wireAlunoBusca(currentRefId);
  return null;
}

function openUsuarioForm(id) {
  if (id ? !hasPerm('utilizadores', 'edit') : !hasPerm('utilizadores', 'create')) return;
  const u = id ? byId(state.usuarios, id) : null;
  openModal(u ? 'Editar utilizador' : 'Novo utilizador', `
    <div class="form-grid">
      ${fotoFieldHtml(u?.foto)}
      <div class="field span-2"><label>Nome completo</label><input id="fNome" value="${esc(u?.nome || '')}"></div>
      <div class="field"><label>Email</label><input id="fEmail" type="email" value="${esc(u?.email || '')}"></div>
      <div class="field"><label>Palavra-passe</label><input id="fSenha" value="${esc(u?.senha || '')}"></div>
      <div class="field"><label>Perfil</label>
        <select id="fPapel">${ROLES.map(r => `<option value="${r}" ${u?.papel === r ? 'selected' : ''}>${ROLE_LABELS[r]}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Estado</label>
        <select id="fStatus">${['Ativo', 'Inativo'].map(s => `<option ${u?.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </div>
      ${refFieldHtml(u?.papel || ROLES[0], u?.refId)}
    </div>
    <p class="text-muted" style="font-size:12px;margin-top:8px;">Protótipo: a palavra-passe fica visível em texto simples só para fins de demonstração local.</p>
    <div class="modal-footer">
      <button class="btn" id="btnCancel">Cancelar</button>
      <button class="btn btn-primary" id="btnSave">Guardar</button>
    </div>
  `, () => {
    const getFoto = wireFotoField(u?.foto);
    let getRefId = wireRefField(u?.papel || ROLES[0], u?.refId);
    document.getElementById('btnCancel').onclick = closeModal;
    document.getElementById('fPapel').onchange = e => {
      const novoPapel = e.target.value;
      document.getElementById('wrapRef').outerHTML = refFieldHtml(novoPapel, null);
      getRefId = wireRefField(novoPapel, null);
    };
    document.getElementById('btnSave').onclick = () => {
      const nome = document.getElementById('fNome').value.trim();
      const email = document.getElementById('fEmail').value.trim();
      const senha = document.getElementById('fSenha').value;
      if (!nome || !email || !senha) { toast('Preencha nome, email e palavra-passe.'); return; }
      if (state.usuarios.some(x => x.id !== id && x.email.toLowerCase() === email.toLowerCase())) {
        toast('Já existe um utilizador com este email.'); return;
      }
      const papel = document.getElementById('fPapel').value;
      const refEl = document.getElementById('fRef');
      let refId = null;
      if (papel === 'professor' && refEl) refId = refEl.value;
      else if (papel === 'estudante') {
        refId = getRefId ? getRefId() : '';
        if (!refId) { toast('Procure o aluno pelo número de matrícula antes de guardar.'); return; }
      }
      const payload = {
        nome, email, senha, papel,
        foto: getFoto(),
        refId,
        status: document.getElementById('fStatus').value,
      };
      const jaExistia = !!u;
      if (u) Object.assign(u, payload);
      else state.usuarios.push({ id: nextId('u'), ...payload });
      registrarLog(jaExistia ? 'Editar' : 'Criar', 'utilizadores', `Utilizador ${jaExistia ? 'editado' : 'criado'}: ${nome} (${ROLE_LABELS[papel]}) — palavra-passe omitida do registo de auditoria.`);
      saveState();
      closeModal();
      toast('Utilizador guardado.');
      renderUtilizadores();
    };
  });
}

function deleteUsuario(id) {
  if (!hasPerm('utilizadores', 'delete')) return;
  if (id === currentUser.id) { toast('Não pode remover o utilizador com sessão iniciada.'); return; }
  const alvo = byId(state.usuarios, id);
  if (alvo?.papel === 'admin' && state.usuarios.filter(u => u.papel === 'admin').length <= 1) {
    toast('Tem de existir pelo menos um Administrador.'); return;
  }
  if (!confirm('Remover este utilizador?')) return;
  state.usuarios = state.usuarios.filter(u => u.id !== id);
  registrarLog('Remover', 'utilizadores', `Utilizador removido: ${alvo?.nome || id} (${alvo ? ROLE_LABELS[alvo.papel] : ''})`);
  saveState();
  toast('Utilizador removido.');
  renderUtilizadores();
}

/* ================================== Permissões ================================= */

const PERM_ACTIONS = [['view', 'Ver'], ['create', 'Criar'], ['edit', 'Editar'], ['delete', 'Eliminar']];

function renderPermissoes(selRole) {
  const configuraveis = ROLES.filter(r => r !== 'admin');
  const role = selRole && configuraveis.includes(selRole) ? selRole : configuraveis[0];
  const rolePerms = state.permissoes[role];

  document.getElementById('content').innerHTML = `
    <section class="section active">
      <p class="panel-sub">O perfil <strong>Administrador</strong> tem sempre acesso total e não é configurável aqui.</p>
      <div class="perm-toolbar">
        <select class="input" id="fltRole">
          ${configuraveis.map(r => `<option value="${r}" ${r === role ? 'selected' : ''}>${ROLE_LABELS[r]}</option>`).join('')}
        </select>
        <div class="spacer"></div>
        <button class="btn" id="btnRestaurar">Repor predefinições deste perfil</button>
        <button class="btn btn-primary" id="btnGuardarPerm">Guardar alterações</button>
      </div>

      <div class="table-wrap"><table class="data perm-table">
        <thead><tr><th>Módulo</th>${PERM_ACTIONS.map(([, label]) => `<th>${label}</th>`).join('')}</tr></thead>
        <tbody>
          ${MODULES.map(m => `
            <tr>
              <td>${esc(MODULE_LABELS[m])}</td>
              ${PERM_ACTIONS.map(([action]) => `
                <td><input type="checkbox" data-perm="${m}:${action}" ${rolePerms[m]?.[action] ? 'checked' : ''}></td>
              `).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table></div>
    </section>
  `;

  document.getElementById('fltRole').onchange = e => renderPermissoes(e.target.value);
  document.getElementById('btnRestaurar').onclick = () => {
    if (!confirm(`Repor as permissões predefinidas do perfil "${ROLE_LABELS[role]}"?`)) return;
    state.permissoes[role] = defaultPermissoes()[role];
    registrarLog('Configurar', 'permissoes', `Permissões do perfil "${ROLE_LABELS[role]}" repostas para a predefinição.`);
    saveState();
    toast('Permissões repostas.');
    renderPermissoes(role);
  };
  document.getElementById('btnGuardarPerm').onclick = () => {
    const antes = JSON.parse(JSON.stringify(rolePerms));
    MODULES.forEach(m => {
      PERM_ACTIONS.forEach(([action]) => {
        const cb = document.querySelector(`[data-perm="${m}:${action}"]`);
        rolePerms[m][action] = cb.checked;
        // "ver" é pré-requisito para criar/editar/eliminar
        if (action !== 'view' && cb.checked) rolePerms[m].view = true;
      });
    });
    const alterados = MODULES.filter(m => JSON.stringify(antes[m]) !== JSON.stringify(rolePerms[m]));
    if (alterados.length) {
      registrarLog('Configurar', 'permissoes', `Permissões do perfil "${ROLE_LABELS[role]}" alteradas — módulos: ${alterados.map(m => MODULE_LABELS[m]).join(', ')}.`);
    }
    saveState();
    toast('Permissões guardadas.');
    applyNavVisibility();
    renderPermissoes(role);
  };
}

/* =================================== Router =================================== */

const SECTION_TITLES = MODULE_LABELS;

const SECTION_RENDERERS = {
  dashboard: renderDashboard,
  painelProfessor: renderPainelProfessor,
  meuPainel: renderMeuPainel,
  alunos: () => renderAlunos(),
  professores: renderProfessores,
  inscricoes: () => renderInscricoes('lista'),
  cursos: renderCursos,
  disciplinas: () => renderDisciplinas(),
  turmas: renderTurmas,
  matriculas: renderMatriculas,
  periodos: () => renderPeriodos(),
  notas: () => renderNotas(),
  frequencia: () => renderFrequencia(),
  trabalhos: () => renderTrabalhos(),
  materiais: () => renderMateriais(),
  financeiro: () => renderFinanceiro(),
  biblioteca: renderBiblioteca,
  rh: renderRH,
  cadastros: () => renderCadastros(CADASTRO_TIPOS[0].key),
  utilizadores: renderUtilizadores,
  permissoes: () => renderPermissoes(),
  backups: renderBackups,
  auditoria: () => renderAuditoria(),
};

function landingSection() {
  if (currentUser.papel === 'estudante') return 'meuPainel';
  if (currentUser.papel === 'professor') return 'painelProfessor';
  if (hasPerm('dashboard', 'view')) return 'dashboard';
  return MODULES.find(m => hasPerm(m, 'view')) || 'dashboard';
}

function applyNavVisibility() {
  document.querySelectorAll('.nav-item[data-module]').forEach(btn => {
    btn.style.display = hasPerm(btn.dataset.module, 'view') ? '' : 'none';
  });
  // Esconde o cabeçalho do grupo (ex.: "Pessoas", "Administração") quando
  // nenhum dos módulos desse grupo estiver acessível ao perfil atual — evita
  // títulos de secção "órfãos" sem nenhum botão visível por baixo.
  document.querySelectorAll('.nav-group-label').forEach(label => {
    let algumVisivel = false;
    let el = label.nextElementSibling;
    while (el && !el.classList.contains('nav-group-label')) {
      if (el.classList.contains('nav-item') && el.style.display !== 'none') { algumVisivel = true; break; }
      el = el.nextElementSibling;
    }
    label.style.display = algumVisivel ? '' : 'none';
  });
}

function render() {
  if (!hasPerm(currentSection, 'view')) currentSection = landingSection();
  document.getElementById('pageTitle').textContent = SECTION_TITLES[currentSection];
  document.getElementById('anoLetivoAtual').textContent = anoLetivoLabel(state.anoLetivo);
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === currentSection);
  });
  SECTION_RENDERERS[currentSection]();
}

function goTo(section) {
  if (!hasPerm(section, 'view')) return;
  currentSection = section;
  document.getElementById('sidebar').classList.remove('open');
  render();
}

/* =================================== Autenticação ================================ */

function renderDemoAccounts() {
  const el = document.getElementById('demoAccounts');
  el.innerHTML = state.usuarios.map(u => `
    <button type="button" class="demo-account-btn" data-demo-user="${u.id}">
      <div class="dan"><strong>${esc(u.nome)}</strong><span>${esc(u.email)} · ${esc(u.senha)}</span></div>
      <span class="role-tag">${esc(ROLE_LABELS[u.papel])}</span>
    </button>
  `).join('');
  state.usuarios.forEach(u => {
    document.querySelector(`[data-demo-user="${u.id}"]`).onclick = () => attemptLogin(u.email, u.senha);
  });
}

function attemptLogin(email, senha) {
  const errorEl = document.getElementById('loginError');
  const u = state.usuarios.find(x => x.email.toLowerCase() === email.trim().toLowerCase() && x.senha === senha);
  if (!u) {
    errorEl.textContent = 'Credenciais inválidas.';
    registrarLog('Login Falhado', 'utilizadores', `Tentativa de login falhada — credenciais inválidas para "${email.trim()}".`, email.trim());
    return;
  }
  if (u.status !== 'Ativo') {
    errorEl.textContent = 'Este utilizador está inativo.';
    registrarLog('Login Falhado', 'utilizadores', `Tentativa de login falhada — utilizador "${u.nome}" está inativo.`, u.nome);
    return;
  }
  errorEl.textContent = '';
  currentUser = u;
  saveSession(u.id);
  registrarLog('Login', 'utilizadores', `Login bem-sucedido — ${u.nome} (${ROLE_LABELS[u.papel]}).`);
  showApp();
}

/* A foto mostrada na topbar vem do registo ligado (Professor/Aluno) quando
   existe; caso contrário usa a foto do próprio Utilizador (ex.: perfis
   administrativos sem Professor/Aluno associado). */
function fotoDoUtilizadorAtual() {
  if (currentUser.papel === 'professor' && currentUser.refId) return byId(state.professores, currentUser.refId)?.foto || null;
  if (currentUser.papel === 'estudante' && currentUser.refId) return byId(state.alunos, currentUser.refId)?.foto || null;
  return currentUser.foto || null;
}

function showApp() {
  document.getElementById('loginScreen').classList.remove('open');
  document.getElementById('appShell').classList.remove('hidden');
  const foto = fotoDoUtilizadorAtual();
  const avatarEl = document.getElementById('userAvatar');
  if (foto) avatarEl.innerHTML = `<img src="${esc(foto)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
  else avatarEl.textContent = currentUser.nome.charAt(0).toUpperCase();
  document.getElementById('userChipName').textContent = currentUser.nome;
  document.getElementById('userChipRole').textContent = ROLE_LABELS[currentUser.papel];
  applyNavVisibility();
  currentSection = landingSection();
  render();
  notificarTrabalhosPendentes();
}

/* Avisa o estudante, logo ao entrar, se tiver trabalhos à espera de resposta
   (aceitar/recusar adesão) ou já aceites mas ainda sem ficheiro entregue. */
function notificarTrabalhosPendentes() {
  if (currentUser.papel !== 'estudante' || !currentUser.refId) return;
  const alunoId = currentUser.refId;
  const minhas = state.trabalhoIntegrantes.filter(ti => ti.alunoId === alunoId);
  const porResponder = minhas.filter(ti => ti.aceite === null).length;
  const semFicheiro = minhas.filter(ti => ti.aceite === true && !ficheiroDoIntegrante(ti.trabalhoId, alunoId)).length;
  if (porResponder > 0) {
    toast(`Tem ${porResponder} trabalho(s) à espera da sua resposta (aceitar/recusar adesão) — ver "Meu Painel".`);
  } else if (semFicheiro > 0) {
    toast(`Tem ${semFicheiro} trabalho(s) aceite(s) por entregar — pode carregar o ficheiro em "Meu Painel".`);
  }
}

function showLogin() {
  currentUser = null;
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('loginScreen').classList.add('open');
  document.getElementById('loginError').textContent = '';
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginSenha').value = '';
  renderDemoAccounts();
}

function logout() {
  if (currentUser) registrarLog('Logout', 'utilizadores', `Logout — ${currentUser.nome}.`);
  clearSession();
  showLogin();
}

/* ==================================== Boot ==================================== */

document.addEventListener('DOMContentLoaded', () => {
  state = loadState();
  verificarBackupAutomatico();

  document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => goTo(btn.dataset.section));
  });

  document.getElementById('menuToggle').onclick = () => document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target.id === 'modalOverlay') closeModal(); });
  document.getElementById('modalClose').onclick = closeModal;
  document.getElementById('btnReset').onclick = resetData;
  document.getElementById('btnLogout').onclick = logout;

  document.getElementById('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    attemptLogin(document.getElementById('loginEmail').value, document.getElementById('loginSenha').value);
  });

  const session = loadSession();
  const user = session ? state.usuarios.find(u => u.id === session.userId && u.status === 'Ativo') : null;
  if (user) {
    currentUser = user;
    showApp();
  } else {
    showLogin();
  }
});
