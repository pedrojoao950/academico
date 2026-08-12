# SIGA — Sistema Integrado de Gestão Académica

Protótipo funcional de um sistema de gestão académica para uma instituição de ensino superior: autenticação com 9 perfis e permissões granulares, Alunos, Professores, Cursos, Disciplinas, Turmas & Horários, Matrículas, Inscrições (admissão competitiva), Notas, Frequência, Períodos de Avaliação, Trabalhos, Materiais, Financeiro (com recibo automático), Biblioteca, Recursos Humanos, Cadastros, Auditoria/Logs e Backups.

É uma aplicação **100% front-end**: HTML/CSS/JavaScript puro, sem framework e sem passo de build. Os dados vivem no `localStorage` do browser — não há servidor de aplicação nem base de dados real. Consulte [DOCUMENTACAO.md](DOCUMENTACAO.md) para o detalhe técnico completo (arquitetura, modelo de dados, módulos).

> ⚠️ Protótipo de demonstração — as senhas ficam em texto simples e não deve ser usado com dados reais de estudantes.

---

## Instalação

Não há dependências para instalar (sem `npm install`, sem Python, sem ligação à internet depois de obtido o código) — só precisa de um servidor estático a servir os ficheiros, porque `index.html` carrega módulos via `fetch`/`localStorage` que exigem `http://`, não `file://`.

### Opção 1 — Duplo-clique (Windows, mais simples)

1. Transfira/clone este repositório para o computador.
2. Dê duplo-clique em [`INICIAR.bat`](INICIAR.bat).
   Isto arranca um servidor local em PowerShell (janela preta — não feche) e abre automaticamente o browser em `http://localhost:5500`.
3. Se o Windows pedir autorização de firewall para o PowerShell, escolha "Permitir acesso" — é só para servir os ficheiros desta pasta ao browser do próprio computador, não sai para a internet.

Para terminar, feche a janela do servidor ("SIGA - Servidor Local").

### Opção 2 — PowerShell manual (Windows, sem duplo-clique)

```powershell
git clone https://github.com/pedrojoao950/academico.git
cd academico
powershell -ExecutionPolicy Bypass -File server.ps1
```

Depois abra `http://localhost:5500` no browser.

### Opção 3 — Qualquer outro servidor estático (macOS/Linux/CI)

`server.ps1` é só um servidor estático sem dependências — qualquer alternativa serve, por exemplo:

```bash
git clone https://github.com/pedrojoao950/academico.git
cd academico
python3 -m http.server 5500
# ou: npx serve .
```

Depois abra `http://localhost:5500`.

---

## Contas de demonstração

O ecrã de login tem botões de acesso rápido para cada perfil. Credenciais completas:

| Perfil | Email | Senha |
|---|---|---|
| Administrador | `admin@isg.ao` | `admin123` |
| Secretaria Académica | `secretaria.academica@isg.ao` | `secacad123` |
| Técnico Sec. Académica | `tecnico.academico@isg.ao` | `tecacad123` |
| Professor | `carlos.neto@isp.ao` | `prof123` |
| Estudante | `miguel.santos@aluno.isp.ao` | `aluno123` |
| Secretaria Financeira | `secretaria.financeira@isg.ao` | `secfin123` |
| Técnico Sec. Financeira | `tecnico.financeiro@isg.ao` | `tecfin123` |
| Biblioteca | `biblioteca@isg.ao` | `biblio123` |
| Recursos Humanos | `rh@isg.ao` | `rh123` |

Para repor os dados de exemplo a qualquer momento: entre como Administrador → botão **"↺ Repor dados de exemplo"** no fundo do menu lateral.

---

## Notas

- Os dados ficam apenas no `localStorage` do browser usado — limpar os dados de navegação apaga o progresso (os dados de exemplo voltam a aparecer da próxima vez).
- Exportação para Excel e impressão em PDF funcionam totalmente offline (biblioteca [SheetJS](https://github.com/SheetJS/sheetjs) já incluída em `js/vendor/`).
- Documentação técnica completa: [DOCUMENTACAO.md](DOCUMENTACAO.md) / [DOCUMENTACAO.docx](DOCUMENTACAO.docx).
- Instruções de demonstração em texto simples (para distribuir sem git): [LEIA-ME.txt](LEIA-ME.txt).
