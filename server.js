require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'segredo_padrao_adulto_os',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24
  }
}));

function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Você precisa estar logado.' });
}

app.post('/api/register', (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);

    db.run(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword],
      function (err) {
        if (err) {
          console.error('Erro no cadastro:', err.message);
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
          }
          return res.status(500).json({ error: 'Erro ao salvar no banco de dados.' });
        }

        req.session.userId = this.lastID;
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('Erro ao salvar sessão:', saveErr);
            return res.status(500).json({ error: 'Erro ao iniciar sessão.' });
          }
          return res.json({ message: 'Conta criada com sucesso!', userId: this.lastID });
        });
      }
    );
  } catch (e) {
    console.error('Erro interno no register:', e);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

app.post('/api/login', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      console.error('Erro no login:', err.message);
      return res.status(500).json({ error: 'Erro ao consultar banco de dados.' });
    }
    if (!user) {
      return res.status(400).json({ error: 'Usuário ou senha inválidos.' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Usuário ou senha inválidos.' });
    }

    req.session.userId = user.id;
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error('Erro ao salvar sessão:', saveErr);
        return res.status(500).json({ error: 'Erro ao iniciar sessão.' });
      }
      return res.json({ message: 'Login realizado!', name: user.name });
    });
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Deslogado com sucesso.' });
  });
});

app.get('/api/dashboard', isAuthenticated, (req, res) => {
  const userId = req.session.userId;

  db.get('SELECT id, name, email, xp, level FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const query = `
      SELECT m.*, 
      CASE WHEN up.user_id IS NOT NULL THEN 1 ELSE 0 END AS completed
      FROM modules m
      LEFT JOIN user_progress up ON m.id = up.module_id AND up.user_id = ?
    `;

    db.all(query, [userId], (err, modules) => {
      res.json({ user, modules: modules || [] });
    });
  });
});

app.post('/api/modules/:id/complete', isAuthenticated, (req, res) => {
  const userId = req.session.userId;
  const moduleId = req.params.id;

  db.get('SELECT * FROM user_progress WHERE user_id = ? AND module_id = ?', [userId, moduleId], (err, row) => {
    if (row) {
      return res.json({ message: 'Módulo já concluído anteriormente!', alreadyCompleted: true });
    }

    db.get('SELECT xp_reward FROM modules WHERE id = ?', [moduleId], (err, mod) => {
      if (!mod) return res.status(404).json({ error: 'Módulo não encontrado' });

      db.run('INSERT INTO user_progress (user_id, module_id) VALUES (?, ?)', [userId, moduleId], () => {
        db.get('SELECT xp FROM users WHERE id = ?', [userId], (err, user) => {
          const newXp = user.xp + mod.xp_reward;
          const newLevel = Math.floor(newXp / 300) + 1;

          db.run('UPDATE users SET xp = ?, level = ? WHERE id = ?', [newXp, newLevel, userId], () => {
            res.json({
              message: `Parabéns! Você ganhou +${mod.xp_reward} XP!`,
              newXp,
              newLevel
            });
          });
        });
      });
    });
  });
});

app.get('/api/ranking', (req, res) => {
  db.all('SELECT name, xp, level FROM users ORDER BY xp DESC LIMIT 10', [], (err, rows) => {
    res.json(rows || []);
  });
});

app.post('/api/chat', isAuthenticated, async (req, res) => {
  const { message } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'SUA_CHAVE_API_AQUI') {
    return res.json({
      reply: `[Modo Demonstração - Configure sua GEMINI_API_KEY no arquivo .env]\n\nVocê perguntou sobre: "${message}".\n\nEm termos simples: sempre leia as letras miúdas, nunca pague apenas o mínimo do cartão de crédito e guarde comprovantes de tudo!`
    });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Você é um mentor jovem, direto e didático especialista em "traduzir" burocracia brasileira (impostos, CLT, contratos, bancos, currículos) para jovens saindo da escola. Use linguagem simples, sem juridiquês, com exemplos práticos e tópicos curtos. Responda à dúvida: ${message}`
          }]
        }]
      })
    });

    const data = await response.json();
    const aiText = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text) || 'Não consegui processar sua dúvida agora.';
    res.json({ reply: aiText });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao conectar com a IA.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
