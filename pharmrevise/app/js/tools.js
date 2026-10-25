/* Calculators and the drug-interaction checker. Each tool renders into a container element. */
(function () {
  var DRUGS = window.PR_DRUGS || [];

  function num(id) { var v = parseFloat(document.getElementById(id).value); return isNaN(v) ? null : v; }
  function out(id, html) { document.getElementById(id).innerHTML = html; }
  function r1(x) { return Math.round(x * 10) / 10; }

  var TOOLS = [
    {
      id: "paed", title: "Paediatric dose (mg/kg)", icon: "\u{1F476}",
      html: "<label class='f'>Weight (kg)</label><input class='in' id='w' type='number' inputmode='decimal'>" +
        "<label class='f'>Dose (mg/kg per dose)</label><input class='in' id='mgkg' type='number' inputmode='decimal'>" +
        "<label class='f'>Maximum single dose (mg, optional)</label><input class='in' id='max' type='number' inputmode='decimal'>" +
        "<label class='f'>Concentration of liquid (mg per 5 mL, optional)</label><input class='in' id='conc' type='number' inputmode='decimal'>" +
        "<div id='res'></div><p class='small muted'>Example: paracetamol 15 mg/kg, max 1000 mg, syrup 125 mg/5 mL.</p>",
      calc: function () {
        var w = num("w"), mk = num("mgkg"), mx = num("max"), c = num("conc");
        if (!w || !mk) return out("res", "");
        var dose = w * mk, capped = mx && dose > mx;
        if (capped) dose = mx;
        var h = "<div class='result'>Dose: " + r1(dose) + " mg" + (capped ? " (capped at max)" : "");
        if (c) h += "<br>Volume: " + r1(dose / c * 5) + " mL of " + c + " mg/5 mL";
        out("res", h + "</div>");
      }
    },
    {
      id: "alu", title: "Artemether-lumefantrine by weight", icon: "\u{1F99F}",
      html: "<label class='f'>Weight (kg)</label><input class='in' id='w' type='number' inputmode='decimal'><div id='res'></div>",
      calc: function () {
        var w = num("w"); if (!w) return out("res", "");
        if (w < 5) return out("res", "<div class='result'>Below 5 kg — refer (insufficient data).</div>");
        var t = w < 15 ? 1 : w < 25 ? 2 : w < 35 ? 3 : 4;
        out("res", "<div class='result'>" + t + " tablet(s) of 20/120 mg per dose<br>6 doses: 0, 8, 24, 36, 48, 60 h<br>Total " + t * 6 + " tablets — take with fatty food or milk</div>");
      }
    },
    {
      id: "artesunate", title: "IV/IM artesunate (severe malaria)", icon: "\u{1F489}",
      html: "<label class='f'>Weight (kg)</label><input class='in' id='w' type='number' inputmode='decimal'><div id='res'></div>",
      calc: function () {
        var w = num("w"); if (!w) return out("res", "");
        var mgkg = w < 20 ? 3 : 2.4, dose = w * mgkg, vials = Math.ceil(dose / 60);
        out("res", "<div class='result'>" + r1(dose) + " mg per dose (" + mgkg + " mg/kg)<br>Vials of 60 mg: " + vials +
          "<br>IV: " + r1(dose / 10) + " mL of 10 mg/mL &nbsp;|&nbsp; IM: " + r1(dose / 20) + " mL of 20 mg/mL" +
          "<br>Give at 0, 12, 24 h then daily; complete with ALu</div>");
      }
    },
    {
      id: "rhze", title: "TB: RHZE tablets by weight (adults)", icon: "\u{1FAC1}",
      html: "<label class='f'>Weight (kg)</label><input class='in' id='w' type='number' inputmode='decimal'><div id='res'></div>",
      calc: function () {
        var w = num("w"); if (!w) return out("res", "");
        if (w < 30) return out("res", "<div class='result'>Below 30 kg — use paediatric/weight-band tables (NTLP).</div>");
        var t = w < 40 ? 2 : w < 55 ? 3 : w <= 70 ? 4 : 5;
        out("res", "<div class='result'>RHZE 150/75/400/275 mg: " + t + " tablets daily × 2 months<br>Then RH 150/75 mg: " + t + " tablets daily × 4 months</div>");
      }
    },
    {
      id: "crcl", title: "Creatinine clearance (Cockcroft–Gault)", icon: "\u{1FA78}",
      html: "<label class='f'>Age (years)</label><input class='in' id='age' type='number'>" +
        "<label class='f'>Weight (kg)</label><input class='in' id='w' type='number' inputmode='decimal'>" +
        "<label class='f'>Serum creatinine (µmol/L)</label><input class='in' id='cr' type='number' inputmode='decimal'>" +
        "<label class='f'>Sex</label><select class='in' id='sex'><option value='m'>Male</option><option value='f'>Female</option></select><div id='res'></div>",
      calc: function () {
        var a = num("age"), w = num("w"), cr = num("cr"), f = document.getElementById("sex").value === "f";
        if (!a || !w || !cr) return out("res", "");
        var c = ((140 - a) * w * (f ? 1.04 : 1.23)) / cr;
        var note = c < 15 ? "Severe — most renally cleared drugs need major adjustment" : c < 30 ? "Stop metformin; avoid nitrofurantoin; reduce many antibiotics" : c < 50 ? "TDF contraindicated (<50); nitrofurantoin avoid (<45); metformin max 1 g (30–45)" : "Usually no adjustment needed";
        out("res", "<div class='result'>CrCl ≈ " + Math.round(c) + " mL/min<br><span class='small'>" + note + "</span></div>");
      }
    },
    {
      id: "bmi", title: "BMI & body surface area", icon: "⚖️",
      html: "<label class='f'>Weight (kg)</label><input class='in' id='w' type='number' inputmode='decimal'>" +
        "<label class='f'>Height (cm)</label><input class='in' id='h' type='number' inputmode='decimal'><div id='res'></div>",
      calc: function () {
        var w = num("w"), h = num("h"); if (!w || !h) return out("res", "");
        var bmi = w / Math.pow(h / 100, 2), bsa = Math.sqrt(h * w / 3600);
        var cat = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
        out("res", "<div class='result'>BMI " + r1(bmi) + " kg/m² (" + cat + ")<br>BSA (Mosteller) " + Math.round(bsa * 100) / 100 + " m²</div>");
      }
    },
    {
      id: "drip", title: "IV drip rate", icon: "\u{1F4A7}",
      html: "<label class='f'>Volume (mL)</label><input class='in' id='v' type='number'>" +
        "<label class='f'>Time (hours)</label><input class='in' id='t' type='number' inputmode='decimal'>" +
        "<label class='f'>Giving set (drops/mL)</label><select class='in' id='df'><option value='20'>20 (adult macro)</option><option value='15'>15</option><option value='60'>60 (paediatric micro)</option></select><div id='res'></div>",
      calc: function () {
        var v = num("v"), t = num("t"), df = parseFloat(document.getElementById("df").value);
        if (!v || !t) return out("res", "");
        out("res", "<div class='result'>" + Math.round(v * df / (t * 60)) + " drops/min<br>" + r1(v / t) + " mL/hour</div>");
      }
    },
    {
      id: "fluids", title: "Maintenance fluids (children)", icon: "\u{1F9C3}",
      html: "<label class='f'>Weight (kg)</label><input class='in' id='w' type='number' inputmode='decimal'><div id='res'></div>",
      calc: function () {
        var w = num("w"); if (!w) return out("res", "");
        var d = w <= 10 ? w * 100 : w <= 20 ? 1000 + (w - 10) * 50 : 1500 + (w - 20) * 20;
        out("res", "<div class='result'>" + Math.round(d) + " mL/24 h (≈ " + Math.round(d / 24) + " mL/h)<br><span class='small'>Holliday–Segar 100/50/20 rule. ORS Plan B: " + Math.round(w * 75) + " mL over 4 h. Plan C: " + Math.round(w * 100) + " mL Ringer's lactate.</span></div>");
      }
    },
    {
      id: "dilution", title: "Dilution (C1V1 = C2V2)", icon: "\u{1F9EA}",
      html: "<label class='f'>Stock concentration (C1)</label><input class='in' id='c1' type='number' inputmode='decimal'>" +
        "<label class='f'>Required concentration (C2)</label><input class='in' id='c2' type='number' inputmode='decimal'>" +
        "<label class='f'>Required final volume (V2, mL)</label><input class='in' id='v2' type='number' inputmode='decimal'><div id='res'></div>",
      calc: function () {
        var c1 = num("c1"), c2 = num("c2"), v2 = num("v2"); if (!c1 || !c2 || !v2) return out("res", "");
        if (c2 > c1) return out("res", "<div class='result'>Required concentration is higher than stock.</div>");
        var v1 = c2 * v2 / c1;
        out("res", "<div class='result'>Take " + r1(v1) + " mL of stock and make up to " + v2 + " mL (add " + r1(v2 - v1) + " mL diluent)</div>");
      }
    }
  ];

  // ---- interaction checker ----
  var CLASS_ALIASES = [
    ["nsaid", ["nsaid", "ibuprofen", "diclofenac"]],
    ["ace inhibitor", ["ace inhibitor", "acei"]],
    ["angiotensin ii receptor blocker", ["arb"]],
    ["beta", ["beta-blocker", "β-blocker"]],
    ["sulfonylurea", ["sulfonylurea"]],
    ["statin", ["statin"]],
    ["proton pump", ["ppi"]],
    ["macrolide", ["macrolide"]],
    ["aminoglycoside", ["aminoglycoside"]],
    ["fluoroquinolone", ["quinolone", "fluoroquinolone"]],
    ["ssri", ["ssri"]],
    ["benzodiazepine", ["benzodiazepine", "sedative", "cns depressant"]],
    ["opioid", ["opioid", "cns depressant"]],
    ["antacid", ["antacid", "polyvalent", "cation"]],
    ["loop diuretic", ["diuretic"]],
    ["thiazide", ["diuretic", "thiazide"]],
    ["potassium-sparing", ["potassium-sparing", "k+-sparing"]],
    ["anticoagulant", ["anticoagulant"]],
    ["antiplatelet", ["antiplatelet"]],
    ["antipsychotic", ["antipsychotic"]],
    ["tricyclic", ["tricyclic", "tca"]],
    ["antihistamine", ["antihistamine", "anticholinergic"]],
    ["antimuscarinic", ["anticholinergic"]],
    ["hormonal contraceptive", ["contraceptive"]],
    ["iron", ["iron"]],
    ["integrase", ["dolutegravir"]],
    ["protease inhibitor", ["ritonavir", "protease inhibitor", " pis"]]
  ];

  function keywords(d) {
    var base = d.name.toLowerCase().replace(/\(.*?\)/g, " ");
    var kws = base.split(/[\/+,]| and |;/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 3; });
    kws = kws.concat(d.id.split("-").filter(function (s) { return s.length > 4; }));
    var cls = (d.class + " " + d.name).toLowerCase();
    CLASS_ALIASES.forEach(function (ca) { if (cls.indexOf(ca[0]) >= 0) kws = kws.concat(ca[1]); });
    // first word of a brand-like name, e.g. "insulin", "magnesium"
    var first = base.split(/\s+/)[0]; if (first.length > 4) kws.push(first);
    return kws;
  }

  function findInteractions(a, b) {
    var res = [], kb = keywords(b);
    (a.ddi || []).forEach(function (x) {
      if (!x.with) return;
      var w = x.with.toLowerCase();
      if (kb.some(function (k) { return w.indexOf(k) >= 0; })) res.push({ from: a, x: x });
    });
    return res;
  }

  function checker(container) {
    var chosen = [];
    container.innerHTML =
      "<p class='small muted'>Add two or more medicines. Interactions are matched from this app's monographs (by drug name and class) — not an exhaustive database; always check a full reference.</p>" +
      "<input class='search' id='ix-q' placeholder='Type a drug name…' autocomplete='off'>" +
      "<div id='ix-sug'></div><div class='pill-row' id='ix-chosen'></div><div id='ix-res'></div>";
    var qIn = container.querySelector("#ix-q");
    function draw() {
      container.querySelector("#ix-chosen").innerHTML = chosen.map(function (d, i) {
        return "<span class='selected-drug'>" + MD.esc(Quiz.shortName(d)) + "<button data-i='" + i + "' aria-label='remove'>×</button></span>";
      }).join("");
      var html = "";
      if (chosen.length >= 2) {
        var found = [];
        for (var i = 0; i < chosen.length; i++) for (var j = 0; j < chosen.length; j++) {
          if (i !== j) found = found.concat(findInteractions(chosen[i], chosen[j]).map(function (f) { f.to = chosen[j]; return f; }));
        }
        if (!found.length) html = "<div class='card'><b class='tick'>No interaction found in this app's data.</b><p class='small muted'>Absence here does not prove safety.</p></div>";
        found.forEach(function (f) {
          html += "<div class='ddi'><b>" + MD.esc(Quiz.shortName(f.from)) + " ↔ " + MD.esc(f.x.with) + "</b>" + MD.esc(f.x.effect) +
            (f.x.action ? "<div class='act'>" + MD.esc(f.x.action) + "</div>" : "") + "</div>";
        });
        chosen.forEach(function (d) {
          var fd = (d.food || []).filter(function (x) { return x.with; });
          if (fd.length) html += "<h3 class='group-h'>Food — " + MD.esc(Quiz.shortName(d)) + "</h3>" + fd.map(function (x) {
            return "<div class='ddi food'><b>" + MD.esc(x.with) + "</b>" + MD.esc(x.effect) + (x.action ? "<div class='act'>" + MD.esc(x.action) + "</div>" : "") + "</div>";
          }).join("");
        });
      }
      container.querySelector("#ix-res").innerHTML = html;
    }
    container.addEventListener("click", function (e) {
      var rm = e.target.closest("button[data-i]");
      if (rm) { chosen.splice(+rm.dataset.i, 1); draw(); return; }
      var s = e.target.closest("[data-add]");
      if (s) {
        var d = DRUGS.filter(function (x) { return x.id === s.dataset.add; })[0];
        if (d && chosen.indexOf(d) < 0) chosen.push(d);
        qIn.value = ""; container.querySelector("#ix-sug").innerHTML = ""; draw();
      }
    });
    qIn.addEventListener("input", function () {
      var v = qIn.value.trim().toLowerCase();
      var box = container.querySelector("#ix-sug");
      if (!v) { box.innerHTML = ""; return; }
      var m = DRUGS.filter(function (d) { return (d.name + " " + d.class).toLowerCase().indexOf(v) >= 0; }).slice(0, 8);
      box.innerHTML = m.length ? "<div class='suggest'>" + m.map(function (d) {
        return "<div data-add='" + d.id + "'><b>" + MD.esc(Quiz.shortName(d)) + "</b> <span class='small muted'>" + MD.esc(d.class) + "</span></div>";
      }).join("") + "</div>" : "";
    });
    draw();
  }

  window.Tools = { list: TOOLS, checker: checker, findInteractions: findInteractions };
})();
