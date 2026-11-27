require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { GoogleGenAI } = require("@google/genai");
const db = require("./src/db");
const ai = new GoogleGenAI({});

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === "production";
const dataDir = path.join(__dirname, "data");
const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error("Defina SESSION_SECRET com pelo menos 32 caracteres em produção.");
}
app.disable("x-powered-by");
if (isProd) app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: isProd ? [] : null
    }
  }
}));
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));

app.use(session({
  name: "desburocratiza.sid",
  store: new SQLiteStore({ db: "sessions.sqlite", dir: dataDir, concurrentDB: true }),
  secret: process.env.SESSION_SECRET || "dev-only-change-this-session-secret-before-deploying",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 8
  }
}));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: "draft-7", legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 90, standardHeaders: "draft-7", legacyHeaders: false });
app.use("/api", apiLimiter);

function cleanText(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Faça login para continuar." });
  next();
}
function csrfCheck(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (origin && origin !== process.env.APP_URL && origin !== `http://localhost:${PORT}`) {
    return res.status(403).json({ error: "Origem não permitida." });
  }
  const token = req.get("x-csrf-token");
  if (!req.session.csrfToken || token !== req.session.csrfToken) {
    return res.status(403).json({ error: "Sessão expirada. Atualize a página." });
  }
  next();
}
app.use("/api", csrfCheck);

async function sendVerificationEmail(email, token) {
  const host = process.env.SMTP_HOST;
  if (!host || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    if (!isProd) console.warn(`SMTP não configurado. Link local de verificação: ${process.env.APP_URL || `http://localhost:${PORT}`}/verificar?token=${token}`);
    return false;
  }
  const transporter = nodemailer.createTransport({
    host, port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  const link = `${process.env.APP_URL}/verificar?token=${encodeURIComponent(token)}`;
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Confirme seu e-mail — Desburocratiza",
    text: `Olá! Confirme seu e-mail acessando: ${link}\nO link expira em 30 minutos.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#102c52"><h1>Quase lá!</h1><p>Confirme seu e-mail para entrar no Desburocratiza.</p><p><a href="${link}" style="display:inline-block;background:#f3c969;color:#102c52;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Confirmar meu e-mail</a></p><p>O link expira em 30 minutos.</p></div>`
  });
  return true;
}

app.get("/api/csrf", (req, res) => {
  req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  res.json({ csrfToken: req.session.csrfToken });
});

app.post("/api/auth/register", authLimiter, async (req, res) => {
  const name = cleanText(req.body.name, 60);
  const email = cleanText(req.body.email, 160).toLowerCase();
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10 || password.length > 128) {
    return res.status(400).json({ error: "Informe nome, e-mail válido e senha com pelo menos 10 caracteres." });
  }
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    return res.status(409).json({ error: "Este e-mail já possui cadastro." });
  }
  const bcrypt = require("crypto");
  // scrypt is built into Node; per-user salt and timing-safe verification.
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = await new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, 64, (err, key) => err ? reject(err) : resolve(key.toString("hex")))
  );
  const token = crypto.randomBytes(32).toString("hex");
  const verifyHash = hashToken(token);
  const result = db.prepare(`INSERT INTO users (name,email,password_hash,password_salt,verified,verify_token,verify_expires,created_at)
    VALUES (?,?,?,?,0,?,?,?)`).run(name, email, passwordHash, salt, verifyHash, Date.now() + 30*60*1000, Date.now());
  try {
    const sent = await sendVerificationEmail(email, token);
    res.status(201).json({ message: sent ? "Cadastro criado! Confira seu e-mail para confirmar a conta." : "Cadastro criado. Configure o SMTP e consulte o terminal do servidor para obter o link de teste.", emailSent: sent });
  } catch (err) {
    console.error("Falha no envio de e-mail:", err.message);
    res.status(201).json({ message: "Conta criada, mas o e-mail não foi enviado. Peça um novo link após configurar o SMTP." });
  }
});

app.get("/api/auth/verify", (req, res) => {
  const token = cleanText(req.query.token, 128);
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ error: "Link de verificação inválido." });
  const user = db.prepare("SELECT id, verify_expires FROM users WHERE verify_token = ?").get(hashToken(token));
  if (!user || user.verify_expires < Date.now()) return res.status(400).json({ error: "Link inválido ou expirado. Solicite outro e-mail." });
  db.prepare("UPDATE users SET verified=1, verify_token=NULL, verify_expires=NULL WHERE id=?").run(user.id);
  res.json({ message: "E-mail confirmado! Agora você pode entrar na sua conta." });
});

app.post("/api/auth/resend", authLimiter, async (req, res) => {
  const email = cleanText(req.body.email, 160).toLowerCase();
  const user = db.prepare("SELECT id, verified FROM users WHERE email=?").get(email);
  if (!user || user.verified) return res.json({ message: "Se houver uma conta pendente para esse e-mail, enviaremos um novo link." });
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("UPDATE users SET verify_token=?, verify_expires=? WHERE id=?").run(hashToken(token), Date.now()+30*60*1000, user.id);
  try { await sendVerificationEmail(email, token); } catch (e) { console.error(e.message); }
  res.json({ message: "Se houver uma conta pendente para esse e-mail, enviaremos um novo link." });
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const email = cleanText(req.body.email, 160).toLowerCase();
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!user) return res.status(401).json({ error: "E-mail ou senha incorretos." });
  const candidate = await new Promise((resolve, reject) =>
    crypto.scrypt(password, user.password_salt, 64, (err, key) => err ? reject(err) : resolve(key))
  );
  const valid = crypto.timingSafeEqual(candidate, Buffer.from(user.password_hash, "hex"));
  if (!valid) return res.status(401).json({ error: "E-mail ou senha incorretos." });
  if (!user.verified) return res.status(403).json({ error: "Confirme seu e-mail antes de entrar. Você pode solicitar outro link." });
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: "Não foi possível iniciar sua sessão." });
    req.session.userId = user.id;
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    res.json({ user: { id: user.id, name: user.name, email: user.email }, csrfToken: req.session.csrfToken });
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT id,name,email FROM users WHERE id=?").get(req.session.userId);
  res.json({ user, csrfToken: req.session.csrfToken });
});
app.post("/api/auth/logout", requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("desburocratiza.sid");
    res.json({ message: "Você saiu da conta." });
  });
});

app.get("/api/progress", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT game_key, score, completed_at FROM progress WHERE user_id=?").all(req.session.userId);
  res.json({ progress: rows });
});
app.post("/api/progress", requireAuth, (req, res) => {
  const key = cleanText(req.body.gameKey, 40);
  const score = Math.max(0, Math.min(100, Number(req.body.score) || 0));
  if (!/^[a-z0-9_-]+$/.test(key)) return res.status(400).json({ error: "Atividade inválida." });
  db.prepare(`INSERT INTO progress(user_id,game_key,score,completed_at) VALUES(?,?,?,?)
    ON CONFLICT(user_id,game_key) DO UPDATE SET score=MAX(score,excluded.score), completed_at=excluded.completed_at`)
    .run(req.session.userId, key, score, Date.now());
  res.json({ saved: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase())
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  }
});
app.post("/api/chat", requireAuth, async (req, res) => {
  const message = cleanText(req.body.message, 1800);
  if (!message) return res.status(400).json({ error: "Escreva uma dúvida para o Frederico." });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: "O Frederico ainda não foi conectado à API. Configure GEMINI_API_KEY no arquivo .env do servidor." });
  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: message,
      config: {
        systemInstruction: "Você é Frederico, um gato professor simpático do projeto Desburocratiza. Explique burocracia brasileira em português simples, com exemplos práticos e sem juridiquês. Seja acolhedor e objetivo. Não invente leis, alíquotas ou prazos; quando algo depender da situação ou mudar com o tempo, avise e indique consultar fonte oficial. Você oferece educação geral, não aconselhamento jurídico, contábil ou financeiro individual. Nunca peça senhas, códigos, documentos completos ou dados bancários.",
        temperature: 0.5,
        maxOutputTokens: 550
      }
    });
    res.json({ reply: response.text || "Miau! Não consegui formular uma resposta agora." });
  } catch (err) {
    console.error("Chat:", err.message);
    res.status(502).json({ error: "O Frederico teve um pequeno novelo técnico. Tente novamente em instantes." });
  }
});

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof multer.MulterError) return res.status(400).json({ error: "Arquivo inválido ou maior que 8 MB." });
  res.status(500).json({ error: "Ocorreu um erro interno." });
});

app.listen(PORT, () => console.log(`Desburocratiza rodando em http://localhost:${PORT}`));
