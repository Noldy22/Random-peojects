/* Question generation (hand-written bank + auto-generated from the drug/disease data) and flashcards. */
(function () {
  var DRUGS = window.PR_DRUGS || [], DIS = window.PR_DISEASES || [], MCQ = window.PR_MCQS || [];
  var drugById = {}, disById = {};
  DRUGS.forEach(function (d) { drugById[d.id] = d; });
  DIS.forEach(function (d) { disById[d.id] = d; });

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function short(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function shortName(d) { return d.name.replace(/\s*\(.*?\)\s*/g, " ").trim(); }

  function q(topic, text, answer, wrong, why) {
    var opts = shuffle([answer].concat(wrong.slice(0, 3)));
    return { topic: topic, q: text, opts: opts, a: answer, why: why || "" };
  }

  function distinct(list, exclude, n) {
    var seen = {}, out = [];
    exclude.forEach(function (e) { seen[String(e).toLowerCase()] = 1; });
    shuffle(list).forEach(function (x) {
      var k = String(x).toLowerCase();
      if (!seen[k] && out.length < n) { seen[k] = 1; out.push(x); }
    });
    return out;
  }

  // ---- generators: each returns a question or null ----
  var gens = {
    drugClass: function (d) {
      var wrong = distinct(DRUGS.map(function (x) { return x.class; }), [d.class], 3);
      return q(d.id, "Which class does " + shortName(d) + " belong to?", d.class, wrong, d.moa);
    },
    drugUse: function (d) {
      if (!d.uses || !d.uses.length) return null;
      var right = pick(d.uses);
      var others = [];
      DRUGS.forEach(function (x) { if (x.group !== d.group && x.uses) others = others.concat(x.uses); });
      return q(d.id, "Which is an indication for " + shortName(d) + "?", short(right, 140),
        distinct(others, [right], 3).map(function (s) { return short(s, 140); }), "");
    },
    drugSide: function (d) {
      if (!d.se || !d.se.length) return null;
      var right = pick(d.se);
      var others = [];
      DRUGS.forEach(function (x) { if (x.group !== d.group && x.se) others = others.concat(x.se); });
      return q(d.id, "Which adverse effect is characteristic of " + shortName(d) + "?", short(right, 140),
        distinct(others, [right], 3).map(function (s) { return short(s, 140); }), "");
    },
    drugFood: function (d) {
      var f = (d.food || []).filter(function (x) { return x.with && x.effect; });
      if (!f.length) return null;
      var it = pick(f);
      var right = it.with + " — " + it.effect;
      var others = [];
      DRUGS.forEach(function (x) {
        if (x.id === d.id) return;
        (x.food || []).forEach(function (y) { if (y.with && y.effect && y.with !== it.with) others.push(y.with + " — " + y.effect); });
      });
      return q(d.id, "Which food/drink interaction applies to " + shortName(d) + "?", short(right, 150),
        distinct(others, [right], 3).map(function (s) { return short(s, 150); }), it.action ? "Advice: " + it.action : "");
    },
    drugDdi: function (d) {
      var dd = (d.ddi || []).filter(function (x) { return x.with && x.effect; });
      if (!dd.length) return null;
      var it = pick(dd);
      var others = [];
      DRUGS.forEach(function (x) {
        if (x.id === d.id) return;
        (x.ddi || []).forEach(function (y) { if (y.effect) others.push(y.effect); });
      });
      return q(d.id, shortName(d) + " + " + it.with + ": what is the consequence?", short(it.effect, 150),
        distinct(others, [it.effect], 3).map(function (s) { return short(s, 150); }), it.action ? "Management: " + it.action : "");
    },
    drugLevel: function (d) {
      var m = /^([ABCDS])\b/.exec(d.nemlit || "");
      if (!m) return null;
      return q(d.id, "In NEMLIT 2021, what is the level of use of " + shortName(d) + "?",
        "Level " + m[1], ["A", "B", "C", "D", "S"].filter(function (x) { return x !== m[1]; }).map(function (x) { return "Level " + x; }),
        "NEMLIT: " + d.nemlit + ". A = dispensary; B = health centre; C = district; D = regional; S = specialist.");
    },
    diseaseDrug: function (z) {
      if (!z.drugs || !z.drugs.length) return null;
      var right = drugById[pick(z.drugs)];
      var pool = DRUGS.filter(function (x) { return z.drugs.indexOf(x.id) < 0; }).map(shortName);
      return q(z.id, "Which medicine is used in the management of " + z.name + "?", shortName(right),
        distinct(pool, [shortName(right)], 3), right.class);
    },
    diseaseDanger: function (z) {
      if (!z.danger || !z.danger.length) return null;
      var right = pick(z.danger);
      var others = [];
      DIS.forEach(function (x) { if (x.id !== z.id && x.category !== z.category && x.danger) others = others.concat(x.danger); });
      return q(z.id, "Which is a danger sign / referral criterion in " + z.name + "?", short(right, 150),
        distinct(others, [right], 3).map(function (s) { return short(s, 150); }), "");
    },
    diseaseAdvice: function (z) {
      if (!z.advice || !z.advice.length) return null;
      var right = pick(z.advice);
      var others = [];
      DIS.forEach(function (x) { if (x.id !== z.id && x.category !== z.category && x.advice) others = others.concat(x.advice); });
      return q(z.id, "Which counselling point belongs to a patient with " + z.name + "?", short(right, 150),
        distinct(others, [right], 3).map(function (s) { return short(s, 150); }), "");
    }
  };

  function fromBank(m) {
    return { topic: m.topic, q: m.q, opts: shuffle([m.a].concat(m.w)), a: m.a, why: m.why || "", bank: true };
  }

  // scope: {type:"all"|"disease"|"drug"|"category"|"group"|"law"|"bank", id}
  function build(scope, n) {
    n = n || 10;
    var out = [], drugs = DRUGS, dis = DIS, bank = MCQ;
    if (scope.type === "disease") {
      var z = disById[scope.id];
      dis = [z]; drugs = (z.drugs || []).map(function (id) { return drugById[id]; });
      bank = MCQ.filter(function (m) { return m.topic === z.id || z.drugs.indexOf(m.topic) >= 0; });
    } else if (scope.type === "drug") {
      drugs = [drugById[scope.id]]; dis = [];
      bank = MCQ.filter(function (m) { return m.topic === scope.id; });
    } else if (scope.type === "category") {
      dis = DIS.filter(function (z) { return z.category === scope.id; });
      var ids = {}; dis.forEach(function (z) { z.drugs.forEach(function (d) { ids[d] = 1; }); });
      drugs = DRUGS.filter(function (d) { return ids[d.id]; });
      bank = MCQ.filter(function (m) { return dis.some(function (z) { return z.id === m.topic; }) || ids[m.topic]; });
    } else if (scope.type === "group") {
      drugs = DRUGS.filter(function (d) { return d.group === scope.id; }); dis = [];
      bank = MCQ.filter(function (m) { return drugs.some(function (d) { return d.id === m.topic; }); });
    } else if (scope.type === "law") {
      return shuffle(MCQ.filter(function (m) { return m.topic === "law"; })).slice(0, n).map(fromBank);
    } else if (scope.type === "bank") {
      return shuffle(MCQ).slice(0, n).map(fromBank);
    } else if (scope.type === "weak") {
      var bt = Store.s.quiz.byTopic, weak = Object.keys(bt).filter(function (k) { return bt[k].a >= 1 && bt[k].c / bt[k].a < 0.7; });
      dis = DIS.filter(function (z) { return weak.indexOf(z.id) >= 0; });
      drugs = DRUGS.filter(function (d) { return weak.indexOf(d.id) >= 0; });
      bank = MCQ.filter(function (m) { return weak.indexOf(m.topic) >= 0; });
      if (!dis.length && !drugs.length && !bank.length) return [];
    }
    // roughly a third from the hand-written bank, rest generated
    shuffle(bank).slice(0, Math.ceil(n / 3)).forEach(function (m) { out.push(fromBank(m)); });
    var dg = ["drugClass", "drugUse", "drugSide", "drugFood", "drugDdi", "drugLevel"];
    var zg = ["diseaseDrug", "diseaseDanger", "diseaseAdvice"];
    var guard = 0;
    while (out.length < n && guard++ < n * 20) {
      var useDrug = drugs.length && (!dis.length || Math.random() < 0.6);
      var item, g;
      if (useDrug) { item = pick(drugs); g = gens[pick(dg)]; }
      else if (dis.length) { item = pick(dis); g = gens[pick(zg)]; }
      else break;
      var qq = item && g(item);
      if (qq && qq.opts.length >= 2 && !out.some(function (o) { return o.q === qq.q; })) out.push(qq);
    }
    return shuffle(out);
  }

  // ---- flashcards (Leitner boxes) ----
  var INTERVALS = [0, 1, 3, 7, 16, 35]; // days per box
  function cards(scope) {
    var list = [];
    var drugs = DRUGS, dis = DIS;
    if (scope && scope.type === "disease") { dis = [disById[scope.id]]; drugs = []; }
    if (scope && scope.type === "drug") { drugs = [drugById[scope.id]]; dis = []; }
    if (scope && scope.type === "drugs") dis = [];
    if (scope && scope.type === "diseases") drugs = [];
    drugs.forEach(function (d) {
      list.push({ id: "c:" + d.id + ":moa", topic: d.id, front: "Mechanism of action — " + shortName(d), back: [d.class, d.moa] });
      if (d.advice) list.push({ id: "c:" + d.id + ":adv", topic: d.id, front: "Patient counselling — " + shortName(d), back: d.advice });
      var inter = (d.ddi || []).filter(function (x) { return x.with; }).map(function (x) { return x.with + ": " + x.effect + (x.action ? " → " + x.action : ""); });
      if (inter.length) list.push({ id: "c:" + d.id + ":ddi", topic: d.id, front: "Key drug interactions — " + shortName(d), back: inter });
      if (d.ci) list.push({ id: "c:" + d.id + ":ci", topic: d.id, front: "Contraindications — " + shortName(d), back: d.ci });
      if (d.pearls) d.pearls.forEach(function (p, i) { list.push({ id: "c:" + d.id + ":p" + i, topic: d.id, front: "Exam pearl — " + shortName(d), back: [p] }); });
    });
    dis.forEach(function (z) {
      if (z.danger) list.push({ id: "c:" + z.id + ":danger", topic: z.id, front: "Danger signs / referral — " + z.name, back: z.danger });
      if (z.advice) list.push({ id: "c:" + z.id + ":adv", topic: z.id, front: "Pharmacist advice — " + z.name, back: z.advice });
      if (z.drugs && z.drugs.length) list.push({ id: "c:" + z.id + ":drugs", topic: z.id, front: "Medicines used in — " + z.name, back: z.drugs.map(function (id) { return shortName(drugById[id]); }) });
      if (z.pearls) z.pearls.forEach(function (p, i) { list.push({ id: "c:" + z.id + ":p" + i, topic: z.id, front: "Exam pearl — " + z.name, back: [p] }); });
    });
    return list;
  }

  function due(list) {
    var now = Date.now(), st = Store.s.cards;
    var d = list.filter(function (c) { var s = st[c.id]; return !s || s.due <= now; });
    // unseen cards after reviews that are due
    d.sort(function (a, b) { return (st[a.id] ? 0 : 1) - (st[b.id] ? 0 : 1); });
    return d;
  }

  function grade(card, knew) {
    var st = Store.s.cards, s = st[card.id] || { box: 0, due: 0 };
    s.box = knew ? Math.min(s.box + 1, INTERVALS.length - 1) : 0;
    s.due = Date.now() + INTERVALS[s.box] * 86400000 + (knew ? 0 : 60000);
    st[card.id] = s;
    Store.markDay();
    Store.save();
  }

  window.Quiz = { build: build, cards: cards, due: due, grade: grade, shortName: shortName };
})();
