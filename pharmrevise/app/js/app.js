/* PharmRevise TZ — views and hash router. */
(function () {
  var DRUGS = window.PR_DRUGS || [], DIS = window.PR_DISEASES || [], NEM = window.PR_NEMLIT || [],
    NOTES = window.PR_NOTES || [], META = window.PR_META || { counts: {} };
  var drugById = {}, disById = {}, noteById = {};
  DRUGS.forEach(function (d) { drugById[d.id] = d; });
  DIS.forEach(function (d) { disById[d.id] = d; });
  NOTES.forEach(function (n) { noteById[n.id] = n; });

  var view = document.getElementById("view");
  var esc = MD.esc;
  var S = function () { return Store.s; };

  // ---------- helpers ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }
  function setTitle(t, back) {
    $("#title").textContent = t;
    $("#backBtn").hidden = !back;
  }
  function groupBy(list, fn) {
    var g = {}, order = [];
    list.forEach(function (x) { var k = fn(x); if (!g[k]) { g[k] = []; order.push(k); } g[k].push(x); });
    return order.sort().map(function (k) { return [k, g[k]]; });
  }
  function ul(items, cls) {
    if (!items || !items.length) return "";
    var html = "", open = false;
    items.forEach(function (it) {
      if (typeof it === "string" && it.indexOf("## ") === 0) {
        if (open) { html += "</ul>"; open = false; }
        html += "<h4>" + MD.inline(it.slice(3)) + "</h4>";
      } else {
        if (!open) { html += "<ul" + (cls ? " class='" + cls + "'" : "") + ">"; open = true; }
        html += "<li>" + MD.inline(String(it)) + "</li>";
      }
    });
    return html + (open ? "</ul>" : "");
  }
  function sec(title, body, opts) {
    opts = opts || {};
    if (!body) return "";
    return "<details class='sec " + (opts.cls || "") + "'" + (opts.open ? " open" : "") + "><summary>" + title +
      "</summary><div class='body md'>" + body + "</div></details>";
  }
  function md(s) { return s ? MD.render(s) : ""; }
  function levelOf(d) { var m = /^([ABCDS])\b/.exec(d.nemlit || ""); return m ? m[1] : ""; }
  function srcBadge(z) {
    return z.source === "notes7"
      ? "<span class='badge'>STG 7th Ed. 2026 · your notes</span>"
      : "<span class='badge warn'>STG 2021-based · verify vs 7th Ed.</span>";
  }
  function key(type, id) { return type + ":" + id; }
  function highlight(text, q) {
    if (!q) return esc(text);
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
  }
  function matches(hay, q) { return hay.toLowerCase().indexOf(q.toLowerCase()) >= 0; }
  function diseaseHay(z) { return [z.name, z.category, z.aka.join(" "), z.stg || ""].join(" "); }
  function drugHay(d) { return [d.name, d.class, d.group, (d.uses || []).join(" ")].join(" "); }

  function liDisease(z, q) {
    var st = S().studied[key("disease", z.id)] ? "<span class='tick'>✓</span>" : "";
    return "<li><a href='#/disease/" + z.id + "'><div class='t'><b>" + highlight(z.name, q) + "</b><small>" +
      esc(z.category) + (z.stg ? " · " + esc(z.stg) : "") + "</small></div>" + st + "</a></li>";
  }
  function liDrug(d, q) {
    var st = S().studied[key("drug", d.id)] ? "<span class='tick'>✓</span>" : "";
    var lv = levelOf(d);
    return "<li><a href='#/drug/" + d.id + "'><div class='t'><b>" + highlight(Quiz.shortName(d), q) + "</b><small>" +
      esc(d.class) + "</small></div>" + (lv ? "<span class='badge lvl'>" + lv + "</span>" : "") + st + "</a></li>";
  }

  // ---------- views ----------
  function home() {
    setTitle("PharmRevise TZ", false);
    var s = S(), total = DIS.length + DRUGS.length;
    var studied = Object.keys(s.studied).length;
    var dayIdx = Math.floor(Date.now() / 86400000);
    var dd = DRUGS[dayIdx % DRUGS.length], dz = DIS[(dayIdx * 7) % DIS.length];
    var dueCount = Quiz.due(Quiz.cards()).filter(function (c) { return s.cards[c.id]; }).length;
    var recent = s.recent.slice(0, 5).map(function (k) {
      var p = k.split(":"), o = p[0] === "drug" ? drugById[p[1]] : disById[p[1]];
      return o ? (p[0] === "drug" ? liDrug(o) : liDisease(o)) : "";
    }).join("");
    view.innerHTML =
      "<div class='card hero'><h2>Habari! Ready to revise?</h2><div class='muted small'>Study streak: <b>" + Store.streak() +
      " day(s)</b> · Studied " + studied + "/" + total + " topics · Quiz accuracy " +
      (s.quiz.answered ? Math.round(100 * s.quiz.correct / s.quiz.answered) + "%" : "—") + "</div>" +
      "<div class='progress' style='background:rgba(255,255,255,.25)'><i style='width:" + Math.round(100 * studied / total) + "%;background:#f4b942'></i></div></div>" +
      "<input class='search' id='homeSearch' placeholder='Search diseases, drugs, NEMLIT, notes…'>" +
      "<div class='grid'>" +
      tile("#/diseases", "\u{1FA7A}", "Revise by disease", DIS.length + " conditions") +
      tile("#/drugs", "\u{1F48A}", "Revise by drug", DRUGS.length + " monographs") +
      tile("#/quiz", "❓", "Quiz", "MCQs & auto-questions") +
      tile("#/flash", "\u{1F0CF}", "Flashcards", dueCount ? dueCount + " due for review" : "Spaced repetition") +
      tile("#/interactions", "⚠️", "Interaction checker", "Drug–drug & food") +
      tile("#/tools", "\u{1F9EE}", "Dose calculators", Tools.list.length + " tools") +
      tile("#/nemlit", "\u{1F4CB}", "NEMLIT 2021", (META.counts.nemlit || NEM.length) + " entries") +
      tile("#/notes", "\u{1F4D3}", "My class notes", NOTES.length + " documents") +
      "</div>" +
      "<div class='card'><h2>Today's picks</h2><ul class='list'>" + liDisease(dz) + liDrug(dd) + "</ul></div>" +
      (recent ? "<div class='card'><h2>Recently opened</h2><ul class='list'>" + recent + "</ul></div>" : "") +
      "<div class='disclaimer'>Study aid only. Disease topics from your 7th Edition (2026) class notes are marked green; topics written from the 2021 STG are marked amber — cross-check against the 7th Edition before exams or practice.</div>";
    $("#homeSearch").addEventListener("keydown", function (e) {
      if (e.key === "Enter") location.hash = "#/search/" + encodeURIComponent(this.value);
    });
  }
  function tile(href, ic, t, sub) {
    return "<a class='tile' href='" + href + "'><span class='ic'>" + ic + "</span><b>" + t + "</b><small>" + sub + "</small></a>";
  }

  var listState = { dq: "", dcat: "", gq: "", ggroup: "" };

  function diseases() {
    setTitle("Diseases", false);
    var cats = groupBy(DIS, function (z) { return z.category; }).map(function (g) { return g[0]; });
    view.innerHTML = "<input class='search' id='q' placeholder='Search conditions (name, Swahili, synonyms)…' value='" + esc(listState.dq) + "'>" +
      "<div class='chips' id='cats'><button class='chip" + (listState.dcat ? "" : " on") + "' data-c=''>All</button>" +
      cats.map(function (c) { return "<button class='chip" + (listState.dcat === c ? " on" : "") + "' data-c='" + esc(c) + "'>" + esc(c) + "</button>"; }).join("") +
      "</div><div id='res'></div>";
    function draw() {
      var q = listState.dq.trim();
      var list = DIS.filter(function (z) { return (!listState.dcat || z.category === listState.dcat) && (!q || matches(diseaseHay(z), q)); });
      $("#res").innerHTML = list.length ? groupBy(list, function (z) { return z.category; }).map(function (g) {
        return "<div class='group-h'>" + esc(g[0]) + " (" + g[1].length + ")</div><div class='card' style='padding:0 12px'><ul class='list'>" +
          g[1].sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (z) { return liDisease(z, q); }).join("") + "</ul></div>";
      }).join("") : "<div class='empty'>No matching condition.</div>";
    }
    $("#q").addEventListener("input", function () { listState.dq = this.value; draw(); });
    $("#cats").addEventListener("click", function (e) {
      var b = e.target.closest(".chip"); if (!b) return;
      listState.dcat = b.dataset.c;
      [].forEach.call(this.children, function (c) { c.classList.toggle("on", c === b); });
      draw();
    });
    draw();
  }

  function drugs() {
    setTitle("Drugs", false);
    var groups = groupBy(DRUGS, function (d) { return d.group; }).map(function (g) { return g[0]; });
    view.innerHTML = "<input class='search' id='q' placeholder='Search drug name, class or use…' value='" + esc(listState.gq) + "'>" +
      "<div class='chips' id='grps'><button class='chip" + (listState.ggroup ? "" : " on") + "' data-c=''>All</button>" +
      groups.map(function (c) { return "<button class='chip" + (listState.ggroup === c ? " on" : "") + "' data-c='" + esc(c) + "'>" + esc(c) + "</button>"; }).join("") +
      "</div><div id='res'></div>";
    function draw() {
      var q = listState.gq.trim();
      var list = DRUGS.filter(function (d) { return (!listState.ggroup || d.group === listState.ggroup) && (!q || matches(drugHay(d), q)); });
      $("#res").innerHTML = list.length ? groupBy(list, function (d) { return d.group; }).map(function (g) {
        return "<div class='group-h'>" + esc(g[0]) + " (" + g[1].length + ")</div><div class='card' style='padding:0 12px'><ul class='list'>" +
          g[1].sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (d) { return liDrug(d, q); }).join("") + "</ul></div>";
      }).join("") : "<div class='empty'>No matching drug.</div>";
    }
    $("#q").addEventListener("input", function () { listState.gq = this.value; draw(); });
    $("#grps").addEventListener("click", function (e) {
      var b = e.target.closest(".chip"); if (!b) return;
      listState.ggroup = b.dataset.c;
      [].forEach.call(this.children, function (c) { c.classList.toggle("on", c === b); });
      draw();
    });
    draw();
  }

  function actions(type, id, name) {
    var k = key(type, id), s = S();
    return "<div class='actions'>" +
      "<button class='btn" + (s.studied[k] ? " on" : "") + "' data-act='studied'>" + (s.studied[k] ? "✓ Studied" : "Mark as studied") + "</button>" +
      "<button class='btn" + (s.bookmarks[k] ? " on" : "") + "' data-act='bookmark'>" + (s.bookmarks[k] ? "★ Saved" : "☆ Save") + "</button>" +
      "<a class='btn primary' href='#/quizrun/" + type + "/" + id + "'>Quiz me</a>" +
      "<a class='btn' href='#/flashrun/" + type + "/" + id + "'>Flashcards</a>" +
      "</div>";
  }
  function noteBox(type, id) {
    var k = key(type, id);
    return sec("✏️ My notes", "<textarea class='in' id='mynote' placeholder='Write your own notes, mnemonics, lecturer tips…'>" +
      esc(S().notes[k] || "") + "</textarea><p class='small muted'>Saved automatically on this phone.</p>", { open: !!S().notes[k] });
  }
  function wireActions(type, id, name) {
    var k = key(type, id);
    view.addEventListener("click", function h(e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      if (b.dataset.act === "studied") {
        var on = Store.toggle("studied", k); b.classList.toggle("on", on); b.textContent = on ? "✓ Studied" : "Mark as studied";
        Store.markDay(); toast(on ? "Marked as studied" : "Unmarked");
      } else if (b.dataset.act === "bookmark") {
        var on2 = Store.toggle("bookmarks", k); b.classList.toggle("on", on2); b.textContent = on2 ? "★ Saved" : "☆ Save";
        toast(on2 ? "Saved to bookmarks" : "Removed from bookmarks");
      } else if (b.dataset.act === "share") {
        var text = b.dataset.text || name;
        if (window.AndroidApp && AndroidApp.share) AndroidApp.share(text);
        else if (navigator.share) navigator.share({ text: text });
      }
    });
    var ta = $("#mynote");
    if (ta) ta.addEventListener("input", function () {
      if (this.value.trim()) S().notes[k] = this.value; else delete S().notes[k];
      Store.save();
    });
    Store.touch(k);
  }

  function disease(id) {
    var z = disById[id];
    if (!z) return notFound();
    setTitle(z.name, true);
    var drugChips = (z.drugs || []).map(function (did) {
      var d = drugById[did];
      return "<a class='chip link' href='#/drug/" + did + "'>" + esc(Quiz.shortName(d)) + (levelOf(d) ? " · " + levelOf(d) : "") + "</a>";
    }).join("");
    var notes7 = z.source === "notes7";
    var feat = notes7
      ? (z.signsMd ? "<h4>Signs</h4>" + md(z.signsMd) : "") + (z.symptomsMd ? "<h4>Symptoms</h4>" + md(z.symptomsMd) : "")
      : ul(z.features);
    var overview = notes7 ? md(z.intro) : (z.summary ? "<p>" + MD.inline(z.summary) + "</p>" : "");
    var causes = notes7 ? md(z.etiologyMd) : ul(z.causes);
    var risk = notes7 ? md(z.riskMd) : ul(z.risk);
    var inv = ul(z.investigations) + (z.diagnosis ? "<p><b>Diagnosis:</b> " + MD.inline(z.diagnosis) + "</p>" : "");
    var nonph = notes7 ? md(z.nonpharmMd) : ul(z.nonpharm);
    var ph = notes7 ? md(z.pharmMd) : ul(z.treatment);
    var shareText = z.name + "\n\nPharmacist advice:\n- " + (z.advice || []).join("\n- ") + "\n\n(PharmRevise TZ)";
    view.innerHTML =
      "<div class='page-h'><div class='row wrap'>" + srcBadge(z) + "<span class='badge'>" + esc(z.category) + "</span></div>" +
      "<h2>" + esc(z.name) + "</h2><div class='small muted'>" + esc(z.stg || "") + (z.aka.length ? " · Also: " + esc(z.aka.join(", ")) : "") + "</div></div>" +
      actions("disease", id, z.name) +
      sec("📖 Overview", overview, { open: true }) +
      sec("🦠 Causes / etiology", causes) +
      sec("⚠️ Risk factors", risk) +
      sec("🔬 Pathophysiology", notes7 ? md(z.pathoMd) : "") +
      sec("🩺 Clinical features (signs & symptoms)", feat, { open: true }) +
      sec("🧪 Investigations & diagnosis", inv) +
      sec("🥗 Non-pharmacological management", nonph) +
      sec("💊 Pharmacological treatment" + (notes7 ? " (STG 7th Ed.)" : ""), ph, { open: true }) +
      sec("👶 Special groups (pregnancy, children, HIV)", ul(z.special)) +
      sec("📉 Complications", ul(z.complications)) +
      sec("🚨 Danger signs & referral", ul(z.danger), { cls: "alert" }) +
      sec("🗣️ Pharmacist advice to the patient", ul(z.advice), { cls: "advice", open: true }) +
      sec("⭐ Exam pearls", ul(z.pearls), { cls: "pearl", open: true }) +
      sec("🔄 What changed from the 6th Edition (2021)", z.changes ? md(z.changes) : "") +
      (drugChips ? "<div class='card'><h2>Medicines for this condition</h2><div class='pill-row'>" + drugChips + "</div></div>" : "") +
      noteBox("disease", id) +
      "<div class='actions'><button class='btn' data-act='share' data-text='" + esc(shareText) + "'>Share counselling points</button>" +
      (z.notesFile ? "<a class='btn' href='#/note/" + z.notesFile + "'>Open full class note</a>" : "") + "</div>";
    wireActions("disease", id, z.name);
  }

  function ddiHtml(list, food) {
    if (!list || !list.length) return "";
    return list.map(function (x) {
      if (x.note) return "<p class='muted'>" + esc(x.note) + "</p>";
      return "<div class='ddi" + (food ? " food" : "") + "'><b>" + esc(x.with) + "</b>" + esc(x.effect) +
        (x.action ? "<div class='act'>" + esc(x.action) + "</div>" : "") + "</div>";
    }).join("");
  }

  function drug(id) {
    var d = drugById[id];
    if (!d) return notFound();
    setTitle(Quiz.shortName(d), true);
    var lv = levelOf(d);
    var dis = (d.diseases || []).map(function (zid) {
      return "<a class='chip link' href='#/disease/" + zid + "'>" + esc(disById[zid].name) + "</a>";
    }).join("");
    var kv = "<dl class='kv'>" +
      "<dt>Class</dt><dd>" + esc(d.class) + "</dd>" +
      "<dt>NEMLIT 2021</dt><dd>" + esc(d.nemlit || "—") + "</dd>" +
      "<dt>Forms</dt><dd>" + esc(d.forms || "—") + "</dd>" +
      (d.storage ? "<dt>Storage</dt><dd>" + esc(d.storage) + "</dd>" : "") + "</dl>";
    var special = "<dl class='kv'>" +
      (d.preg ? "<dt>Pregnancy</dt><dd>" + esc(d.preg) + "</dd>" : "") +
      (d.lact ? "<dt>Breastfeeding</dt><dd>" + esc(d.lact) + "</dd>" : "") +
      (d.renal ? "<dt>Renal</dt><dd>" + esc(d.renal) + "</dd>" : "") +
      (d.hepatic ? "<dt>Hepatic</dt><dd>" + esc(d.hepatic) + "</dd>" : "") + "</dl>";
    var shareText = Quiz.shortName(d) + " — patient advice:\n- " + (d.advice || []).join("\n- ") + "\n\n(PharmRevise TZ)";
    view.innerHTML =
      "<div class='page-h'><div class='row wrap'><span class='badge'>" + esc(d.group) + "</span>" +
      (lv ? "<span class='badge lvl'>NEMLIT level " + lv + "</span>" : "") + "</div>" +
      "<h2>" + esc(d.name) + "</h2><div class='small muted'>" + esc(d.class) + "</div></div>" +
      actions("drug", id, d.name) +
      "<div class='card'>" + kv + "</div>" +
      sec("⚙️ Mechanism of action", "<p>" + MD.inline(d.moa || "") + "</p>", { open: true }) +
      sec("🎯 Indications (uses)", ul(d.uses), { open: true }) +
      sec("📏 Dosing", ul(d.dose), { open: true }) +
      sec("⛔ Contraindications", ul(d.ci)) +
      sec("🤢 Side effects", ul(d.se)) +
      sec("🔀 Drug–drug interactions", ddiHtml(d.ddi), { cls: "alert", open: true }) +
      sec("🍽️ Food & alcohol interactions", ddiHtml(d.food, true)) +
      sec("🤰 Pregnancy, breastfeeding, renal & hepatic", special) +
      sec("📊 Monitoring", ul(d.monitor)) +
      sec("🗣️ Patient counselling (pharmacist advice)", ul(d.advice), { cls: "advice", open: true }) +
      sec("⭐ Exam pearls", ul(d.pearls), { cls: "pearl", open: true }) +
      (dis ? "<div class='card'><h2>Used in these conditions</h2><div class='pill-row'>" + dis + "</div></div>" : "") +
      noteBox("drug", id) +
      "<div class='actions'><button class='btn' data-act='share' data-text='" + esc(shareText) + "'>Share counselling points</button>" +
      "<a class='btn' href='#/interactions/" + id + "'>Check with other drugs</a></div>";
    wireActions("drug", id, d.name);
  }

  // ---------- quiz ----------
  function quizMenu() {
    setTitle("Quiz", false);
    var s = S().quiz;
    var cats = groupBy(DIS, function (z) { return z.category; }).map(function (g) { return g[0]; });
    var groups = groupBy(DRUGS, function (d) { return d.group; }).map(function (g) { return g[0]; });
    view.innerHTML =
      "<div class='card'><div class='stats'><div class='stat'><b>" + s.answered + "</b><span class='small muted'>answered</span></div>" +
      "<div class='stat'><b>" + (s.answered ? Math.round(100 * s.correct / s.answered) : 0) + "%</b><span class='small muted'>correct</span></div>" +
      "<div class='stat'><b>" + Store.streak() + "</b><span class='small muted'>day streak</span></div></div></div>" +
      "<a class='btn primary block' href='#/quizrun/all/x'>Quick mixed quiz (10)</a><p></p>" +
      "<div class='grid'>" +
      tile("#/quizrun/bank/x", "\u{1F4DD}", "Exam-style MCQs", "Hand-written bank") +
      tile("#/quizrun/weak/x", "\u{1F3AF}", "My weak topics", "Topics below 70%") +
      tile("#/quizrun/law/x", "⚖️", "Pharmacy law", "Forensic pharmacy") +
      tile("#/flash", "\u{1F0CF}", "Flashcards", "Spaced repetition") + "</div>" +
      "<div class='group-h'>By disease category</div><div class='chips' style='flex-wrap:wrap'>" +
      cats.map(function (c) { return "<a class='chip' href='#/quizrun/category/" + encodeURIComponent(c) + "'>" + esc(c) + "</a>"; }).join("") + "</div>" +
      "<div class='group-h'>By drug group</div><div class='chips' style='flex-wrap:wrap'>" +
      groups.map(function (c) { return "<a class='chip' href='#/quizrun/group/" + encodeURIComponent(c) + "'>" + esc(c) + "</a>"; }).join("") + "</div>" +
      "<p class='small muted'>Tip: open any disease or drug and tap <b>Quiz me</b> to test just that topic.</p>";
  }

  function quizRun(type, id) {
    id = decodeURIComponent(id || "");
    var label = type === "disease" ? disById[id].name : type === "drug" ? Quiz.shortName(drugById[id]) :
      type === "category" || type === "group" ? id : type === "law" ? "Pharmacy law" : type === "bank" ? "Exam MCQs" : type === "weak" ? "Weak topics" : "Mixed quiz";
    setTitle(label, true);
    var qs = Quiz.build({ type: type, id: id }, 10);
    if (!qs.length) { view.innerHTML = "<div class='empty'>No questions available yet for this selection. Try a mixed quiz first.</div>"; return; }
    var i = 0, score = 0, wrong = [];
    function show() {
      if (i >= qs.length) return finish();
      var q = qs[i];
      view.innerHTML = "<div class='small muted'>Question " + (i + 1) + " of " + qs.length + " · Score " + score + "</div>" +
        "<div class='progress'><i style='width:" + Math.round(100 * i / qs.length) + "%'></i></div>" +
        "<div class='card'><div class='quiz-q'>" + esc(q.q) + "</div>" +
        q.opts.map(function (o, k) { return "<button class='opt' data-k='" + k + "'>" + esc(o) + "</button>"; }).join("") +
        "<div id='after'></div></div>";
      var done = false;
      view.querySelectorAll(".opt").forEach(function (b) {
        b.addEventListener("click", function () {
          if (done) return; done = true;
          var picked = q.opts[+b.dataset.k], ok = picked === q.a;
          if (ok) score++; else wrong.push(q);
          Store.recordAnswer(q.topic, ok); Store.save();
          view.querySelectorAll(".opt").forEach(function (x) {
            var t = q.opts[+x.dataset.k];
            if (t === q.a) x.classList.add("right"); else if (x === b) x.classList.add("wrong");
          });
          var link = disById[q.topic] ? "#/disease/" + q.topic : drugById[q.topic] ? "#/drug/" + q.topic : q.topic === "law" ? "#/notes" : "";
          $("#after").innerHTML = (q.why ? "<div class='explain'>" + (ok ? "✅ Correct. " : "❌ Answer: <b>" + esc(q.a) + "</b>. ") + esc(q.why) + "</div>" :
            "<div class='explain'>" + (ok ? "✅ Correct." : "❌ Answer: <b>" + esc(q.a) + "</b>") + "</div>") +
            "<div class='actions'>" + (link ? "<a class='btn' href='" + link + "'>Revise this topic</a>" : "") +
            "<button class='btn primary' id='next'>" + (i + 1 < qs.length ? "Next →" : "See results") + "</button></div>";
          $("#next").addEventListener("click", function () { i++; show(); });
        });
      });
    }
    function finish() {
      var pct = Math.round(100 * score / qs.length);
      S().quiz.history = [{ t: Date.now(), label: label, score: score, n: qs.length }].concat(S().quiz.history).slice(0, 30);
      Store.save();
      view.innerHTML = "<div class='card' style='text-align:center'><h2>" + (pct >= 80 ? "🎉 Excellent!" : pct >= 50 ? "👍 Good effort" : "📚 Keep revising") + "</h2>" +
        "<div style='font-size:2.2rem;font-weight:700;color:var(--brand)'>" + score + "/" + qs.length + "</div><div class='muted'>" + pct + "%</div></div>" +
        (wrong.length ? "<div class='group-h'>Review your mistakes</div>" + wrong.map(function (q) {
          return "<div class='card'><b>" + esc(q.q) + "</b><div class='explain'>Answer: <b>" + esc(q.a) + "</b>" + (q.why ? "<br>" + esc(q.why) : "") + "</div></div>";
        }).join("") : "") +
        "<div class='actions'><a class='btn primary' href='#/quizrun/" + type + "/" + encodeURIComponent(id || "x") + "?r=" + Date.now() + "'>Try another set</a><a class='btn' href='#/quiz'>Quiz menu</a></div>";
    }
    show();
  }

  // ---------- flashcards ----------
  function flashMenu() {
    setTitle("Flashcards", true);
    var all = Quiz.cards(), dueN = Quiz.due(all).length, seen = Object.keys(S().cards).length;
    view.innerHTML = "<div class='card'><div class='stats'><div class='stat'><b>" + all.length + "</b><span class='small muted'>cards</span></div>" +
      "<div class='stat'><b>" + seen + "</b><span class='small muted'>learning</span></div>" +
      "<div class='stat'><b>" + dueN + "</b><span class='small muted'>due now</span></div></div></div>" +
      "<p class='small muted'>Cards you know come back after 1, 3, 7, 16 then 35 days; cards you miss come back today. Mechanisms, counselling, interactions, contraindications, danger signs and exam pearls are all covered.</p>" +
      "<a class='btn primary block' href='#/flashrun/all/x'>Study all due cards</a><p></p>" +
      "<div class='grid'>" + tile("#/flashrun/drugs/x", "\u{1F48A}", "Drug cards", "MOA, counselling, DDIs") +
      tile("#/flashrun/diseases/x", "\u{1FA7A}", "Disease cards", "Danger signs, advice, drugs") + "</div>";
  }

  function flashRun(type, id) {
    var scope = type === "all" ? null : { type: type, id: id };
    setTitle("Flashcards", true);
    var deck = Quiz.due(Quiz.cards(scope));
    if (type === "disease" || type === "drug") deck = Quiz.cards(scope); // topic decks: always all cards
    deck = deck.slice(0, 30);
    var i = 0, known = 0;
    function show() {
      if (i >= deck.length) {
        view.innerHTML = "<div class='card' style='text-align:center'><h2>Session complete</h2><p>" + known + " of " + deck.length + " known.</p>" +
          "<a class='btn primary' href='#/flash'>Back to flashcards</a></div>";
        return;
      }
      var c = deck[i];
      view.innerHTML = "<div class='small muted'>Card " + (i + 1) + " of " + deck.length + "</div><div class='progress'><i style='width:" + Math.round(100 * i / deck.length) + "%'></i></div>" +
        "<div class='card flash' id='fc'><div class='front'>" + esc(c.front) + "</div><div class='small muted' id='hint'>Tap to reveal</div>" +
        "<div class='back md' id='back' hidden>" + ul(c.back) + "</div></div>" +
        "<div class='actions' id='gr' hidden><button class='btn' style='flex:1' data-g='0'>✗ Again</button><button class='btn primary' style='flex:1' data-g='1'>✓ I knew it</button></div>";
      $("#fc").addEventListener("click", function () { $("#back").hidden = false; $("#hint").hidden = true; $("#gr").hidden = false; });
      $("#gr").addEventListener("click", function (e) {
        var b = e.target.closest("[data-g]"); if (!b) return;
        var ok = b.dataset.g === "1"; if (ok) known++;
        Quiz.grade(c, ok); i++; show();
      });
    }
    if (!deck.length) { view.innerHTML = "<div class='empty'>🎉 No cards due right now. Come back later or start a topic deck from any disease or drug page.</div>"; return; }
    show();
  }

  // ---------- other views ----------
  function interactions(pre) {
    setTitle("Interaction checker", true);
    view.innerHTML = "<div id='ix'></div>";
    Tools.checker($("#ix"));
    if (pre && drugById[pre]) {
      var ev = document.createElement("div"); ev.dataset.add = pre; $("#ix").appendChild(ev); ev.click(); ev.remove();
    }
  }

  function tools() {
    setTitle("Dose calculators", true);
    view.innerHTML = "<div class='card' style='padding:0 12px'><ul class='list'>" + Tools.list.map(function (t) {
      return "<li><a href='#/tool/" + t.id + "'><span style='font-size:1.4rem'>" + t.icon + "</span><div class='t'><b>" + esc(t.title) + "</b></div></a></li>";
    }).join("") + "</ul></div><div class='disclaimer'>Calculators are for learning. Always double-check doses against the STG/NEMLIT and the product leaflet.</div>";
  }
  function tool(id) {
    var t = Tools.list.filter(function (x) { return x.id === id; })[0];
    if (!t) return notFound();
    setTitle(t.title, true);
    view.innerHTML = "<div class='card'>" + t.html + "</div>";
    view.querySelectorAll("input,select").forEach(function (el) { el.addEventListener("input", t.calc); el.addEventListener("change", t.calc); });
  }

  var nemState = { q: "", lvl: "" };
  function nemlit() {
    setTitle("NEMLIT 2021", true);
    view.innerHTML = "<input class='search' id='q' placeholder='Search medicine or dosage form…' value='" + esc(nemState.q) + "'>" +
      "<div class='chips' id='lv'>" + ["", "A", "B", "C", "D", "S"].map(function (l) {
        return "<button class='chip" + (nemState.lvl === l ? " on" : "") + "' data-l='" + l + "'>" + (l ? "Level " + l : "All levels") + "</button>";
      }).join("") + "</div>" +
      "<p class='small muted'>A dispensary · B health centre · C district hospital · D regional referral · S specialist. Prescriber: ACO A; CO A–B; AMO A–C; MO A–D; specialist all. Parsed automatically from the 2021 PDF text — a few rows may be merged; confirm in the official list.</p><div id='res'></div>";
    function draw() {
      var q = nemState.q.trim();
      var list = NEM.filter(function (n) { return (!nemState.lvl || n.level === nemState.lvl) && (!q || matches(n.name + " " + n.forms + " " + n.section, q)); });
      var shown = list.slice(0, 300);
      $("#res").innerHTML = (list.length ? groupBy(shown, function (n) { return n.section || "Other"; }).map(function (g) {
        return "<div class='group-h'>" + esc(g[0]) + "</div><div class='card' style='padding:0 12px'><ul class='list'>" + g[1].map(function (n) {
          return "<li><div class='item'><div class='t'><b>" + highlight(n.name, q) + "</b><small style='white-space:normal'>" + esc(n.forms) + "</small></div><span class='badge lvl'>" + n.level + "</span></div></li>";
        }).join("") + "</ul></div>";
      }).join("") : "<div class='empty'>No match.</div>") + (list.length > 300 ? "<p class='small muted'>Showing 300 of " + list.length + " — refine your search.</p>" : "");
    }
    $("#q").addEventListener("input", function () { nemState.q = this.value; draw(); });
    $("#lv").addEventListener("click", function (e) {
      var b = e.target.closest(".chip"); if (!b) return; nemState.lvl = b.dataset.l;
      [].forEach.call(this.children, function (c) { c.classList.toggle("on", c === b); }); draw();
    });
    draw();
  }

  function notes() {
    setTitle("My class notes", true);
    view.innerHTML = "<p class='small muted'>Your Google Drive study notes, available offline.</p>" +
      groupBy(NOTES, function (n) { return n.group; }).map(function (g) {
        return "<div class='group-h'>" + esc(g[0]) + "</div><div class='card' style='padding:0 12px'><ul class='list'>" + g[1].map(function (n) {
          return "<li><a href='#/note/" + n.id + "'><span>📄</span><div class='t'><b>" + esc(n.title) + "</b><small>" + Math.round(n.md.length / 1000) + "k characters</small></div></a></li>";
        }).join("") + "</ul></div>";
      }).join("");
  }
  function note(id, q) {
    var n = noteById[id];
    if (!n) return notFound();
    setTitle(n.title, true);
    view.innerHTML = "<input class='search' id='fq' placeholder='Find in this note…' value='" + esc(q || "") + "'><div class='card md' id='nb'>" + MD.render(n.md) + "</div>";
    var nb = $("#nb"), base = nb.innerHTML;
    function find() {
      var v = $("#fq").value.trim();
      nb.innerHTML = base;
      if (v.length < 3) return;
      var re = new RegExp("(" + v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![^<]*>)", "gi");
      nb.innerHTML = base.replace(re, "<mark>$1</mark>");
      var m = nb.querySelector("mark"); if (m) m.scrollIntoView({ block: "center" });
    }
    $("#fq").addEventListener("change", find);
    if (q) find();
  }

  function search(q) {
    q = decodeURIComponent(q || "");
    setTitle("Search", true);
    view.innerHTML = "<input class='search' id='sq' placeholder='Search everything…' value='" + esc(q) + "'><div id='res'></div>";
    var input = $("#sq");
    function draw() {
      var v = input.value.trim();
      if (v.length < 2) { $("#res").innerHTML = "<div class='empty'>Type at least 2 letters.</div>"; return; }
      function nameFirst(nameOf) {
        return function (a, b) { return (matches(nameOf(b), v) ? 1 : 0) - (matches(nameOf(a), v) ? 1 : 0); };
      }
      var dz = DIS.filter(function (z) { return matches(diseaseHay(z), v); }).sort(nameFirst(function (z) { return z.name + " " + z.aka.join(" "); }));
      var dr = DRUGS.filter(function (d) { return matches(drugHay(d), v); }).sort(nameFirst(function (d) { return d.name; }));
      var nm = NEM.filter(function (n) { return matches(n.name, v); }).slice(0, 15);
      var nt = NOTES.filter(function (n) { return matches(n.md, v); }).map(function (n) {
        var i = n.md.toLowerCase().indexOf(v.toLowerCase());
        return { n: n, snip: n.md.slice(Math.max(0, i - 60), i + 80).replace(/[#*|>\\]/g, " ") };
      });
      var html = "";
      if (dz.length) html += "<div class='group-h'>Diseases (" + dz.length + ")</div><div class='card' style='padding:0 12px'><ul class='list'>" + dz.map(function (z) { return liDisease(z, v); }).join("") + "</ul></div>";
      if (dr.length) html += "<div class='group-h'>Drugs (" + dr.length + ")</div><div class='card' style='padding:0 12px'><ul class='list'>" + dr.map(function (d) { return liDrug(d, v); }).join("") + "</ul></div>";
      if (nm.length) html += "<div class='group-h'>NEMLIT 2021</div><div class='card' style='padding:0 12px'><ul class='list'>" + nm.map(function (n) {
        return "<li><div class='item'><div class='t'><b>" + highlight(n.name, v) + "</b><small>" + esc(n.forms) + "</small></div><span class='badge lvl'>" + n.level + "</span></div></li>";
      }).join("") + "</ul></div>";
      if (nt.length) html += "<div class='group-h'>In your notes (" + nt.length + ")</div><div class='card' style='padding:0 12px'><ul class='list'>" + nt.map(function (x) {
        return "<li><a href='#/note/" + x.n.id + "/" + encodeURIComponent(v) + "'><div class='t'><b>" + esc(x.n.title) + "</b><small style='white-space:normal'>…" + highlight(x.snip, v) + "…</small></div></a></li>";
      }).join("") + "</ul></div>";
      $("#res").innerHTML = html || "<div class='empty'>Nothing found for “" + esc(v) + "”.</div>";
    }
    input.addEventListener("input", function () { clearTimeout(draw._t); draw._t = setTimeout(draw, 200); });
    draw();
    if (!q) input.focus();
  }

  function bookmarks() {
    setTitle("Bookmarks & my notes", true);
    var s = S();
    function items(map) {
      return Object.keys(map).sort(function (a, b) { return (map[b] > map[a]) ? 1 : -1; }).map(function (k) {
        var p = k.split(":"), o = p[0] === "drug" ? drugById[p[1]] : disById[p[1]];
        return o ? (p[0] === "drug" ? liDrug(o) : liDisease(o)) : "";
      }).join("");
    }
    var b = items(s.bookmarks), n = items(s.notes);
    view.innerHTML = "<div class='group-h'>Saved topics</div>" + (b ? "<div class='card' style='padding:0 12px'><ul class='list'>" + b + "</ul></div>" : "<div class='empty'>Tap ☆ Save on any disease or drug.</div>") +
      "<div class='group-h'>Topics with my notes</div>" + (n ? "<div class='card' style='padding:0 12px'><ul class='list'>" + n + "</ul></div>" : "<div class='empty'>Add personal notes at the bottom of any topic.</div>");
  }

  function progress() {
    setTitle("My progress", true);
    var s = S(), bt = s.quiz.byTopic;
    var studiedD = DIS.filter(function (z) { return s.studied[key("disease", z.id)]; }).length;
    var studiedG = DRUGS.filter(function (d) { return s.studied[key("drug", d.id)]; }).length;
    var cats = groupBy(DIS, function (z) { return z.category; }).map(function (g) {
      var n = g[1].filter(function (z) { return s.studied[key("disease", z.id)]; }).length;
      return "<div class='row small'><span class='spacer'>" + esc(g[0]) + "</span><span>" + n + "/" + g[1].length + "</span></div><div class='progress'><i style='width:" + Math.round(100 * n / g[1].length) + "%'></i></div>";
    }).join("");
    var weak = Object.keys(bt).filter(function (k) { return bt[k].a >= 2; }).sort(function (a, b) { return bt[a].c / bt[a].a - bt[b].c / bt[b].a; }).slice(0, 8).map(function (k) {
      var o = disById[k] || drugById[k], nm = o ? (o.class ? Quiz.shortName(o) : o.name) : (k === "law" ? "Pharmacy law" : k);
      var href = disById[k] ? "#/disease/" + k : drugById[k] ? "#/drug/" + k : "#/quizrun/law/x";
      return "<li><a href='" + href + "'><div class='t'><b>" + esc(nm) + "</b><small>" + bt[k].c + "/" + bt[k].a + " correct</small></div><span class='badge warn'>" + Math.round(100 * bt[k].c / bt[k].a) + "%</span></a></li>";
    }).join("");
    var hist = s.quiz.history.slice(0, 10).map(function (h) {
      return "<li><div class='item'><div class='t'><b>" + esc(h.label) + "</b><small>" + new Date(h.t).toLocaleDateString() + "</small></div><span class='badge'>" + h.score + "/" + h.n + "</span></div></li>";
    }).join("");
    view.innerHTML = "<div class='card'><div class='stats'><div class='stat'><b>" + studiedD + "/" + DIS.length + "</b><span class='small muted'>diseases</span></div>" +
      "<div class='stat'><b>" + studiedG + "/" + DRUGS.length + "</b><span class='small muted'>drugs</span></div>" +
      "<div class='stat'><b>" + Store.streak() + "</b><span class='small muted'>day streak</span></div></div></div>" +
      "<div class='card'><h2>Diseases studied by category</h2>" + cats + "</div>" +
      "<div class='card'><h2>Weakest quiz topics</h2>" + (weak ? "<ul class='list'>" + weak + "</ul><a class='btn primary' href='#/quizrun/weak/x'>Practise weak topics</a>" : "<p class='muted'>Answer some quizzes to see this.</p>") + "</div>" +
      (hist ? "<div class='card'><h2>Recent quizzes</h2><ul class='list'>" + hist + "</ul></div>" : "");
  }

  function more() {
    setTitle("More", false);
    view.innerHTML = "<div class='card' style='padding:0 12px'><ul class='list'>" +
      [["#/notes", "📓", "My class notes", "Offline copies of your Drive notes"],
       ["#/nemlit", "📋", "NEMLIT 2021 browser", "Medicines, forms and levels of use"],
       ["#/interactions", "⚠️", "Interaction checker", "Drug–drug and food interactions"],
       ["#/tools", "🧮", "Dose calculators", "Paediatric, ALu, artesunate, TB, CrCl…"],
       ["#/flash", "🃏", "Flashcards", "Spaced repetition"],
       ["#/bookmarks", "★", "Bookmarks & my notes", "Saved topics"],
       ["#/progress", "📈", "My progress", "Studied topics, quiz performance"],
       ["#/settings", "⚙️", "Settings", "Theme, text size, backup"],
       ["#/about", "ℹ️", "About & sources", "Editions, disclaimer"]].map(function (r) {
        return "<li><a href='" + r[0] + "'><span style='font-size:1.3rem;width:28px;text-align:center'>" + r[1] + "</span><div class='t'><b>" + r[2] + "</b><small>" + r[3] + "</small></div></a></li>";
      }).join("") + "</ul></div>";
  }

  function settings() {
    setTitle("Settings", true);
    var st = S().settings;
    view.innerHTML = "<div class='card'><label class='f'>Theme</label><select class='in' id='th'>" +
      [["auto", "Follow phone"], ["light", "Light"], ["dark", "Dark"]].map(function (o) { return "<option value='" + o[0] + "'" + (st.theme === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") +
      "</select><label class='f'>Text size: <span id='fsv'>" + st.fs + "</span>px</label><input type='range' min='14' max='22' value='" + st.fs + "' id='fs' style='width:100%'></div>" +
      "<div class='card'><h2>Backup</h2><p class='small muted'>Copy your progress, bookmarks and notes to keep them safe or move to a new phone.</p>" +
      "<div class='actions'><button class='btn' id='exp'>Copy backup text</button><button class='btn' id='imp'>Restore from text</button></div>" +
      "<textarea class='in' id='bk' placeholder='Backup text appears here / paste backup to restore' hidden></textarea></div>" +
      "<div class='card'><h2>Reset</h2><button class='btn' id='rst' style='color:var(--danger)'>Erase all progress on this phone</button></div>";
    $("#th").addEventListener("change", function () { st.theme = this.value; Store.save(); applySettings(); });
    $("#fs").addEventListener("input", function () { st.fs = +this.value; $("#fsv").textContent = st.fs; Store.save(); applySettings(); });
    $("#exp").addEventListener("click", function () {
      var t = $("#bk"); t.hidden = false; t.value = Store.exportJson(); t.select();
      try { document.execCommand("copy"); toast("Backup copied"); } catch (e) { toast("Select and copy the text"); }
    });
    $("#imp").addEventListener("click", function () {
      var t = $("#bk");
      if (t.hidden || !t.value.trim()) { t.hidden = false; t.value = ""; t.focus(); toast("Paste your backup, then tap Restore again"); return; }
      try { Store.importJson(t.value); toast("Restored"); applySettings(); } catch (e) { toast("That backup text is not valid"); }
    });
    $("#rst").addEventListener("click", function () { if (confirm("Erase all progress, bookmarks and notes?")) { Store.reset(); applySettings(); toast("Reset done"); } });
  }

  function about() {
    setTitle("About & sources", true);
    var c = META.counts;
    view.innerHTML = "<div class='card md'><h2>PharmRevise TZ v1.0</h2><p>An offline revision companion for pharmacy students and pharmacists in Tanzania: revise by disease or by drug, test yourself, and keep your class notes in your pocket.</p>" +
      "<h3>Content</h3><ul><li>" + c.diseases + " disease topics</li><li>" + c.drugs + " drug monographs</li><li>" + c.nemlit + " NEMLIT 2021 entries</li><li>" + c.mcqs + " hand-written MCQs plus auto-generated questions</li><li>" + c.notes + " of your class-note documents</li></ul>" +
      "<h3>Sources & editions</h3><ul>" +
      "<li><b>STG/NEMLIT 7th Edition (2026)</b> — disease topics marked green are built from your class notes, which were written from the 7th Edition text, including the “What changed from 2021” boxes.</li>" +
      "<li><b>STG/NEMLIT 6th Edition (2021)</b> — the Drive copy supplied the NEMLIT medicine list and levels, and Chapter 1 (emergencies). Topics marked amber (malaria, HIV, TB, STIs, infections, mental health, obstetrics, etc.) follow the 2021 STG and national programme guidelines and must be checked against the 7th Edition.</li>" +
      "<li>Drug monographs (mechanism, interactions, food, counselling, storage) are compiled from standard references (BNF/WHO Model Formulary style) and aligned to STG dosing where available.</li></ul>" +
      "<blockquote>This app is a study aid, not a clinical reference. Doses, levels of use and recommendations change — always confirm with the current STG/NEMLIT, product information and your facilitators before exams or patient care.</blockquote>" +
      "<p class='small'>Data built " + esc(META.built || "") + ".</p></div>";
  }

  function notFound() { setTitle("Not found", true); view.innerHTML = "<div class='empty'>That page does not exist.</div>"; }

  // ---------- router ----------
  var routes = [
    [/^\/?$/, home, "home"],
    [/^\/diseases$/, diseases, "diseases"],
    [/^\/disease\/([\w-]+)$/, disease, "diseases"],
    [/^\/drugs$/, drugs, "drugs"],
    [/^\/drug\/([\w-]+)$/, drug, "drugs"],
    [/^\/quiz$/, quizMenu, "quiz"],
    [/^\/quizrun\/(\w+)\/([^?]*)/, quizRun, "quiz"],
    [/^\/flash$/, flashMenu, "quiz"],
    [/^\/flashrun\/(\w+)\/([\w-]*)$/, flashRun, "quiz"],
    [/^\/interactions\/?([\w-]*)$/, interactions, "more"],
    [/^\/tools$/, tools, "more"],
    [/^\/tool\/([\w-]+)$/, tool, "more"],
    [/^\/nemlit$/, nemlit, "more"],
    [/^\/notes$/, notes, "more"],
    [/^\/note\/([\w-]+)\/?(.*)$/, function (id, q) { note(id, decodeURIComponent(q || "")); }, "more"],
    [/^\/search\/?(.*)$/, search, "home"],
    [/^\/bookmarks$/, bookmarks, "more"],
    [/^\/progress$/, progress, "more"],
    [/^\/more$/, more, "more"],
    [/^\/settings$/, settings, "more"],
    [/^\/about$/, about, "more"]
  ];

  function route() {
    var h = location.hash.replace(/^#/, "") || "/";
    // replace the view node so old listeners are dropped
    var fresh = view.cloneNode(false); view.parentNode.replaceChild(fresh, view); view = fresh;
    for (var i = 0; i < routes.length; i++) {
      var m = routes[i][0].exec(h);
      if (m) {
        document.querySelectorAll(".tabbar a").forEach(function (a) { a.classList.toggle("active", a.dataset.tab === routes[i][2]); });
        try { routes[i][1].apply(null, m.slice(1)); } catch (e) { view.innerHTML = "<div class='empty'>Something went wrong: " + esc(String(e)) + "</div>"; }
        window.scrollTo(0, 0);
        return;
      }
    }
    notFound();
  }

  function applySettings() {
    var st = S().settings, dark = st.theme === "dark" || (st.theme === "auto" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.setProperty("--fs", st.fs + "px");
  }

  // Android back button: go back inside the app, or let the activity close on the home screen.
  window.appHandleBack = function () {
    var h = location.hash.replace(/^#/, "");
    if (h && h !== "/") { history.back(); return true; }
    return false;
  };

  $("#backBtn").addEventListener("click", function () { history.length > 1 ? history.back() : (location.hash = "#/"); });
  $("#searchBtn").addEventListener("click", function () { location.hash = "#/search/"; });
  window.addEventListener("hashchange", route);
  applySettings();
  route();
})();
