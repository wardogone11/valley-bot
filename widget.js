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
    ".vss-form .vss-clip{padding:0 6px 0 12px;font-size:20px;line-height:1}",
    ".vss-nudge{position:fixed;right:20px;bottom:92px;max-width:260px;background:#fff;color:#1d1d1f;border-radius:14px;padding:12px 34px 12px 14px;",
    "box-shadow:0 8px 30px rgba(0,0,0,.25);z-index:2147483000;font:14px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;cursor:pointer}",
    ".vss-nx{position:absolute;top:4px;right:6px;background:none;border:0;font-size:20px;line-height:1;color:#5f6368;cursor:pointer}",
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
  sub.textContent = CLOSED ? "Closed now, message us anyway · Cerrado, escríbenos" : "English · Español";
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
  input.placeholder = "Type a message / Escribe aquí";
  input.maxLength = 1000;
  input.setAttribute("aria-label", "Message");
  var send = el("button");
  send.type = "submit";
  send.textContent = "Send";
  var clip = el("button", "vss-clip");
  clip.type = "button";
  clip.textContent = "\uD83D\uDCCE";
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

  state.messages.forEach(function (m) { addBubble(m.from, m.text); });

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

  btn.onclick = function () {
    hideNudge();
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
      body: JSON.stringify({ businessId: BUSINESS, sessionId: state.sessionId, message: text }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) { return data.reply || "Sorry, something went wrong. Please call us. / Disculpa, hubo un problema. Por favor llámanos."; })
      .catch(function () { return "We couldn't connect. Please check your internet and try again. / No pudimos conectar. Intenta de nuevo."; })
      .then(function (reply) {
        log.removeChild(typing);
        remember("bot", reply);
        addBubble("bot", reply);
        setBusy(false);
        input.focus();
      });
  };

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
