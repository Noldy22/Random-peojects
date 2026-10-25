/* Persistence (localStorage) for bookmarks, studied topics, notes, quiz stats, flashcards, settings. */
(function () {
  var KEY = "pharmrevise.v1";
  var state;

  function blank() {
    return {
      bookmarks: {},      // "disease:id" | "drug:id" -> timestamp
      studied: {},        // same keys -> timestamp
      notes: {},          // same keys -> text
      quiz: { answered: 0, correct: 0, byTopic: {}, history: [] },
      cards: {},          // card id -> {box, due}
      days: {},           // "YYYY-MM-DD" -> true (study streak)
      recent: [],         // last opened keys
      settings: { theme: "auto", fs: 16 }
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      state = raw ? Object.assign(blank(), JSON.parse(raw)) : blank();
    } catch (e) {
      state = blank();
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked */ }
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function markDay() { state.days[today()] = true; save(); }

  function streak() {
    var n = 0, d = new Date();
    for (;;) {
      var k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      if (state.days[k]) { n++; d.setDate(d.getDate() - 1); }
      else if (n === 0 && k === today()) { d.setDate(d.getDate() - 1); }
      else break;
    }
    return n;
  }

  function toggle(map, key) {
    if (state[map][key]) delete state[map][key];
    else state[map][key] = Date.now();
    save();
    return !!state[map][key];
  }

  function touch(key) {
    state.recent = [key].concat(state.recent.filter(function (k) { return k !== key; })).slice(0, 12);
    markDay();
  }

  function recordAnswer(topic, ok) {
    var q = state.quiz;
    q.answered++; if (ok) q.correct++;
    var t = q.byTopic[topic] || (q.byTopic[topic] = { a: 0, c: 0 });
    t.a++; if (ok) t.c++;
    markDay();
  }

  function exportJson() { return JSON.stringify(state); }
  function importJson(s) { state = Object.assign(blank(), JSON.parse(s)); save(); }
  function reset() { state = blank(); save(); }

  load();
  window.Store = {
    get s() { return state; }, save: save, toggle: toggle, touch: touch, streak: streak,
    recordAnswer: recordAnswer, today: today, markDay: markDay,
    exportJson: exportJson, importJson: importJson, reset: reset
  };
})();
