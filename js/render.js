// 글 본문(간단한 마크다운)을 화면 요소로 바꿔요.
// innerHTML을 쓰지 않고 textContent만 써서, 본문에 HTML이 섞여 있어도 그대로 글자로 보여요 (보안).
// 지원: 빈 줄로 문단, "## "/"### " 소제목, "- " 목록, "> " 인용, ``` 코드 블록
export function renderBody(text, container) {
  container.replaceChildren();
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  const el = (tag, txt) => { const n = document.createElement(tag); if (txt !== undefined) n.textContent = txt; return n; };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (line.trim().startsWith("```")) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      i++; // 닫는 ```
      const pre = el("pre");
      pre.appendChild(el("code", code.join("\n")));
      container.appendChild(pre);
      continue;
    }
    if (line.startsWith("### ")) { container.appendChild(el("h3", line.slice(4))); i++; continue; }
    if (line.startsWith("## ")) { container.appendChild(el("h2", line.slice(3))); i++; continue; }
    if (/^[-*] /.test(line)) {
      const ul = el("ul");
      while (i < lines.length && /^[-*] /.test(lines[i])) ul.appendChild(el("li", lines[i++].slice(2)));
      container.appendChild(ul);
      continue;
    }
    if (line.startsWith("> ")) {
      const q = [];
      while (i < lines.length && lines[i].startsWith("> ")) q.push(lines[i++].slice(2));
      container.appendChild(el("blockquote", q.join(" ")));
      continue;
    }
    // 문단: 빈 줄이나 다른 블록이 나올 때까지
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,3} |[-*] |> |```)/.test(lines[i])) para.push(lines[i++]);
    container.appendChild(el("p", para.join(" ")));
  }
}
