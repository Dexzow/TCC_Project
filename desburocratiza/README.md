# Desburocratiza — Manual de Sobrevivência Adulta

Aplicação web em JavaScript (Node.js + Express + SQLite) com frontend responsivo, cadastro com confirmação de e-mail, login, progresso de atividades e chatbot Frederico via API OpenAI.

## Requisitos
- Node.js 20 ou superior
- npm
- Conta/servidor SMTP para envio real de e-mails
- Chave da API OpenAI para ativar o Frederico

## Rodar localmente
1. Extraia o ZIP.
2. Abra um terminal na pasta do projeto.
3. Execute `npm install`.
4. Copie `.env.example` para `.env`.
5. Defina `SESSION_SECRET` com uma string aleatória longa.
6. Configure SMTP para receber e-mails de verificação.
7. Opcional: defina `OPENAI_API_KEY` e `OPENAI_MODEL`.
8. Execute `npm start`.
9. Acesse http://localhost:3000.

### Gerar um segredo seguro
Use, por exemplo, `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` e copie o resultado para `SESSION_SECRET`.

## Configuração de e-mail
Preencha `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` e `APP_URL`. Em produção, `APP_URL` deve ser a URL HTTPS pública do site. Sem SMTP, o cadastro local funciona, mas o link de verificação é escrito no terminal do servidor apenas para testes. Não use esse modo em produção.

## Frederico (OpenAI)
A chave deve ficar exclusivamente no `.env` do servidor. O navegador chama `/api/chat`, e o servidor encaminha a pergunta à API. Nunca publique `.env`, nunca coloque a chave em `public/app.js`, HTML ou repositório público. Defina `OPENAI_API_KEY` e, opcionalmente, `OPENAI_MODEL`.

## Banco de dados
SQLite cria automaticamente `data/desburocratiza.sqlite` e o arquivo de sessão em `data/`. Faça backups regulares da pasta `data/`. Em hospedagens com múltiplas instâncias ou alto volume, migre para PostgreSQL e armazenamento de sessão compartilhado.

## Segurança implementada
- Senhas derivadas com `scrypt`, salt individual e comparação timing-safe.
- Verificação de e-mail com token aleatório, armazenado como hash e com expiração de 30 minutos.
- Sessão em cookie HttpOnly, SameSite=Lax e Secure em produção; ID de sessão regenerado no login.
- Token CSRF por sessão e verificação de origem.
- Helmet, Content Security Policy, limites de payload e rate limiting nas rotas da API/autenticação.
- Validação básica dos dados, limites de tamanho e upload restrito a imagens JPG/PNG/WEBP até 8 MB.
- Chave de IA somente no servidor.

## Antes de colocar no ar
- Use HTTPS e domínio próprio.
- Configure SMTP autenticado e teste entregabilidade.
- Use um `SESSION_SECRET` forte e mantenha `.env` fora do controle de versão.
- Configure backup, monitoramento, atualização de dependências e política de privacidade/LGPD.
- Faça revisão de segurança profissional, testes de invasão e revisão jurídica dos textos e simuladores.
- Considere antivírus/inspeção de conteúdo nos uploads, confirmação de endereço, recuperação de senha, exclusão/exportação de dados e trilha de auditoria antes de abrir ao público.
- O sistema é uma base inicial funcional, não uma certificação de segurança nem uma garantia de conformidade legal.

## Conteúdo educativo
Os simuladores usam exemplos didáticos. O cálculo de folha não substitui cálculo oficial; o simulador de juros é hipotético; a triagem de IR não determina obrigatoriedade; e o detetive de contrato não é análise jurídica. Os limites e regras oficiais mudam: confira Receita Federal, Banco Central, legislação e órgãos competentes.

## Estrutura
- `server.js`: servidor, autenticação, e-mail, progresso, upload e chat.
- `src/db.js`: esquema SQLite.
- `public/index.html`: interface.
- `public/style.css`: identidade visual responsiva.
- `public/app.js`: interações, simuladores, mini games, guias e chat.
- `public/assets/frederico-mascote.jpeg`: mascote enviado pelo usuário.
