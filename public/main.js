/* ==================== main.js (FINAL ANTI-CHEAT + WATERMARK) ==================== */
/* Anti-cheat: copy/paste/devtools/multi-tab/screenshot/snipping/print/recording (best-effort) */

(function setupGlobalGuards() {
  /* ---------- Utility: Warning Trigger (only on exam page) ---------- */
  function triggerExamWarning(reason, code) {
    const examPage = document.body?.dataset?.page === "exam";
    if (examPage && typeof window.examAddWarning === "function") {
      window.examAddWarning(reason, code);
    }
  }

  /* ===========================================================
        BLOCK COPY - PASTE - CUT - RIGHT CLICK
  =========================================================== */
  ["copy", "cut", "paste"].forEach((evt) => {
    document.addEventListener(evt, (e) => {
      e.preventDefault();
      triggerExamWarning(`Attempted ${evt}`, evt.toUpperCase());
    });
  });

  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    triggerExamWarning("Right Click Blocked", "CONTEXT_MENU");
  });

  /* ===========================================================
        Screenshot / Blur helper
  =========================================================== */
  function blockScreenshot() {
    // Add body blur (75% style) – also affects live view & screenshot
    document.body.classList.add("screenshot-blur");

    // Black overlay with backdrop blur
    const overlay = document.createElement("div");
    overlay.style = `
      position:fixed;inset:0;
      background:rgba(0,0,0,0.95);
      backdrop-filter:blur(24px);
      z-index:99999999;
      pointer-events:none;
      opacity:1;
      transition:opacity .7s ease-out;
    `;
    document.body.appendChild(overlay);

    // Fade out + remove
    setTimeout(() => {
      overlay.style.opacity = "0";
    }, 500);

    setTimeout(() => {
      overlay.remove();
      document.body.classList.remove("screenshot-blur");
    }, 1500);
  }

  /* ===========================================================
        BLOCK DEVTOOLS + SHORTCUT + PRINTSCREEN + SNIPPING
  =========================================================== */
  document.addEventListener("keydown", (e) => {
    const k = (e.key || "").toLowerCase();

    /* F12 Devtools */
    if (e.key === "F12") {
      e.preventDefault();
      blockScreenshot();
      triggerExamWarning("DevTools Attempt", "F12");
      return;
    }

    /* Ctrl / Cmd restricted keys */
    if (e.ctrlKey || e.metaKey) {
      const blocked = ["c", "v", "x", "s", "u", "p", "a", "i"];
      if (blocked.includes(k)) {
        e.preventDefault();
        triggerExamWarning(
          `Blocked Shortcut ${(e.metaKey ? "CMD" : "CTRL") + "+" + k.toUpperCase()}`,
          `SHORTCUT_${k.toUpperCase()}`
        );
      }
      if (e.shiftKey && k === "i") {
        e.preventDefault();
        blockScreenshot();
        triggerExamWarning("DevTools (Ctrl/Cmd+Shift+I)", "CTRL_SHIFT_I");
      }
    }

    /* ALT+TAB Switch (cannot block, but we can warn) */
    if (e.altKey && k === "tab") {
      triggerExamWarning("App Switch (Alt+Tab)", "ALT_TAB");
    }

    /* Windows PrintScreen key (PrtSc) */
    if (e.key === "PrintScreen") {
      e.preventDefault();
      blockScreenshot();
      triggerExamWarning("Screenshot Attempt Detected (PrintScreen)", "SCREENSHOT");
    }
  });

  /* ============================ MAC Screenshot Prevention ============================ */
  // CMD+Shift+3 / 4 / 5 → different screenshot modes on macOS
  window.addEventListener("keydown", (e) => {
    const k = e.key;
    if (e.metaKey && e.shiftKey && (k === "3" || k === "4" || k === "5")) {
      // This cannot fully stop macOS screenshot, but usually intercepts before capture.
      e.preventDefault();
      blockScreenshot();
      triggerExamWarning("Mac Screenshot Attempt Blocked", "MAC_SCREENSHOT");
    }
  });

  /* Block Windows Snipping Tool (Win+Shift+S best-effort) */
  window.addEventListener("keyup", (e) => {
    if (
      e.shiftKey &&
      e.key.toLowerCase() === "s" &&
      (e.ctrlKey || e.metaKey || e.altKey)
    ) {
      blockScreenshot();
      triggerExamWarning("Snipping Tool / Screen Capture Attempt", "SNIP_TOOL");
    }
  });

  /* ===========================================================
        TAB / Window focus monitor
  =========================================================== */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      triggerExamWarning("Tab Switch detected", "TAB_CHANGE");
      blockScreenshot();
    }
  });

  window.addEventListener("blur", () => {
    document.body.classList.add("exam-blur");
    triggerExamWarning("Window focus lost", "WINDOW_BLUR");
    blockScreenshot();
  });

  window.addEventListener("focus", () => {
    document.body.classList.remove("exam-blur");
  });

  /* ===========================================================
        Block printing & PDF generation
  =========================================================== */
  window.addEventListener("beforeprint", (e) => {
    e.preventDefault();
    triggerExamWarning("Print Blocked", "PRINT");
    alert("Printing / PDF Export is blocked during the exam.");
    blockScreenshot();
  });

  /* ===========================================================
        Continuous Devtools / Recording style detection (heuristic ONLY)
        - checks large outer/inner gaps (devtools)
        - checks very low render rate (window minimized / off-screen / some recorders)
  =========================================================== */
  setInterval(() => {
    const gap = 170;
    if (
      window.outerWidth - window.innerWidth > gap ||
      window.outerHeight - window.innerHeight > gap
    ) {
      blockScreenshot();
      triggerExamWarning("DevTools Detected (Size Gap)", "DEVTOOLS_OPEN");
      document.body.classList.add("exam-blur");
    }
  }, 1200);

  // Recording / minimized heuristic – best effort only
  (function recordingGuard() {
    let last = performance.now();
    function check(ts) {
      const delta = ts - last;
      last = ts;
      // if frame delay is abnormally huge repeatedly, treat as suspicious
      if (delta > 2500 && !document.hidden) {
        triggerExamWarning(
          "Possible screen recording / background activity detected",
          "LOW_FPS_CAPTURE"
        );
        blockScreenshot();
      }
      requestAnimationFrame(check);
    }
    requestAnimationFrame(check);
  })();
})();

/* ================= LOGIN PAGE ================= */
if (document.body.dataset.page === "login") {
  document.getElementById("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();

    if (!name) return alert("Name required");
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
      return alert("Invalid Email");

    if (localStorage.getItem("submitted_" + email)) {
      return alert("⚠ You already submitted the exam. Reattempt not allowed.");
    }

    sessionStorage.setItem("examUserName", name);
    sessionStorage.setItem("examUserEmail", email);

    window.location.href = "/exam.html";
  });
}

/* ================= EXAM PAGE ================= */
if (document.body.dataset.page === "exam") {
  const userName = sessionStorage.getItem("examUserName");
  const userEmail = sessionStorage.getItem("examUserEmail");

  if (!userName || !userEmail) window.location.href = "/";
  if (localStorage.getItem("submitted_" + userEmail)) {
    alert("Exam already submitted - redirecting");
    window.location.href = "/";
  }

  document.getElementById("userInfo").textContent = `${userName} (${userEmail})`;

  let questions = [];
  let answers = [];
  let warningLog = [];
  let currentIndex = 0;
  let warningCount = 0;
  let warningLastTimestamp = 0;
  let examFinished = false;

  const MAX_WARNINGS = 3; // << as requested
  const EXAM_DURATION_SECONDS = 60 * 60; // 60 minutes
  let remainingSeconds = EXAM_DURATION_SECONDS;
  let timerInterval = null;

  /* ---------- Watermark overlay (name + email) ---------- */
  function initWatermark() {
    try {
      const existing = document.getElementById("examWatermarkOverlay");
      if (existing) existing.remove();

      const wm = document.createElement("div");
      wm.id = "examWatermarkOverlay";
      wm.className = "watermark-overlay";

      const text = `${userName} • ${userEmail}`;

      // Grid of repeated labels
      for (let i = 0; i < 24; i++) {
        const span = document.createElement("span");
        span.textContent = text;
        wm.appendChild(span);
      }

      document.body.appendChild(wm);
    } catch (e) {
      console.error("Watermark init error:", e);
    }
  }

  initWatermark();

  // ===== Warning System =====
  window.examAddWarning = (msg, code) => {
    if (examFinished) return;
    const now = Date.now();

    // Debounce warnings so the same event doesn't spam
    if (now - warningLastTimestamp < 1500) return;
    warningLastTimestamp = now;

    warningCount++;
    warningLog.push({
      count: warningCount,
      msg,
      code: code || null,
      at: new Date().toISOString(),
    });

    document.getElementById("warnings").textContent =
      `Warnings: ${warningCount}/${MAX_WARNINGS}`;
    alert(`⚠ Warning ${warningCount}/${MAX_WARNINGS}:\n${msg}`);

    if (warningCount >= MAX_WARNINGS) {
      finishExam("Exam auto-submitted due to repeated violations.");
    }
  };

  // Tab switch / hidden (extra layer here too)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      window.examAddWarning("Tab Switch detected", "TAB_SWITCH");
    }
  });

  // ===== Load Questions =====
  async function loadQuestions() {
    const res = await fetch("/api/questions");
    const data = await res.json();
    questions = data.questions || [];
    answers = new Array(questions.length).fill(null);
  }

  // ===== Timer =====
  function startTimer() {
    timerInterval = setInterval(() => {
      remainingSeconds--;
      if (remainingSeconds < 0) remainingSeconds = 0;
      const min = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
      const sec = String(remainingSeconds % 60).padStart(2, "0");
      document.getElementById("timer").textContent = `${min}:${sec}`;
      if (remainingSeconds <= 0) {
        finishExam("Time over.");
      }
    }, 1000);
  }

  // ===== Render Question =====
  function renderQuestion(index) {
    const q = questions[index];
    if (!q) return;

    const qTextEl = document.getElementById("questionText");
    const optionsEl = document.getElementById("options");
    const progressEl = document.getElementById("questionProgress");

    qTextEl.textContent = `${index + 1}. ${q.question}`;
    optionsEl.innerHTML = "";

    const selected = answers[index]?.selectedOption;

    q.options.forEach((opt, i) => {
      const letter = String.fromCharCode(65 + i);

      const label = document.createElement("label");
      label.className = "option-item";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "option";
      input.value = letter;
      input.checked = selected === letter;
      input.onchange = () => {
        answers[index] = { questionId: q.id, selectedOption: letter };
      };

      label.append(input, `${letter}. ${opt}`);
      optionsEl.append(label);
    });

    progressEl.textContent = `Question ${index + 1} of ${questions.length}`;
    document.getElementById("prevBtn").disabled = index === 0;
    document.getElementById("nextBtn").disabled = index === questions.length - 1;
  }

  // ===== Finish Exam =====
  async function finishExam(reason = "Submitted.") {
    if (examFinished) return;
    examFinished = true;

    if (timerInterval) clearInterval(timerInterval);

    localStorage.setItem("submitted_" + userEmail, "1");

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName,
          email: userEmail,
          answers: answers.filter(Boolean),
          warnings: warningLog,
        }),
      });

      const data = await res.json();

      const examSectionEl = document.getElementById("examSection");
      const resultSectionEl = document.getElementById("resultSection");
      const resultTextEl = document.getElementById("resultText");

      examSectionEl.classList.add("hidden");
      resultSectionEl.classList.remove("hidden");

      let text = `${reason}\nScore: ${data.correct}/${data.total} (${data.percentage}%)`;

      // optional: show per-question review for student
      if (Array.isArray(data.answers)) {
        text += `\n\n--- Your Answers ---\n`;
        data.answers.forEach((a, i) => {
          text += `\n${i + 1}. ${a.question}\n`;
          text += `Your answer: ${a.selectedOption || "-"}\n`;
          text += `Correct answer: ${a.correctOption}\n`;
          text += `Result: ${a.isCorrect ? "Correct ✅" : "Wrong ❌"}\n`;
        });
      }

      resultTextEl.textContent = text;
    } catch (err) {
      console.error(err);
      const resultSectionEl = document.getElementById("resultSection");
      const resultTextEl = document.getElementById("resultText");
      resultSectionEl.classList.remove("hidden");
      resultTextEl.textContent = "Submission error. Contact admin.";
    } finally {
      sessionStorage.clear();
    }
  }

  // Buttons
  document.getElementById("prevBtn").onclick = () => {
    if (currentIndex > 0) {
      currentIndex--;
      renderQuestion(currentIndex);
    }
  };

  document.getElementById("nextBtn").onclick = () => {
    if (currentIndex < questions.length - 1) {
      currentIndex++;
      renderQuestion(currentIndex);
    }
  };

  document.getElementById("submitBtn").onclick = () => {
    if (confirm("Submit exam?")) {
      finishExam("You submitted the exam.");
    }
  };

  (async () => {
    await loadQuestions();
    if (!questions.length) {
      alert("No questions configured.");
      return;
    }
    document.getElementById("examSection").classList.remove("hidden");
    startTimer();
    renderQuestion(currentIndex);
  })();
}

/* ================= ADMIN PAGE ================= */
if (document.body.dataset.page === "admin") {
  const adminLoginSection = document.getElementById("adminLoginSection");
  const adminPanelSection = document.getElementById("adminPanelSection");
  const adminPasswordInput = document.getElementById("adminPassword");
  const adminLoginBtn = document.getElementById("adminLoginBtn");
  const adminLogoutBtn = document.getElementById("adminLogoutBtn");

  const questionForm = document.getElementById("questionForm");
  const resetFormBtn = document.getElementById("resetFormBtn");

  const questionIndexInput = document.getElementById("questionIndex");
  const questionIdInput = document.getElementById("questionId");
  const questionInput = document.getElementById("questionInput");
  const optAInput = document.getElementById("optA");
  const optBInput = document.getElementById("optB");
  const optCInput = document.getElementById("optC");
  const optDInput = document.getElementById("optD");
  const correctOptionInput = document.getElementById("correctOption");

  const questionsTableBody = document.querySelector("#questionsTable tbody");
  const resultsTableBody = document.querySelector("#resultsTable tbody");

  async function loginAdmin() {
    const password = adminPasswordInput.value;
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        throw new Error("Login failed");
      }
      const data = await res.json();
      if (data.success) {
        adminLoginSection.classList.add("hidden");
        adminPanelSection.classList.remove("hidden");
        await Promise.all([renderQuestionsTable(), renderResultsTable()]);
      }
    } catch (err) {
      console.error(err);
      alert("Invalid admin password.");
    }
  }

  adminLoginBtn.addEventListener("click", loginAdmin);

  adminLogoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
      });
    } catch (e) {}
    adminPanelSection.classList.add("hidden");
    adminLoginSection.classList.remove("hidden");
  });

  async function loadQuestions() {
    const res = await fetch("/api/admin/questions");
    if (!res.ok) throw new Error("Failed to load questions");
    const data = await res.json();
    return data.questions || [];
  }

  async function loadResults() {
    const res = await fetch("/api/admin/results");
    if (!res.ok) throw new Error("Failed to load results");
    const data = await res.json();
    return data.results || [];
  }

  async function renderQuestionsTable() {
    try {
      const questions = await loadQuestions();
      questionsTableBody.innerHTML = "";

      questions.forEach((q, index) => {
        const tr = document.createElement("tr");

        const tdIndex = document.createElement("td");
        tdIndex.textContent = index + 1;

        const tdQuestion = document.createElement("td");
        tdQuestion.textContent = q.question;

        const tdCorrect = document.createElement("td");
        tdCorrect.textContent = q.correct;

        const tdActions = document.createElement("td");
        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.className = "secondary-btn";
        editBtn.style.marginRight = "0.25rem";

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.className = "secondary-btn";

        editBtn.addEventListener("click", () => {
          fillFormForEdit(q, index);
        });

        deleteBtn.addEventListener("click", async () => {
          if (confirm("Delete this question?")) {
            await deleteQuestion(q.id);
            await renderQuestionsTable();
          }
        });

        tdActions.appendChild(editBtn);
        tdActions.appendChild(deleteBtn);

        tr.appendChild(tdIndex);
        tr.appendChild(tdQuestion);
        tr.appendChild(tdCorrect);
        tr.appendChild(tdActions);

        questionsTableBody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
      alert("Error loading questions.");
    }
  }

  // ====== Show full result detail (questions + options + answers + warnings) ======
  function showResultDetails(result) {
    let text = `Student: ${result.userName} (${result.email})
Score: ${result.correct}/${result.total} (${result.percentage}%)
Submitted: ${new Date(result.submittedAt).toLocaleString()}
Warnings: ${Array.isArray(result.warnings) ? result.warnings.length : 0}
`;

    if (Array.isArray(result.warnings) && result.warnings.length) {
      text += `\n--- Warnings ---\n`;
      result.warnings.forEach((w) => {
        text += `#${w.count} [${w.code}] at ${w.at}\n  ${w.msg}\n`;
      });
    }

    if (Array.isArray(result.answers) && result.answers.length) {
      text += `\n--- Question-wise Answers ---\n`;
      result.answers.forEach((a, i) => {
        text += `\n${i + 1}. ${a.question}
Options: 
  A. ${a.options[0]}
  B. ${a.options[1]}
  C. ${a.options[2]}
  D. ${a.options[3]}
User Answer: ${a.selectedOption || "-"}
Correct Answer: ${a.correctOption}
Result: ${a.isCorrect ? "Correct ✅" : "Wrong ❌"}
`;
      });
    }

    alert(text);
  }

  async function renderResultsTable() {
    try {
      const results = await loadResults();
      resultsTableBody.innerHTML = "";

      results.forEach((r, index) => {
        const tr = document.createElement("tr");

        const tdIndex = document.createElement("td");
        tdIndex.textContent = index + 1;

        const tdName = document.createElement("td");
        tdName.textContent = r.userName;

        const tdEmail = document.createElement("td");
        tdEmail.textContent = r.email;

        const tdScore = document.createElement("td");
        tdScore.textContent = `${r.correct}/${r.total}`;

        const tdPercentage = document.createElement("td");
        tdPercentage.textContent = `${r.percentage}%`;

        const tdWarnings = document.createElement("td");
        const count = Array.isArray(r.warnings) ? r.warnings.length : 0;
        tdWarnings.textContent = count;

        const tdSubmittedAt = document.createElement("td");
        tdSubmittedAt.textContent = new Date(r.submittedAt).toLocaleString();

        const tdDetails = document.createElement("td");
        const viewBtn = document.createElement("button");
        viewBtn.textContent = "View";
        viewBtn.className = "secondary-btn";
        viewBtn.addEventListener("click", () => showResultDetails(r));
        tdDetails.appendChild(viewBtn);

        tr.appendChild(tdIndex);
        tr.appendChild(tdName);
        tr.appendChild(tdEmail);
        tr.appendChild(tdScore);
        tr.appendChild(tdPercentage);
        tr.appendChild(tdWarnings);
        tr.appendChild(tdSubmittedAt);
        tr.appendChild(tdDetails);

        resultsTableBody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
      alert("Error loading results.");
    }
  }

  function clearForm() {
    questionIndexInput.value = "";
    questionIdInput.value = "";
    questionInput.value = "";
    optAInput.value = "";
    optBInput.value = "";
    optCInput.value = "";
    optDInput.value = "";
    correctOptionInput.value = "";
  }

  function fillFormForEdit(q, index) {
    questionIndexInput.value = index;
    questionIdInput.value = q.id;
    questionInput.value = q.question;
    optAInput.value = q.options[0] || "";
    optBInput.value = q.options[1] || "";
    optCInput.value = q.options[2] || "";
    optDInput.value = q.options[3] || "";
    correctOptionInput.value = q.correct || "";
  }

  async function saveQuestion(payload, id) {
    const url = id ? `/api/admin/questions/${id}` : "/api/admin/questions";
    const method = id ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error("Failed to save question");
    }
    return res.json();
  }

  async function deleteQuestion(id) {
    const res = await fetch(`/api/admin/questions/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error("Failed to delete question");
    }
    return res.json();
  }

  questionForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const questionText = questionInput.value.trim();
    const optA = optAInput.value.trim();
    const optB = optBInput.value.trim();
    const optC = optCInput.value.trim();
    const optD = optDInput.value.trim();
    const correct = correctOptionInput.value.trim().toUpperCase();

    if (!questionText || !optA || !optB || !optC || !optD) {
      alert("Please fill in all question and option fields.");
      return;
    }

    if (!["A", "B", "C", "D"].includes(correct)) {
      alert("Correct option must be one of A, B, C, or D.");
      return;
    }

    const payload = {
      question: questionText,
      options: [optA, optB, optC, optD],
      correct,
    };

    try {
      const existingId = questionIdInput.value || null;
      await saveQuestion(payload, existingId);
      clearForm();
      await renderQuestionsTable();
    } catch (err) {
      console.error(err);
      alert("Error saving question.");
    }
  });

  resetFormBtn.addEventListener("click", () => {
    clearForm();
  });

  // Initial table load if already logged in (cookie still present)
  (async () => {
    try {
      await Promise.all([renderQuestionsTable(), renderResultsTable()]);
    } catch (e) {
      // ignore if not authorized yet
    }
  })();
}
