require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const QUESTIONS_FILE = path.join(DATA_DIR, "questions.json");
const RESULTS_FILE = path.join(DATA_DIR, "results.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

/* ================= CREATE DATA FOLDER & INITIAL FILES ================= */
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureFile(file, data) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  }
}

// Seed some starter questions (you can remove/change later)
ensureFile(QUESTIONS_FILE, [
  {
    id: 1,
    question: "Which HTML tag is used to include JavaScript code?",
    options: ["<script>", "<js>", "<javascript>", "<code>"],
    correct: "A",
  },
  {
    id: 2,
    question: "Which HTTP method is generally used to create a new resource?",
    options: ["GET", "POST", "PUT", "DELETE"],
    correct: "B",
  },
  {
    id: 3,
    question: "Which of the following is NOT a JavaScript data type?",
    options: ["Number", "String", "Float", "Boolean"],
    correct: "C",
  },
]);

ensureFile(RESULTS_FILE, []);

/* ================= HELPERS ================= */
function readJson(file, def) {
  try {
    const raw = fs.readFileSync(file, "utf8").trim();
    return raw ? JSON.parse(raw) : def;
  } catch {
    return def;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ================= GLOBAL MIDDLEWARE ================= */
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  res.set("X-Robots-Tag", "noindex,nofollow");
  next();
});

/* ============= BLOCK POSTMAN / API CLIENTS – BROWSER ONLY ============= */
/*
  - All /api/* routes are allowed ONLY if User-Agent looks like a real browser.
  - Static files (HTML/CSS/JS) and root paths are always allowed.
*/
app.use((req, res, next) => {
  const ua = req.headers["user-agent"] || "";

  // very simple browser detection + block common API clients
  const isBrowser =
    ua.includes("Mozilla") &&
    !/Postman|Insomnia|Thunder Client|curl|HttpClient|python-requests/i.test(
      ua
    );

  const alwaysAllowedPaths = [
    "/",
    "/index.html",
    "/exam.html",
    "/admin.html",
    "/robots.txt",
    "/favicon.ico",
  ];

  // allow static/front-end files for everyone
  if (
    alwaysAllowedPaths.includes(req.path) ||
    req.path.startsWith("/public") ||
    req.path.startsWith("/assets") ||
    !req.path.startsWith("/api") // non-API (e.g. CSS/JS) already handled by express.static
  ) {
    return next();
  }

  // For /api/* => require browser-like UA
  if (!isBrowser) {
    return res
      .status(403)
      .json({ error: "API access denied. Open exam only in a normal browser." });
  }

  next();
});

/* ================= AUTH FOR ADMIN ================= */
function requireAdmin(req, res, next) {
  if (req.cookies && req.cookies.admin === "true") return next();
  return res.status(401).json({ error: "Unauthorized" });
}

/* ================= STUDENT ROUTES ================= */

// Get random questions (student)
app.get("/api/questions", (req, res) => {
  const all = shuffle(readJson(QUESTIONS_FILE, []));
  // don't send correct answers to client
  const limited = all.slice(0, Math.min(100, all.length)).map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
  }));
  res.json({ questions: limited });
});

// Submit exam
app.post("/api/submit", (req, res) => {
  const { userName, email, answers, warnings } = req.body || {};
  if (!userName || !email || !Array.isArray(answers)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const questions = readJson(QUESTIONS_FILE, []);
  const qMap = new Map();
  questions.forEach((q) => qMap.set(q.id, q));

  let correct = 0;
  const formatted = [];

  answers.forEach((a) => {
    const q = qMap.get(a.questionId);
    if (!q) return;

    const sel = (a.selectedOption || "").toUpperCase().trim();
    const corr = (q.correct || "").toUpperCase().trim();

    if (sel === corr) correct++;

    formatted.push({
      questionId: q.id,
      question: q.question,
      options: q.options,
      selectedOption: sel || null,
      correctOption: corr,
      isCorrect: sel === corr,
    });
  });

  const total = questions.length || formatted.length;
  const percentage = total ? +( (correct / total) * 100 ).toFixed(2) : 0;

  const results = readJson(RESULTS_FILE, []);
  results.push({
    id: results.length + 1,
    userName,
    email,
    correct,
    total,
    percentage,
    submittedAt: new Date(),
    warnings: Array.isArray(warnings) ? warnings : [],
    answers: formatted,
  });
  writeJson(RESULTS_FILE, results);

  res.json({
    message: "Exam submitted successfully",
    correct,
    total,
    percentage,
    answers: formatted,
  });
});

/* ================= ADMIN API ROUTES ================= */

// Login (sets admin cookie)
app.post("/api/admin/login", (req, res) => {
  if (req.body && req.body.password === ADMIN_PASSWORD) {
    res.cookie("admin", "true", {
      httpOnly: true,
      sameSite: "lax",
      // secure: true   // uncomment if using HTTPS
    });
    return res.json({ success: true });
  }
  res.status(401).json({ error: "Invalid admin password" });
});

// Logout
app.post("/api/admin/logout", (req, res) => {
  res.clearCookie("admin");
  res.json({ success: true });
});

// Get all questions
app.get("/api/admin/questions", requireAdmin, (req, res) => {
  res.json({ questions: readJson(QUESTIONS_FILE, []) });
});

// Add question
app.post("/api/admin/questions", requireAdmin, (req, res) => {
  const { question, options, correct } = req.body || {};
  const upperCorrect = String(correct || "").toUpperCase();

  if (
    !question ||
    !Array.isArray(options) ||
    options.length !== 4 ||
    !["A", "B", "C", "D"].includes(upperCorrect)
  ) {
    return res.status(400).json({ error: "Invalid question payload" });
  }

  const questions = readJson(QUESTIONS_FILE, []);
  const newId = questions.length ? questions[questions.length - 1].id + 1 : 1;

  const newQ = {
    id: newId,
    question: String(question),
    options: options.map(String),
    correct: upperCorrect,
  };

  questions.push(newQ);
  writeJson(QUESTIONS_FILE, questions);

  res.status(201).json({ question: newQ });
});

// Update question
app.put("/api/admin/questions/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { question, options, correct } = req.body || {};
  const upperCorrect = String(correct || "").toUpperCase();

  const questions = readJson(QUESTIONS_FILE, []);
  const idx = questions.findIndex((q) => q.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  if (
    !question ||
    !Array.isArray(options) ||
    options.length !== 4 ||
    !["A", "B", "C", "D"].includes(upperCorrect)
  ) {
    return res.status(400).json({ error: "Invalid question payload" });
  }

  questions[idx] = {
    id,
    question: String(question),
    options: options.map(String),
    correct: upperCorrect,
  };
  writeJson(QUESTIONS_FILE, questions);

  res.json({ question: questions[idx] });
});

// Delete question
app.delete("/api/admin/questions/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const questions = readJson(QUESTIONS_FILE, []);
  const idx = questions.findIndex((q) => q.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  const [deleted] = questions.splice(idx, 1);
  writeJson(QUESTIONS_FILE, questions);

  res.json({ deleted });
});

// Get all results
app.get("/api/admin/results", requireAdmin, (req, res) => {
  res.json({ results: readJson(RESULTS_FILE, []) });
});

/* ================= ROOT ROUTES ================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// optional shortcuts if you want direct paths
app.get("/exam", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "exam.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

/* ================= START SERVER ================= */
app.listen(PORT, () => {
  console.log(`🚀 Secure Exam Server Running on PORT ${PORT}`);
});
