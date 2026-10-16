/*
 * Valley Smart Services chat box. Add to any website with one line:
 *
 *   <script src="widget.js" data-business="your-business-id"
 *     data-endpoint="https://hlzmldcebgoeyxmrefcw.supabase.co/functions/v1/web-chat"></script>
 *
 * data-business is the id the business was set up with.
 * Optional attributes: data-title (header text), data-color (brand color).
 * After-hours greeting (a "we're closed, message us anyway" greeting and a small bubble):
 *   data-hours-open (default 8), data-hours-close (default 18), data-closed-days (default "Sun",
 *   for example "Sat,Sun"), data-timezone (default America/Chicago),
 *   data-after-hours-message (replaces the greeting), data-nudge-delay (milliseconds, default 8000).
 *   data-open="true" opens the chat as soon as the page loads (used by chat.html).
 * To preview it, add ?vss-force=closed to the page address.
 */
(function () {
  var script = document.currentScript;
  var ENDPOINT = script.getAttribute("data-endpoint");
  var BUSINESS = script.getAttribute("data-business");
  var PHOTO_ENDPOINT = script.getAttribute("data-photo-endpoint") || ENDPOINT.replace(/web-chat\/?$/, "web-photo");
  var TITLE = script.getAttribute("data-title") || "Valley Smart Services";
  var COLOR = script.getAttribute("data-color") || "#0b6e4f";
  var OPEN_HOUR = Number(script.getAttribute("data-hours-open") || 8);
  var CLOSE_HOUR = Number(script.getAttribute("data-hours-close") || 18);
  var CLOSED_DAYS = (script.getAttribute("data-closed-days") || "Sun").split(",").map(function (d) { return d.trim().slice(0, 3).toLowerCase(); });
  var TIMEZONE = script.getAttribute("data-timezone") || "America/Chicago";
  var FORCE = new URLSearchParams(location.search).get("vss-force");
  var CLOSED = FORCE ? FORCE === "closed" : isClosed();
  var NUDGE_DELAY = FORCE ? 300 : Number(script.getAttribute("data-nudge-delay") || 8000);
  var GREETING_OPEN = "Hi! How can we help today? / ¡Hola! ¿En qué te podemos ayudar?";
  var GREETING_CLOSED = script.getAttribute("data-after-hours-message") ||
    "Hi! We're closed right now, but you can message us here and the team will follow up when we open. / ¡Hola! Estamos cerrados ahorita, pero puedes escribirnos aquí y el equipo te contesta cuando abramos.";
  var NUDGE_TEXT = "We're closed right now, but message us here. / Estamos cerrados, pero escríbenos aquí.";
  var GREETING = CLOSED ? GREETING_CLOSED : GREETING_OPEN;
  var STORE_KEY = "vss-chat-" + BUSINESS;

  // Remember the conversation across page loads, if the browser allows it.
  var state = load() || { sessionId: newId(), messages: [{ from: "bot", text: GREETING }] };
  // A visitor who has only seen the greeting gets the greeting that fits the time of day.
  if (state.messages.length === 1 && state.messages[0].from === "bot") state.messages[0].text = GREETING;

  var FONT = "'Red Hat Text',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
  var css = [
    ".vss-btn{position:fixed;right:20px;bottom:20px;width:62px;height:62px;border-radius:50%;border:0;cursor:pointer;",
    "background:" + COLOR + ";color:#fff;box-shadow:0 10px 26px rgba(0,0,0,.28);z-index:2147483000;display:flex;align-items:center;justify-content:center;transition:transform .15s ease}",
    ".vss-btn:hover{transform:scale(1.05)}",
    ".vss-btn svg{width:28px;height:28px}",
    ".vss-btn:focus-visible,.vss-panel button:focus-visible{outline:3px solid #ffb21f;outline-offset:2px}",
    ".vss-panel{position:fixed;right:20px;bottom:96px;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 124px);",
    "background:#fff;border-radius:22px;box-shadow:0 24px 60px rgba(0,0,0,.28),0 0 0 1px rgba(0,0,0,.04);display:none;flex-direction:column;overflow:hidden;",
    "z-index:2147483000;font:15px/1.45 " + FONT + ";color:#13221c}",
    ".vss-panel.open{display:flex}",
    ".vss-head{background:" + COLOR + ";color:#fff;padding:16px 14px 16px 16px;display:flex;align-items:center;gap:12px}",
    ".vss-av{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.18);display:grid;place-items:center;font-weight:700;font-size:15px;flex:none;letter-spacing:.02em}",
    ".vss-ttl{flex:1;min-width:0;font-weight:700;font-size:16px;line-height:1.25}",
    ".vss-ttl small{display:flex;align-items:center;gap:6px;font-weight:400;color:#fff;opacity:.9;font-size:12.5px;margin-top:2px}",
    ".vss-ttl small::before{content:'';width:7px;height:7px;border-radius:50%;background:#5ee2a8;flex:none}",
    ".vss-ttl.closed small::before{background:#ffb21f}",
    ".vss-x{background:rgba(255,255,255,.12);border:0;color:#fff;width:34px;height:34px;border-radius:50%;font-size:20px;cursor:pointer;line-height:1;flex:none}",
    ".vss-x:hover{background:rgba(255,255,255,.22)}",
    ".vss-log{flex:1;overflow-y:auto;padding:18px 14px;background:#eef2ee;display:flex;flex-direction:column;gap:10px}",
    ".vss-msg{max-width:84%;padding:10px 14px;border-radius:18px;white-space:pre-wrap;word-wrap:break-word}",
    ".vss-bot{background:#fff;align-self:flex-start;border-bottom-left-radius:6px;box-shadow:0 1px 2px rgba(0,0,0,.06)}",
    ".vss-me{background:" + COLOR + ";color:#fff;align-self:flex-end;border-bottom-right-radius:6px}",
    ".vss-typing{color:#6b7a73;letter-spacing:.2em}",
    ".vss-team{border-left:4px solid #f5a524}",
    ".vss-team:before{content:'From the team / Del equipo';display:block;font-size:11px;font-weight:700;color:#8a5a00;margin-bottom:2px}",
    ".vss-form{display:flex;align-items:flex-end;gap:6px;padding:10px 10px 12px;border-top:1px solid #e1e7e3;background:#fff}",
    ".vss-form textarea{flex:1;border:1px solid #d7dfda;background:#f6f8f6;border-radius:21px;padding:10px 16px;font:inherit;line-height:1.35;color:inherit;outline:none;min-width:0;resize:none;max-height:120px;overflow-y:auto;display:block}",
    ".vss-form textarea:focus{border-color:" + COLOR + ";background:#fff}",
    ".vss-form button{border:0;background:none;cursor:pointer;font:inherit;display:grid;place-items:center;flex:none}",
    ".vss-form button:disabled{opacity:.35;cursor:default}",
    ".vss-send{height:42px;padding:0 16px 0 14px;border-radius:999px;background:" + COLOR + "!important;color:#fff;display:flex!important;align-items:center;gap:6px;font-weight:700!important;font-size:15px}",
    ".vss-send svg,.vss-clip svg{width:20px;height:20px}",
    ".vss-clip{width:38px;height:38px;border-radius:50%;color:#5b6b64}",
    ".vss-clip:not(:disabled):hover{background:#eef2ee}",
    ".vss-nudge{position:fixed;right:20px;bottom:96px;max-width:270px;background:#fff;color:#13221c;border-radius:18px;padding:13px 36px 13px 15px;",
    "box-shadow:0 14px 36px rgba(0,0,0,.24);z-index:2147483000;font:14px/1.45 " + FONT + ";cursor:pointer}",
    ".vss-nx{position:absolute;top:6px;right:8px;background:none;border:0;font-size:20px;line-height:1;color:#5f6368;cursor:pointer}",
    "@media (max-width:480px){.vss-panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100%;max-height:100%;border-radius:0}.vss-panel.open+.vss-btn{display:none}}",
    "@media (prefers-reduced-motion:reduce){.vss-btn{transition:none}.vss-btn:hover{transform:none}}",
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
  var av = el("div", "vss-av");
  av.setAttribute("aria-hidden", "true");
  av.textContent = TITLE.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("");
  var titleBox = el("div", "vss-ttl" + (CLOSED ? " closed" : ""));
  titleBox.textContent = TITLE;
  var sub = el("small");
  sub.textContent = CLOSED ? "Closed now, message us anyway. Cerrado, escríbenos." : "Replies right away in English or Español";
  titleBox.appendChild(sub);
  var close = el("button", "vss-x");
  close.type = "button";
  close.setAttribute("aria-label", "Close chat");
  close.textContent = "×";
  head.appendChild(av);
  head.appendChild(titleBox);
  head.appendChild(close);

  var log = el("div", "vss-log");
  log.setAttribute("aria-live", "polite");
  var form = el("form", "vss-form");
  // A text area so Return adds a new line; only the Send button sends.
  var input = el("textarea");
  input.rows = 1;
  input.placeholder = "Type a message / Escribe aquí";
  input.maxLength = 1000;
  input.setAttribute("aria-label", "Message");
  // Grow with the message, up to the max-height in the CSS.
  input.addEventListener("input", fitInput);
  var send = el("button", "vss-send");
  send.type = "submit";
  send.setAttribute("aria-label", "Send / Enviar");
  send.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4l17.5-7.5a1 1 0 0 0 0-1.8L3.4 3.6a1 1 0 0 0-1.4 1.1L4 11l9 1-9 1-2 6.3a1 1 0 0 0 1.4 1.1z"/></svg><span>Send</span>';
  var clip = el("button", "vss-clip");
  clip.type = "button";
  clip.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/></svg>';
  clip.setAttribute("aria-label", "Attach a photo / Adjuntar una foto");
  var pick = el("input");
  pick.type = "file";
  pick.accept = "image/*";
  pick.style.display = "none";
  form.appendChild(clip);
  form.appendChild(pick);
  form.appendChild(input);
  form.appendChild(send);

  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(form);
  document.body.appendChild(panel);
  document.body.appendChild(btn);

  state.messages.forEach(function (m) { addBubble(m.from, m.text, m.from === "team" ? "vss-team" : ""); });

  // When the shop answers from its dashboard, the reply shows up here. Checked every 8 seconds
  // while the chat is open and every 30 while it is closed, only after the visitor has written,
  // only while the page is visible, and only for a day after the last message.
  var lastPoll = 0;
  setInterval(function () {
    if (document.hidden || !hasStarted()) return;
    var open = panel.classList.contains("open");
    if (Date.now() - lastPoll < (open ? 8000 : 30000)) return;
    if (state.lastAt && Date.now() - state.lastAt > 86400000) return;
    lastPoll = Date.now();
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: BUSINESS, sessionId: state.sessionId, poll: state.teamSince || state.startedAt || "" }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        (data.messages || []).forEach(function (m) {
          state.teamSince = m.created_at;
          remember("team", m.content);
          addBubble("team", m.content, "vss-team");
        });
        if (data.messages && data.messages.length && !open) { hideNudge(); panel.classList.add("open"); }
      })
      .catch(function () {});
  }, 2000);

  // After hours, a small bubble invites the visitor to write anyway (once per visit).
  var nudge = null;
  if (CLOSED && !sessionGet("vss-nudge-" + BUSINESS)) {
    setTimeout(function () {
      if (panel.classList.contains("open")) return;
      nudge = el("div", "vss-nudge");
      nudge.setAttribute("role", "status");
      var msg = el("span");
      msg.textContent = NUDGE_TEXT;
      var x = el("button", "vss-nx");
      x.setAttribute("aria-label", "Dismiss");
      x.textContent = "×";
      nudge.appendChild(msg);
      nudge.appendChild(x);
      nudge.onclick = function (e) {
        hideNudge();
        if (e.target !== x) { panel.classList.add("open"); input.focus(); }
      };
      document.body.appendChild(nudge);
    }, NUDGE_DELAY);
  }

  // A full-page chat link (web/chat.html) opens the chat straight away.
  if (script.getAttribute("data-open") === "true") panel.classList.add("open");

  btn.onclick = function () {
    hideNudge();
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) input.focus();
  };
  close.onclick = function () { panel.classList.remove("open"); };

  var busy = false;
  form.onsubmit = function (e) {
    e.preventDefault();
    sendMessage();
  };
  function sendMessage() {
    var text = input.value.trim();
    if (!text || busy) return;
    input.value = "";
    fitInput();
    remember("me", text);
    addBubble("me", text);
    setBusy(true);
    var typing = addBubble("bot", "…", "vss-typing");

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: BUSINESS, sessionId: state.sessionId, message: text }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        // The shop is answering this chat itself, so there is no automatic reply; theirs comes by polling.
        if (data.quiet) return null;
        return data.reply || "Sorry, something went wrong. Please call us. / Disculpa, hubo un problema. Por favor llámanos.";
      })
      .catch(function () { return "We couldn't connect. Please check your internet and try again. / No pudimos conectar. Intenta de nuevo."; })
      .then(function (reply) {
        log.removeChild(typing);
        if (reply) {
          remember("bot", reply);
          addBubble("bot", reply);
        }
        setBusy(false);
        input.focus();
      });
  }

  function fitInput() {
    input.style.height = "auto";
    input.style.height = input.scrollHeight + 2 + "px";
  }

  function hideNudge() {
    if (nudge && nudge.parentNode) nudge.parentNode.removeChild(nudge);
    nudge = null;
    try { sessionStorage.setItem("vss-nudge-" + BUSINESS, "1"); } catch (e) {}
  }

  function sessionGet(key) {
    try { return sessionStorage.getItem(key); } catch (e) { return null; }
  }

  // Closed before the opening hour, from the closing hour on, and on the closed days (in the shop's time zone).
  function isClosed() {
    try {
      var parts = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "short", hour: "numeric", hourCycle: "h23" })
        .formatToParts(new Date());
      var day = "", hour = 12;
      parts.forEach(function (p) {
        if (p.type === "weekday") day = p.value.slice(0, 3).toLowerCase();
        if (p.type === "hour") hour = Number(p.value);
      });
      return CLOSED_DAYS.indexOf(day) !== -1 || hour < OPEN_HOUR || hour >= CLOSE_HOUR;
    } catch (e) {
      return false; // if the browser can't tell, behave as open
    }
  }

  function setBusy(on) {
    busy = on;
    send.disabled = on;
    clip.disabled = on || !hasStarted();
  }

  // Photos attach to a chat that already started (the shop needs a lead to attach them to).
  function hasStarted() {
    return state.messages.some(function (m) { return m.from === "me"; });
  }
  clip.disabled = !hasStarted();

  clip.onclick = function () { if (!clip.disabled) pick.click(); };
  pick.onchange = function () {
    var file = pick.files && pick.files[0];
    pick.value = "";
    if (!file || busy) return;
    setBusy(true);
    var typing = addBubble("bot", "\u2026", "vss-typing");
    shrink(file)
      .then(function (blob) {
        var data = new FormData();
        data.append("businessId", BUSINESS);
        data.append("sessionId", state.sessionId);
        data.append("photo", blob, "photo.jpg");
        return fetch(PHOTO_ENDPOINT, { method: "POST", body: data }).then(function (r) { return r.json(); });
      })
      .then(function (data) { return { ok: !!data.ok, reply: data.reply || "Sorry, we couldn't get that photo. / Disculpa, no pudimos recibir la foto." }; })
      .catch(function () { return { ok: false, reply: "We couldn't send that photo. Please try another one. / No pudimos enviar esa foto. Prueba con otra." }; })
      .then(function (res) {
        log.removeChild(typing);
        if (res.ok) { remember("me", "\uD83D\uDCF7 Photo sent / Foto enviada"); addBubble("me", "\uD83D\uDCF7 Photo sent / Foto enviada"); }
        remember("bot", res.reply);
        addBubble("bot", res.reply);
        setBusy(false);
      });
  };

  // Redraws the picture smaller as a plain JPEG. That keeps the upload small and also drops the
  // hidden location data phones put inside photos.
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error("no image")); }, "image/jpeg", 0.8);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("not an image")); };
      img.src = url;
    });
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
    state.lastAt = Date.now();
    if (from === "me" && !state.startedAt) state.startedAt = new Date().toISOString();
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
