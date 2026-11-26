const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'burocracia.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      xp_reward INTEGER NOT NULL,
      description TEXT NOT NULL,
      content_type TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_progress (
      user_id INTEGER,
      module_id INTEGER,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, module_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (module_id) REFERENCES modules(id)
    )
  `);

  db.get("SELECT COUNT(*) AS count FROM modules", (err, row) => {
    if (!err && row && row.count === 0) {
      const stmt = db.prepare("INSERT INTO modules (title, category, xp_reward, description, content_type) VALUES (?, ?, ?, ?, ?)");
      stmt.run("Raio-X do Holerite", "Trabalho & CLT", 150, "Clique nos itens do contracheque para entender INSS, IRRF e FGTS.", "holerite");
      stmt.run("Currículo Anti-Filtro (ATS)", "Carreira", 200, "Monte um currículo estruturado para passar nos robôs de RH.", "curriculo");
      stmt.run("Armadilha do Rotativo", "Finanças", 100, "Entenda como funciona o juros composto do cartão de crédito.", "guia_cartao");
      stmt.run("Contrato de Aluguel sem Ciladas", "Moradia", 150, "O que observar antes de assinar: caução, fiador e vistoria.", "guia_aluguel");
      stmt.finalize();
      console.log("Módulos iniciais inseridos com sucesso!");
    }
  });
});

module.exports = db;
