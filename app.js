(function () {
  var PITCH_LIMIT = 20;

  var PITCH_TYPES = ["FB", "CH", "Drop", "Rise", "Screw", "Curve"];
  var RESULTS = ["Strike", "Ball"];

  // Elements
  var setupCard = document.getElementById("setupCard");
  var loggerCard = document.getElementById("loggerCard");
  var reportCard = document.getElementById("reportCard");
  var historyCard = document.getElementById("historyCard");

  var sessionNameInput = document.getElementById("sessionName");
  var startBtn = document.getElementById("startBtn");
  var viewHistoryBtn = document.getElementById("viewHistoryBtn");
  var clearAllBtn = document.getElementById("clearAllBtn");

  var pitchTypeButtons = document.getElementById("pitchTypeButtons");
  var resultButtons = document.getElementById("resultButtons");

  var hitNoBtn = document.getElementById("hitNoBtn");
  var hitYesBtn = document.getElementById("hitYesBtn");
  var notesInput = document.getElementById("notes");

  var logBtn = document.getElementById("logBtn");
  var undoBtn = document.getElementById("undoBtn");
  var endBtn = document.getElementById("endBtn");

  var pitchCountEl = document.getElementById("pitchCount");
  var pitchLimitEl = document.getElementById("pitchLimit");
  var runningStatsEl = document.getElementById("runningStats");
  var lastFiveEl = document.getElementById("lastFive");

  var sessionSubtitle = document.getElementById("sessionSubtitle");
  var reportSubtitle = document.getElementById("reportSubtitle");
  var overallBlock = document.getElementById("overallBlock");
  var groupsBlock = document.getElementById("groupsBlock");
  var byTypeBlock = document.getElementById("byTypeBlock");

  var copySummaryBtn = document.getElementById("copySummaryBtn");
  var exportCsvBtn = document.getElementById("exportCsvBtn");
  var saveBtn = document.getElementById("saveBtn");
  var backToStartBtn = document.getElementById("backToStartBtn");

  var historyList = document.getElementById("historyList");
  var historyBackBtn = document.getElementById("historyBackBtn");

  var toastEl = document.getElementById("toast");

  pitchLimitEl.textContent = String(PITCH_LIMIT);

  // State
  var currentSession = null;
  var selectedPitchType = null;
  var selectedResult = null;
  var hitLocation = false; // default No

  // Helpers
  function pad2(n) {
    var s = String(n);
    return s.length < 2 ? ("0" + s) : s;
  }

  function formatDateTime(d) {
    var yyyy = d.getFullYear();
    var mm = pad2(d.getMonth() + 1);
    var dd = pad2(d.getDate());
    var hh = pad2(d.getHours());
    var mi = pad2(d.getMinutes());
    return yyyy + "-" + mm + "-" + dd + " " + hh + ":" + mi;
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.style.opacity = "1";
    window.clearTimeout(toastEl._t);
    toastEl._t = window.setTimeout(function () {
      toastEl.style.opacity = "0";
    }, 1400);
  }

  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }

  var storageKey = "pitchTracker.sessions.v1";

  function loadSessions() {
    try {
      var raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveSessions(sessions) {
    localStorage.setItem(storageKey, JSON.stringify(sessions));
  }

  function setHitLocation(val) {
    hitLocation = !!val;
    if (hitLocation) {
      hitYesBtn.classList.add("active");
      hitNoBtn.classList.remove("active");
    } else {
      hitNoBtn.classList.add("active");
      hitYesBtn.classList.remove("active");
    }
  }

  function resetSelections() {
    selectedPitchType = null;
    selectedResult = null;
    notesInput.value = "";
    setHitLocation(false);

    var choices = document.querySelectorAll(".choice");
    for (var i = 0; i < choices.length; i++) choices[i].classList.remove("active");

    logBtn.disabled = true;
  }

  function updateLogButtonState() {
    var ok = !!(selectedPitchType && selectedResult && currentSession && !currentSession.ended);
    logBtn.disabled = !ok;
  }

  function countStats(pitches) {
    var strikes = 0, balls = 0, hits = 0;
    for (var i = 0; i < pitches.length; i++) {
      var p = pitches[i];
      if (p.result === "Strike") strikes++;
      if (p.result === "Ball") balls++;
      if (p.hitLocation === true) hits++;
    }
    var total = pitches.length;
    var strikePct = total ? Math.round((strikes / total) * 100) : 0;
    return { total: total, strikes: strikes, balls: balls, hits: hits, strikePct: strikePct };
  }

  function byTypeStats(pitches) {
    var map = {};
    for (var i = 0; i < PITCH_TYPES.length; i++) {
      var t = PITCH_TYPES[i];
      map[t] = { type: t, total: 0, strikes: 0, balls: 0, hits: 0, strikePct: 0 };
    }
    for (var j = 0; j < pitches.length; j++) {
      var p = pitches[j];
      if (!map[p.pitchType]) {
        map[p.pitchType] = { type: p.pitchType, total: 0, strikes: 0, balls: 0, hits: 0, strikePct: 0 };
      }
      var row = map[p.pitchType];
      row.total++;
      if (p.result === "Strike") row.strikes++;
      if (p.result === "Ball") row.balls++;
      if (p.hitLocation) row.hits++;
    }
    var out = [];
    for (var k = 0; k < PITCH_TYPES.length; k++) {
      var key = PITCH_TYPES[k];
      var r = map[key];
      r.strikePct = r.total ? Math.round((r.strikes / r.total) * 100) : 0;
      out.push(r);
    }
    return out;
  }

  function groupInFives(pitches) {
    var groups = [];
    for (var i = 0; i < pitches.length; i += 5) {
      var slice = pitches.slice(i, i + 5);
      groups.push({ index: (i / 5) + 1, pitches: slice, stats: countStats(slice) });
    }
    return groups;
  }

  function escapeCsv(val) {
    var s = String(val == null ? "" : val);
    if (s.indexOf('"') >= 0) s = s.replace(/"/g, '""');
    if (s.indexOf(",") >= 0 || s.indexOf("\n") >= 0 || s.indexOf('"') >= 0) return '"' + s + '"';
    return s;
  }

  function downloadTextFile(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "text/plain" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function makeSummaryText(session) {
    var s = countStats(session.pitches);
    var name = session.name && session.name.trim() ? ('"' + session.name.trim() + '"') : "Session";
    return name + " • " + s.total + " pitches • Strikes: " + s.strikes + ", Balls: " + s.balls +
      " • Strike%: " + s.strikePct + "% • Hit location (Y): " + s.hits;
  }

  function buildChoiceButtons(container, items, onPick, extraClassFn) {
    container.innerHTML = "";
    for (var i = 0; i < items.length; i++) {
      (function (item) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "choice" + (extraClassFn ? (" " + extraClassFn(item)) : "");
        btn.textContent = item;
        btn.addEventListener("click", function () { onPick(item, btn); });
        container.appendChild(btn);
      })(items[i]);
    }
  }

  function renderLastFive(pitches) {
    lastFiveEl.innerHTML = "";
    var last = pitches.slice(Math.max(0, pitches.length - 5));
    if (last.length === 0) {
      var li0 = document.createElement("li");
      li0.textContent = "No pitches logged yet.";
      lastFiveEl.appendChild(li0);
      return;
    }
    for (var i = 0; i < last.length; i++) {
      var p = last[i];
      var li = document.createElement("li");
      var hit = p.hitLocation ? " • Hit:Y" : " • Hit:N";
      var note = p.notes ? (" • Note:" + p.notes) : "";
      li.textContent = p.pitchType + " • " + p.result + hit + note;
      lastFiveEl.appendChild(li);
    }
  }

  function renderRunning() {
    var pitches = currentSession ? currentSession.pitches : [];
    var stats = countStats(pitches);

    pitchCountEl.textContent = String(stats.total);
    runningStatsEl.textContent = "Strikes: " + stats.strikes + " • Balls: " + stats.balls + " • Strike%: " + stats.strikePct + "%";

    undoBtn.disabled = !currentSession || currentSession.ended || pitches.length === 0;
    renderLastFive(pitches);

    if (currentSession && currentSession.ended) {
      logBtn.disabled = true;
    } else {
      updateLogButtonState();
    }
  }

  function setSessionSubtitle() {
    if (!currentSession) {
      sessionSubtitle.textContent = "No session running";
      return;
    }
    var name = currentSession.name && currentSession.name.trim() ? currentSession.name.trim() : "Untitled session";
    sessionSubtitle.textContent = currentSession.ended ? (name + " (ended)") : (name + " (running)");
  }

  function goToSetup() {
    currentSession = null;
    resetSelections();
    setSessionSubtitle();
    pitchCountEl.textContent = "0";
    runningStatsEl.textContent = "Strikes: 0 • Balls: 0 • Strike%: 0%";
    lastFiveEl.innerHTML = "";

    show(setupCard);
    hide(loggerCard);
    hide(reportCard);
    hide(historyCard);
  }

  function goToLogger() {
    hide(setupCard);
    show(loggerCard);
    hide(reportCard);
    hide(historyCard);
  }

  function goToReport(session) {
    hide(setupCard);
    hide(loggerCard);
    show(reportCard);
    hide(historyCard);
    renderReport(session);
  }

  function goToHistory() {
    hide(setupCard);
    hide(loggerCard);
    hide(reportCard);
    show(historyCard);
    renderHistory();
  }

  function startSession() {
    var now = new Date();
    currentSession = {
      name: sessionNameInput.value.trim(),
      startedAt: now.toISOString(),
      endedAt: null,
      ended: false,
      pitches: [],
      savedId: null
    };
    resetSelections();
    setSessionSubtitle();
    goToLogger();
    renderRunning();
    toast("Session started");
  }

  function endSession() {
    if (!currentSession || currentSession.ended) return;
    currentSession.ended = true;
    currentSession.endedAt = new Date().toISOString();
    setSessionSubtitle();
    toast("Session ended");
    goToReport(currentSession);
  }

  function autoEndIfLimit() {
    if (!currentSession) return;
    if (currentSession.pitches.length >= PITCH_LIMIT && !currentSession.ended) {
      currentSession.ended = true;
      currentSession.endedAt = new Date().toISOString();
      setSessionSubtitle();
      toast("20 pitches reached. Session complete.");
      goToReport(currentSession);
    }
  }

  function logPitch() {
    if (!currentSession || currentSession.ended) return;

    var pitch = {
      n: currentSession.pitches.length + 1,
      at: new Date().toISOString(),
      pitchType: selectedPitchType,
      result: selectedResult,
      hitLocation: hitLocation,
      notes: notesInput.value.trim()
    };

    currentSession.pitches.push(pitch);

    // Reset only result + notes; keep pitch type selected
    selectedResult = null;
    notesInput.value = "";

    var resBtns = document.querySelectorAll("#resultButtons .choice");
    for (var i = 0; i < resBtns.length; i++) resBtns[i].classList.remove("active");

    renderRunning();
    updateLogButtonState();
    autoEndIfLimit();
  }

  function undoLast() {
    if (!currentSession || currentSession.ended) return;
    if (currentSession.pitches.length === 0) return;
    currentSession.pitches.pop();
    renderRunning();
    updateLogButtonState();
    toast("Undid last pitch");
  }

  function saveCurrentSession() {
    if (!currentSession) return;
    var sessions = loadSessions();
    var savedId = String(Date.now()) + "_" + Math.random().toString(16).slice(2);
    var toSave = JSON.parse(JSON.stringify(currentSession));
    toSave.savedId = savedId;

    sessions.unshift(toSave);
    saveSessions(sessions);

    currentSession.savedId = savedId;
    saveBtn.disabled = true;
    toast("Saved");
  }

  function exportCurrentCsv() {
    var s = currentSession;
    if (!s) return;

    var started = new Date(s.startedAt);
    var filenameSafe = (s.name && s.name.trim() ? s.name.trim() : "pitch-session")
      .replace(/[^a-z0-9-_ ]/gi, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();

    var filename = (filenameSafe || "pitch-session") + "-" + started.toISOString().slice(0, 10) + ".csv";

    var header = ["Pitch #", "Timestamp", "Pitch Type", "Result", "Hit Location (Y/N)", "Notes"];
    var lines = [header.join(",")];

    for (var i = 0; i < s.pitches.length; i++) {
      var p = s.pitches[i];
      lines.push([
        escapeCsv(p.n),
        escapeCsv(formatDateTime(new Date(p.at))),
        escapeCsv(p.pitchType),
        escapeCsv(p.result),
        escapeCsv(p.hitLocation ? "Y" : "N"),
        escapeCsv(p.notes || "")
      ].join(","));
    }

    downloadTextFile(filename, lines.join("\n"), "text/csv");
  }

  function copySummary() {
    if (!currentSession) return;
    var text = makeSummaryText(currentSession);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast("Summary copied");
      }).catch(function () {
        downloadTextFile("session-summary.txt", text, "text/plain");
        toast("Clipboard blocked. Downloaded summary file.");
      });
    } else {
      downloadTextFile("session-summary.txt", text, "text/plain");
      toast("Downloaded summary file.");
    }
  }

  function renderReport(session) {
    var started = new Date(session.startedAt);
    var ended = session.endedAt ? new Date(session.endedAt) : null;

    var title = session.name && session.name.trim() ? session.name.trim() : "Untitled session";
    var when = ended ? (formatDateTime(started) + " → " + formatDateTime(ended)) : formatDateTime(started);
    reportSubtitle.textContent = title + " • " + when;

    var overall = countStats(session.pitches);

    overallBlock.innerHTML =
      '<div class="reportTitle">Overall</div>' +
      '<table class="table" aria-label="Overall stats">' +
      "<tr><th>Total pitches</th><td>" + overall.total + "</td></tr>" +
      "<tr><th>Strikes</th><td>" + overall.strikes + "</td></tr>" +
      "<tr><th>Balls</th><td>" + overall.balls + "</td></tr>" +
      "<tr><th>Strike %</th><td>" + overall.strikePct + "%</td></tr>" +
      "<tr><th>Hit location (Y)</th><td>" + overall.hits + "</td></tr>" +
      "</table>";

    var groups = groupInFives(session.pitches);
    groupsBlock.innerHTML = "";
    if (groups.length === 0) {
      groupsBlock.textContent = "No pitches recorded.";
    } else {
      for (var gi = 0; gi < groups.length; gi++) {
        var g = groups[gi];

        var div = document.createElement("div");
        div.style.marginBottom = "12px";

        var rows = "";
        for (var pi = 0; pi < g.pitches.length; pi++) {
          var p = g.pitches[pi];
          var n = (g.index - 1) * 5 + pi + 1;
          var hit = p.hitLocation ? "Y" : "N";
          var note = p.notes || "";
          rows += "<tr><td>#"+n+"</td><td>"+p.pitchType+"</td><td>"+p.result+"</td><td>"+hit+"</td><td>"+note+"</td></tr>";
        }

        div.innerHTML =
          '<div class="reportTitle">Group ' + g.index + " (pitches " + ((g.index - 1) * 5 + 1) + "–" + Math.min(g.index * 5, session.pitches.length) + ")</div>" +
          '<div class="subtitle">Subtotal: Strikes ' + g.stats.strikes + " • Balls " + g.stats.balls + " • Strike% " + g.stats.strikePct + "%</div>" +
          '<table class="table" aria-label="Group ' + g.index + '">' +
          "<thead><tr><th>#</th><th>Type</th><th>Result</th><th>Hit?</th><th>Notes</th></tr></thead>" +
          "<tbody>" + rows + "</tbody></table>";

        groupsBlock.appendChild(div);
      }
    }

    var rowsByType = byTypeStats(session.pitches);
    var body = "";
    for (var i = 0; i < rowsByType.length; i++) {
      var r = rowsByType[i];
      body += "<tr><td>" + r.type + "</td><td>" + r.total + "</td><td>" + r.strikes + "</td><td>" + r.balls +
        "</td><td>" + r.strikePct + "%</td><td>" + r.hits + "</td></tr>";
    }

    byTypeBlock.innerHTML =
      '<table class="table" aria-label="By pitch type">' +
      "<thead><tr><th>Type</th><th>Total</th><th>Strikes</th><th>Balls</th><th>Strike%</th><th>Hit Y</th></tr></thead>" +
      "<tbody>" + body + "</tbody></table>";

    saveBtn.disabled = !!session.savedId;
  }

  function renderHistory() {
    var sessions = loadSessions();
    historyList.innerHTML = "";

    if (sessions.length === 0) {
      var div = document.createElement("div");
      div.className = "subtitle";
      div.textContent = "No saved sessions yet.";
      historyList.appendChild(div);
      return;
    }

    for (var i = 0; i < sessions.length; i++) {
      (function (s) {
        var stats = countStats(s.pitches);
        var started = new Date(s.startedAt);
        var title = s.name && s.name.trim() ? s.name.trim() : "Untitled session";
        var meta = formatDateTime(started) + " • " + stats.total + " pitches • Strike% " + stats.strikePct + "%";

        var item = document.createElement("div");
        item.className = "historyItem";

        var left = document.createElement("div");
        var t = document.createElement("div");
        t.className = "historyItemTitle";
        t.textContent = title;

        var m = document.createElement("div");
        m.className = "historyItemMeta";
        m.textContent = meta;

        left.appendChild(t);
        left.appendChild(m);

        var right = document.createElement("div");
        right.className = "historyItemBtns";

        var del = document.createElement("button");
        del.className = "btn danger";
        del.style.height = "44px";
        del.textContent = "Delete";
        del.addEventListener("click", function (e) {
          e.stopPropagation();
          deleteSession(s.savedId);
        });

        right.appendChild(del);

        item.appendChild(left);
        item.appendChild(right);

        item.addEventListener("click", function () {
          currentSession = JSON.parse(JSON.stringify(s));
          setSessionSubtitle();
          goToReport(currentSession);
          toast("Loaded saved session");
        });

        historyList.appendChild(item);
      })(sessions[i]);
    }
  }

  function deleteSession(savedId) {
    var sessions = loadSessions();
    var next = [];
    for (var i = 0; i < sessions.length; i++) {
      if (sessions[i].savedId !== savedId) next.push(sessions[i]);
    }
    saveSessions(next);
    renderHistory();
    toast("Deleted");
  }

  function clearAll() {
    localStorage.removeItem(storageKey);
    toast("All saved sessions cleared");
  }

  // Build choices
  buildChoiceButtons(pitchTypeButtons, PITCH_TYPES, function (item, btn) {
    selectedPitchType = item;
    var btns = document.querySelectorAll("#pitchTypeButtons .choice");
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove("active");
    btn.classList.add("active");
    updateLogButtonState();
  });

  buildChoiceButtons(resultButtons, RESULTS, function (item, btn) {
    selectedResult = item;
    var btns = document.querySelectorAll("#resultButtons .choice");
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove("active");
    btn.classList.add("active");
    updateLogButtonState();
  }, function (item) {
    return item === "Strike" ? "good" : "bad";
  });

  setHitLocation(false);

  // Event listeners
  startBtn.addEventListener("click", startSession);
  endBtn.addEventListener("click", endSession);
  logBtn.addEventListener("click", logPitch);
  undoBtn.addEventListener("click", undoLast);

  hitNoBtn.addEventListener("click", function () { setHitLocation(false); });
  hitYesBtn.addEventListener("click", function () { setHitLocation(true); });

  copySummaryBtn.addEventListener("click", copySummary);
  exportCsvBtn.addEventListener("click", exportCurrentCsv);
  saveBtn.addEventListener("click", saveCurrentSession);

  backToStartBtn.addEventListener("click", function () {
    sessionNameInput.value = "";
    goToSetup();
    toast("Ready for a new session");
  });

  viewHistoryBtn.addEventListener("click", goToHistory);
  historyBackBtn.addEventListener("click", goToSetup);

  clearAllBtn.addEventListener("click", function () {
    if (confirm("Delete all saved sessions from this device?")) {
      clearAll();
    }
  });

  // Init
  goToSetup();
})();
