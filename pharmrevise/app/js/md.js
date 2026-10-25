/* Small markdown renderer for the class notes (headings, lists, tables, quotes, bold/italic). */
(function () {
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function inline(s) {
    s = esc(s).replace(/&lt;br\s*\/?&gt;/g, "<br>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*\*([^*]+)\*\*\*/g, "<b><i>$1</i></b>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<i>$2</i>");
    return s;
  }

  // Table cells from the Docs export may hold "<br>  - item" sequences; show them as lines.
  function cell(s) {
    var html = inline(s.trim());
    return html.replace(/<br>\s*-\s+/g, "<br>&bull; ").replace(/^-\s+/, "&bull; ");
  }

  function splitRow(line) {
    var t = line.trim();
    if (t.startsWith("|")) t = t.slice(1);
    if (t.endsWith("|")) t = t.slice(0, -1);
    return t.split("|");
  }

  function isSep(line) {
    return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line);
  }

  function table(lines) {
    var rows = lines.filter(function (l) { return !isSep(l); }).map(splitRow);
    // The Docs export often emits an empty header row; promote the first real row instead.
    while (rows.length && rows[0].every(function (c) { return !c.trim(); })) rows.shift();
    if (!rows.length) return "";
    if (rows.length === 1 && rows[0].length === 1) {
      return "<blockquote>" + cell(rows[0][0]) + "</blockquote>";
    }
    var head = rows.shift();
    var h = "<div class='tbl'><table><thead><tr>" +
      head.map(function (c) { return "<th>" + cell(c) + "</th>"; }).join("") + "</tr></thead><tbody>";
    rows.forEach(function (r) {
      h += "<tr>" + r.map(function (c) { return "<td>" + cell(c) + "</td>"; }).join("") + "</tr>";
    });
    return h + "</tbody></table></div>";
  }

  function render(md) {
    if (!md) return "";
    var lines = md.replace(/\r/g, "").split("\n");
    var out = [], i = 0, para = [];
    function flushPara() {
      if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; }
    }
    while (i < lines.length) {
      var line = lines[i];
      var t = line.trim();
      if (!t) { flushPara(); i++; continue; }
      var hm = /^(#{1,6})\s+(.*)$/.exec(t);
      if (hm) {
        flushPara();
        var lvl = Math.min(hm[1].length + 1, 4);
        out.push("<h" + lvl + ">" + inline(hm[2].replace(/\*+/g, "")) + "</h" + lvl + ">");
        i++; continue;
      }
      if (/^(-{3,}|\*{3,})$/.test(t)) { flushPara(); out.push("<hr>"); i++; continue; }
      if (t.startsWith("|")) {
        flushPara();
        var tl = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) { tl.push(lines[i]); i++; }
        out.push(table(tl));
        continue;
      }
      if (t.startsWith(">")) {
        flushPara();
        var q = [];
        while (i < lines.length && lines[i].trim().startsWith(">")) { q.push(lines[i].trim().replace(/^>\s?/, "")); i++; }
        out.push("<blockquote>" + inline(q.join(" ")) + "</blockquote>");
        continue;
      }
      if (/^([-*+]|\d+[.)])\s+/.test(t)) {
        flushPara();
        var html = "", stack = [];
        while (i < lines.length) {
          var l = lines[i], lt = l.trim();
          var m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(l);
          if (!m) {
            if (lt && stack.length && /^\s{2,}/.test(l)) { html += " " + inline(lt); i++; continue; }
            break;
          }
          var depth = m[1].replace(/\t/g, "    ").length >= 4 ? 1 : 0;
          var tag = /\d/.test(m[2]) ? "ol" : "ul";
          while (stack.length > depth + 1) html += "</li></" + stack.pop() + ">";
          if (stack.length < depth + 1) { html += "<" + tag + "><li>"; stack.push(tag); }
          else html += "</li><li>";
          html += inline(m[3]);
          i++;
        }
        while (stack.length) html += "</li></" + stack.pop() + ">";
        out.push(html);
        continue;
      }
      para.push(t);
      i++;
    }
    flushPara();
    return out.join("\n");
  }

  window.MD = { render: render, inline: inline, esc: esc };
})();
