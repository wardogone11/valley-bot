/*
 * Valley Smart Services chat box. Add to any website with one line:
 *
 *   <script src="widget.js" data-endpoint="https://hlzmldcebgoeyxmrefcw.supabase.co/functions/v1/web-chat"></script>
 *
 * Optional attributes: data-title (header text), data-color (brand color).
 */
(function () {
  var script = document.currentScript;
  var ENDPOINT = script.getAttribute("data-endpoint");
  var TITLE = script.getAttribute("data-title") || "Valley Smart Services";
  var COLOR = script.getAttribute("data-color") || "#0b6e4f";
  var GREETING = "Hi! How can we help today? / ¡Hola! ¿En qué le podemos ayudar?";
  var STORE_KEY = "vss-chat";

  // Remember the conversation across page loads, if the browser allows it.
  var state = load() || { sessionId: newId(), messages: [{ from: "bot", text: GREETING }] };

  var css = [
    ".vss-btn{position:fixed;right:20px;bottom:20px;width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;",
    "background:" + COLOR + ";color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.25);z-index:2147483000;display:flex;align-items:center;justify-content:center}",
    ".vss-btn svg{width:28px;height:28px}",
    ".vss-panel{position:fixed;right:20px;bottom:92px;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 120px);",
    "background:#fff;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;",
    "z-index:2147483000;font:15px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1d1d1f}",
    ".vss-panel.open{display:flex}",
    ".vss-head{background:" + COLOR + ";color:#fff;padding:14px 16px;font-weight:600;display:flex;justify-content:space-between;align-items:center}",
    ".vss-head small{display:block;font-weight:400;opacity:.85;font-size:12px}",
    ".vss-x{background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1}",
    ".vss-log{flex:1;overflow-y:auto;padding:14px;background:#f5f6f7;display:flex;flex-direction:column;gap:8px}",
    ".vss-msg{max-width:82%;padding:9px 12px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word}",
    ".vss-bot{background:#fff;align-self:flex-start;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.08)}",
    ".vss-me{background:" + COLOR + ";color:#fff;align-self:flex-end;border-bottom-right-radius:4px}",
    ".vss-typing{opacity:.6;font-style:italic}",
    ".vss-form{display:flex;border-top:1px solid #e3e5e8;background:#fff}",
    ".vss-form input{flex:1;border:0;padding:14px;font:inherit;outline:none;min-width:0}",
    ".vss-form button{border:0;background:none;color:" + COLOR + ";font-weight:600;padding:0 16px;cursor:pointer;font:inherit}",
    ".vss-form button:disabled{opacity:.4;cursor:default}",
    "@media (max-width:480px){.vss-panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100%;max-height:100%;border-radius:0}}",
  ].join("");
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var btn = el("button", "vss-btn");
  btn.setAttribute("aria-label", "Chat with us");
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z"/></svg>';

  var panel = el("div", "vss-panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", TITLE + " chat");
  var head = el("div", "vss-head");
  var titleBox = el("div");
  titleBox.textContent = TITLE;
  var sub = el("small");
  sub.textContent = "English · Español";
  titleBox.appendChild(sub);
  var close = el("button", "vss-x");
  close.setAttribute("aria-label", "Close chat");
  close.textContent = "×";
  head.appendChild(titleBox);
  head.appendChild(close);

  var log = el("div", "vss-log");
  log.setAttribute("aria-live", "polite");
  var form = el("form", "vss-form");
  var input = el("input");
  input.placeholder = "Type a message / Escriba aquí";
  input.maxLength = 1000;
  input.setAttribute("aria-label", "Message");
  var send = el("button");
  send.type = "submit";
  send.textContent = "Send";
  form.appendChild(input);
  form.appendChild(send);

  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(form);
  document.body.appendChild(panel);
  document.body.appendChild(btn);

  state.messages.forEach(function (m) { addBubble(m.from, m.text); });

  btn.onclick = function () {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) input.focus();
  };
  close.onclick = function () { panel.classList.remove("open"); };

  var busy = false;
  form.onsubmit = function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || busy) return;
    input.value = "";
    remember("me", text);
    addBubble("me", text);
    setBusy(true);
    var typing = addBubble("bot", "…", "vss-typing");

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: state.sessionId, message: text }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) { return data.reply || "Sorry, something went wrong. Please call us. / Disculpe, hubo un problema. Por favor llámenos."; })
      .catch(function () { return "We couldn't connect. Please check your internet and try again. / No pudimos conectar. Intente de nuevo."; })
      .then(function (reply) {
        log.removeChild(typing);
        remember("bot", reply);
        addBubble("bot", reply);
        setBusy(false);
        input.focus();
      });
  };

  function setBusy(on) {
    busy = on;
    send.disabled = on;
  }

  function addBubble(from, text, extra) {
    var b = el("div", "vss-msg " + (from === "me" ? "vss-me" : "vss-bot") + (extra ? " " + extra : ""));
    b.textContent = text;
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  function remember(from, text) {
    state.messages.push({ from: from, text: text });
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { return null; }
  }

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }
})();
