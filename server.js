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

/* ================= CREATE DATA FOLDER & FILES ================= */
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function ensureFile(file, data) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

ensureFile(QUESTIONS_FILE, [
  { id: 1, question: "Which HTML tag is used to include JavaScript code?", options: ["<script>", "<js>", "<javascript>", "<code>"], correct: "A" },
  { id: 2, question: "Which HTTP method is generally used to create a new resource?", options: ["GET","POST","PUT","DELETE"], correct: "B" },
  { id: 3, question: "Which of the following is NOT a JavaScript data type?", options: ["Number","String","Float","Boolean"], correct: "C" },
]);

ensureFile(RESULTS_FILE, []);

/* ================= HELPERS ================= */
function readJson(file, def){ try{ let r = fs.readFileSync(file,"utf8").trim(); return r?JSON.parse(r):def;}catch{return def;} }
function writeJson(file,data){ fs.writeFileSync(file, JSON.stringify(data,null,2)); }
function shuffle(arr){ for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }

/* ================= MIDDLEWARE ================= */
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname,"public")));

app.use((req,res,next)=>{ res.set("X-Robots-Tag","noindex,nofollow"); next(); });

/* ================= BLOCK POSTMAN / API CLIENTS ================= */
app.use((req, res, next) => {
  const ua = req.headers["user-agent"] || "";
  const allowedBrowser = ua.includes("Mozilla"); // Browser has this always.

  const openPaths = ["/", "/robots.txt", "/api/admin/login"];
  if (openPaths.includes(req.path) || req.path.startsWith("/public")) return next();

  if (!allowedBrowser) {
    return res.status(403).json({ error: "API access denied. Use browser interface only." });
  }
  next();
});

/* ================= AUTH FOR ADMIN ================= */
function requireAdmin(req,res,next){
  if(req.cookies && req.cookies.admin==="true") return next();
  return res.status(401).json({error:"Unauthorized"});
}

/* ================= ROUTES ================= */

// Get random questions (STUDENT - browser only)
app.get("/api/questions",(req,res)=>{
  const q = shuffle(readJson(QUESTIONS_FILE,[]));
  res.json({questions:q.slice(0, Math.min(100,q.length)).map(x=>({id:x.id,question:x.question,options:x.options}))});
});

// Submit exam
app.post("/api/submit",(req,res)=>{
  const {userName,email,answers,warnings}=req.body||{};
  if(!userName||!email||!Array.isArray(answers)) return res.status(400).json({error:"Invalid payload"});

  const questions=readJson(QUESTIONS_FILE,[]), map=new Map();
  questions.forEach(q=>map.set(q.id,q));

  let correct=0, formatted=[];
  answers.forEach(a=>{
    const q=map.get(a.questionId); if(!q) return;
    const sel=(a.selectedOption||"").toUpperCase().trim(), corr=q.correct.toUpperCase().trim();
    if(sel===corr) correct++;
    formatted.push({questionId:q.id,question:q.question,options:q.options,selectedOption:sel||null,correctOption:corr,isCorrect:sel===corr});
  });

  const total=questions.length, percent=(correct/total)*100;
  const results=readJson(RESULTS_FILE,[]);
  results.push({id:results.length+1,userName,email,correct,total,percentage:+percent.toFixed(2),submittedAt:new Date(),warnings:warnings||[],answers:formatted});
  writeJson(RESULTS_FILE,results);

  res.json({message:"Exam submitted successfully",correct,total,percentage:+percent.toFixed(2),answers:formatted});
});

/* ================= ADMIN ================= */
app.post("/api/admin/login",(req,res)=>{
  if(req.body.password===ADMIN_PASSWORD){
    res.cookie("admin","true",{httpOnly:true,sameSite:"lax"});
    return res.json({success:true});
  }
  res.status(401).json({error:"Invalid password"});
});

app.post("/api/admin/logout",(req,res)=>{ res.clearCookie("admin"); res.json({success:true}); });

app.get("/api/admin/questions",requireAdmin,(req,res)=>res.json({questions:readJson(QUESTIONS_FILE,[])}));

app.post("/api/admin/questions",requireAdmin,(req,res)=>{
  const {question,options,correct}=req.body||{};
  if(!question||!Array.isArray(options)||options.length!==4||!["A","B","C","D"].includes(String(correct).toUpperCase()))
    return res.status(400).json({error:"Invalid question payload"});

  const q=readJson(QUESTIONS_FILE,[]),
        n={id:q.length?q[q.length-1].id+1:1,question:String(question),options:options.map(String),correct:String(correct).toUpperCase()};
  q.push(n); writeJson(QUESTIONS_FILE,q);
  res.status(201).json({question:n});
});

app.put("/api/admin/questions/:id",requireAdmin,(req,res)=>{
  const id=+req.params.id, {question,options,correct}=req.body||{}, q=readJson(QUESTIONS_FILE,[]);
  const i=q.findIndex(x=>x.id===id); if(i===-1) return res.status(404).json({error:"Not found"});
  if(!question||!Array.isArray(options)||options.length!==4||!["A","B","C","D"].includes(String(correct).toUpperCase()))
    return res.status(400).json({error:"Invalid question payload"});
  q[i]={id,question:String(question),options:options.map(String),correct:String(correct).toUpperCase()};
  writeJson(QUESTIONS_FILE,q);
  res.json({question:q[i]});
});

app.delete("/api/admin/questions/:id",requireAdmin,(req,res)=>{
  const id=+req.params.id, q=readJson(QUESTIONS_FILE,[]), i=q.findIndex(x=>x.id===id);
  if(i===-1) return res.status(404).json({error:"Not found"});
  const r=q.splice(i,1); writeJson(QUESTIONS_FILE,q); res.json({deleted:r[0]});
});

app.get("/api/admin/results",requireAdmin,(req,res)=>res.json({results:readJson(RESULTS_FILE,[])}));

/* ================= ROOT ================= */
app.get("/",(req,res)=>{
  res.sendFile(path.join(__dirname,"public","index.html"));
});

app.listen(PORT,()=>console.log(`🚀 Secure Exam Server Running on PORT ${PORT}`));
