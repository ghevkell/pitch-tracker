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
  var allPitchesBlock = document.getElementById("allPitchesBlock");

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
  var strikeStreak = 0;    // for 3-in-a-row toast

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

  var storageKey = "marthaTracker.sessions.v1";

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

  function groupInFives(pitches) {
    var groups = [];
    for (var i = 0; i < pitches.length; i += 5) {
      var slice = pitches.slice(i, i + 5);
      groups.push({ index: (i / 5) + 1, pitches: slice, stats: countStats(slice) });
    }
    return groups;
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

  function shareCsvOrDownload(filename, csvText) {
    var blob = new Blob([csvText], { type: "text/csv" });

    try {
      if (navigator.share && typeof File === "function") {
        var file = new File([blob], filename, { type: "text/csv" });

        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          navigator.share({
            title: "The “Martha” Tracker CSV",
            text: "Pitch session export",
            files: [file]
          }).then(function () {
            toast("Share opened");
          }).catch(function () {});
          return;
        }
      }
    } catch (e) {}

    downloadTextFile(filename, csvText, "text/csv");
    toast("Downloaded CSV");
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
      li.textContent = p.pitchType + " • " + p.result + " • Hit:" + (p.hitLocation ? "Y" : "N");
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
    strikeStreak = 0;
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
    strikeStreak = 0;
    setSessionSubtitle();
    goToLogger();
    renderRunning();
    toast("Let’s go, Martha! Session started.");
  }

  function endSession() {
    if (!currentSession || currentSession.ended) return;
    currentSession.ended = true;
    currentSession.endedAt = new Date().toISOString();
    setSessionSubtitle();
    toast("Session ended. Nice work.");
    goToReport(currentSession);
  }

  function autoEndIfLimit() {
    if (!currentSession) return;
    if (currentSession.pitches.length >= PITCH_LIMIT && !currentSession.ended) {
      currentSession.ended = true;
      currentSession.endedAt = new Date().toISOString();
      setSessionSubtitle();
      toast("20 pitches done. Big finish!");
      goToReport(currentSession);
    }
  }

  function lastGroupCheerIfNeeded(totalPitches) {
    if (totalPitches % 5 !== 0) return;

    var start = totalPitches - 5;
    var slice = currentSession.pitches.slice(start, start + 5);
    var s = countStats(slice);

    if (s.strikePct > 50) {
      toast("🔥 Group " + (totalPitches / 5) + ": " + s.strikePct + "% strikes. Love it.");
    } else {
      toast("Group " + (totalPitches / 5) + " done. Next 5: attack the zone.");
    }
  }

  function updateStreak(result) {
    if (result === "Strike") {
      strikeStreak += 1;
      if (strikeStreak === 3) {
        toast("🎯 3 strikes in a row!");
        strikeStreak = 0; // reset so it can fire again later
      }
    } else {
      strikeStreak = 0;
    }
  }

  function logPitch() {
    if (!currentSession || currentSession.ended) return;

    var pitch = {
      n: currentSession.pitches.length + 1,
      at: new Date().toISOString(),
      pitchType: selectedPitchType,
      result: selectedResult,
      hitLocation: hitLocation
    };

    currentSession.pitches.push(pitch);

    updateStreak(pitch.result);

    resetSelections();
    renderRunning();
    updateLogButtonState();

    toast("Logged pitch #" + currentSession.pitches.length);
    lastGroupCheerIfNeeded(currentSession.pitches.length);

    autoEndIfLimit();
  }

  function undoLast() {
    if (!currentSession || currentSession.ended) return;
    if (currentSession.pitches.length === 0) return;
    currentSession.pitches.pop();
    // Streak becomes ambiguous after undo; simplest: reset it.
    strikeStreak = 0;
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

  function buildCsv(session) {
    var header = ["Pitch #", "Timestamp", "Pitch Type", "Result", "Hit Location (Y/N)"];
    var lines = [header.join(",")];

    for (var i = 0; i < session.pitches.length; i++) {
      var p = session.pitches[i];
      lines.push([
        escapeCsv(p.n),
        escapeCsv(formatDateTime(new Date(p.at))),
        escapeCsv(p.pitchType),
        escapeCsv(p.result),
        escapeCsv(p.hitLocation ? "Y" : "N")
      ].join(","));
    }

    return lines.join("\n");
  }

  function exportCurrentCsv() {
    var s = currentSession;
    if (!s) return;

    var started = new Date(s.startedAt);
    var filenameSafe = (s.name && s.name.trim() ? s.name.trim() : "martha-session")
      .replace(/[^a-z0-9-_ ]/gi, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();

    var filename = (filenameSafe || "martha-session") + "-" + started.toISOString().slice(0, 10) + ".csv";
    var csvText = buildCsv(s);

    shareCsvOrDownload(filename, csvText);
  }

  function buildCopySummaryText(session) {
    var lines = [];
    var started = new Date(session.startedAt);
    var ended = session.endedAt ? new Date(session.endedAt) : null;
    var title = session.name && session.name.trim() ? session.name.trim() : "Untitled session";
    var when = ended ? (formatDateTime(started) + " → " + formatDateTime(ended)) : formatDateTime(started);

    lines.push("The “Martha” Tracker — Session Report");
    lines.push(title + " • " + when);
    lines.push("");

    var overall = countStats(session.pitches);
    lines.push("Overall");
    lines.push("Total: " + overall.total + " | Strikes: " + overall.strikes + " | Balls: " + overall.balls + " | Strike%: " + overall.strikePct + "% | Hit(Y): " + overall.hits);
    lines.push("");

    lines.push("Grouped in 5s");
    var groups = groupInFives(session.pitches);
    if (groups.length === 0) {
      lines.push("(No pitches)");
    } else {
      for (var gi = 0; gi < groups.length; gi++) {
        var g = groups[gi];
        var startN = (g.index - 1) * 5 + 1;
        var endN = Math.min(g.index * 5, session.pitches.length);
        lines.push("Group " + g.index + " (Pitches " + startN + "–" + endN + "): Strikes " + g.stats.strikes + ", Balls " + g.stats.balls + ", Strike% " + g.stats.strikePct + "%");
      }
    }
    lines.push("");

    lines.push("All pitches");
    if (session.pitches.length === 0) {
      lines.push("(No pitches)");
    } else {
      for (var i = 0; i < session.pitches.length; i++) {
        var p = session.pitches[i];
        lines.push("#" + p.n + " — " + p.pitchType + " — " + p.result + " — Hit:" + (p.hitLocation ? "Y" : "N"));
      }
    }

    return lines.join("\n");
  }

  function copySummary() {
    if (!currentSession) return;
    var text = buildCopySummaryText(currentSession);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast("Summary copied");
      }).catch(function () {
        downloadTextFile("martha-summary.txt", text, "text/plain");
        toast("Clipboard blocked. Downloaded summary file.");
      });
    } else {
      downloadTextFile("martha-summary.txt", text, "text/plain");
      toast("Downloaded summary file.");
    }
  }

  function bannerHtml(kind, big, small) {
    return '<div class="banner ' + kind + '"><div><div class="big">' + big + '</div><div class="small">' + small + '</div></div></div>';
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

    // Find personal best group (highest strike%); tie-breaker: earliest group
    var bestIndex = -1;
    var bestPct = -1;
    for (var bi = 0; bi < groups.length; bi++) {
      if (groups[bi].stats.strikePct > bestPct) {
        bestPct = groups[bi].stats.strikePct;
        bestIndex = groups[bi].index;
      }
    }

    groupsBlock.innerHTML = "";
    if (groups.length === 0) {
      groupsBlock.textContent = "No pitches recorded.";
    } else {
      for (var gi = 0; gi < groups.length; gi++) {
        var g = groups[gi];
        var div = document.createElement("div");
        div.style.marginBottom = "12px";

        var isBest = (g.index === bestIndex && groups.length > 0);

        var kind;
        var big;
        if (isBest) {
          kind = "best";
          big = "Personal best 🏅";
        } else if (g.stats.strikePct > 50) {
          kind = "good";
          big = "Nice! ✅";
        } else {
          kind = "try";
          big = "Keep going 💪";
        }

        var small = "Group " + g.index + " — " + g.stats.strikePct + "% strikes (" + g.stats.strikes + " strikes, " + g.stats.balls + " balls)";

        var rows = "";
        for (var pi = 0; pi < g.pitches.length; pi++) {
          var p = g.pitches[pi];
          var n = (g.index - 1) * 5 + pi + 1;
          var hit = p.hitLocation ? "Y" : "N";
          rows += "<tr><td>#"+n+"</td><td>"+p.pitchType+"</td><td>"+p.result+"</td><td>"+hit+"</td></tr>";
        }

        div.innerHTML =
          bannerHtml(kind, big, small) +
          '<div class="reportTitle">Group ' + g.index + " (pitches " + ((g.index - 1) * 5 + 1) + "–" + Math.min(g.index * 5, session.pitches.length) + ")</div>" +
          '<div class="subtitle">Subtotal: Strikes ' + g.stats.strikes + " • Balls " + g.stats.balls + " • Strike% " + g.stats.strikePct + "%</div>" +
          '<table class="table" aria-label="Group ' + g.index + '">' +
          "<thead><tr><th>#</th><th>Type</th><th>Result</th><th>Hit?</th></tr></thead>" +
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

    if (session.pitches.length === 0) {
      allPitchesBlock.textContent = "No pitches recorded.";
    } else {
      var pitchRows = "";
      for (var pidx = 0; pidx < session.pitches.length; pidx++) {
        var p0 = session.pitches[pidx];
        pitchRows += "<tr><td>#"+p0.n+"</td><td>"+p0.pitchType+"</td><td>"+p0.result+"</td><td>"+(p0.hitLocation ? "Y" : "N")+"</td></tr>";
      }
      allPitchesBlock.innerHTML =
        '<table class="table" aria-label="All pitches">' +
        "<thead><tr><th>#</th><th>Type</th><th>Result</th><th>Hit?</th></tr></thead>" +
        "<tbody>" + pitchRows + "</tbody></table>";
    }

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
    toast("New session ready.");
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
