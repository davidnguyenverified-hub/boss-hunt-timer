const CHANNELS = Array.from({ length: 14 }, (_, index) => index + 1);
const AUTO_RELOAD_MS = 60 * 1000;
const WARNING_MS = 15 * 60 * 1000;
const URGENT_MS = 5 * 60 * 1000;
const BOSSES = [
  { key: "kundun", label: "Kundun" },
  { key: "medusa", label: "Medusa" },
  { key: "seluphan", label: "Seluphan" },
  { key: "lordsilver", label: "Lordsilver" },
  { key: "core", label: "Core" },
  { key: "feara", label: "Feara" },
  { key: "niexe", label: "Niexe" },
  { key: "sod", label: "SOD" }
];

const state = {
  rows: createEmptyRows(),
  editing: null,
  saving: false
};

const els = {
  head: document.querySelector("#tableHead"),
  rows: document.querySelector("#bossRows"),
  topBosses: document.querySelector("#topBosses"),
  status: document.querySelector("#syncStatus"),
  reloadData: document.querySelector("#reloadData"),
  dialog: document.querySelector("#editDialog"),
  form: document.querySelector("#editForm"),
  editTitle: document.querySelector("#editTitle"),
  spawnInput: document.querySelector("#spawnTimeInput"),
  cancelEdit: document.querySelector("#cancelEdit")
};

init();

function init() {
  renderHead();
  renderRows();
  bindEvents();
  loadData();
  setInterval(tick, 1000);
  setInterval(autoReloadData, AUTO_RELOAD_MS);
}

function bindEvents() {
  els.reloadData.addEventListener("click", loadData);

  els.rows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit]");
    if (!button) return;
    openEditor(Number(button.dataset.channel), button.dataset.boss);
  });

  els.rows.addEventListener("change", async (event) => {
    const input = event.target.closest("[data-bug]");
    if (!input) return;
    const row = getRow(Number(input.dataset.channel));
    row.bug = input.checked;
    renderRows();
    await saveRow(row);
  });

  els.cancelEdit.addEventListener("click", () => els.dialog.close());

  els.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.editing) return;
    const duration = parseDurationInput(els.spawnInput.value);
    if (!duration) {
      els.spawnInput.setCustomValidity("Nhap dang HHMM, vi du 1515 la 15 gio 15 phut.");
      els.spawnInput.reportValidity();
      return;
    }
    els.spawnInput.setCustomValidity("");
    const row = getRow(state.editing.channel);
    row[state.editing.boss] = new Date(Date.now() + duration.totalMinutes * 60 * 1000).toISOString();
    els.dialog.close();
    renderRows();
    await saveRow(row);
  });

  els.spawnInput.addEventListener("input", () => {
    els.spawnInput.value = els.spawnInput.value.replace(/\D/g, "").slice(0, 4);
    els.spawnInput.setCustomValidity("");
  });

}

function renderHead() {
  els.head.innerHTML = [
    `<th class="channel-cell">Channel</th>`,
    ...BOSSES.map((boss) => `<th class="boss-cell">${boss.label}</th>`),
    `<th class="bug-cell">BUG</th>`
  ].join("");
}

function renderRows() {
  els.rows.innerHTML = state.rows.map((row) => {
    const cells = BOSSES.map((boss) => {
      const bugged = boss.key === "sod" && row.bug;
      const remainingMs = getRemainingMs(row[boss.key]);
      return `
        <td class="boss-cell">
          <div class="boss-control">
            <span class="timer ${remainingMs > 0 ? "live" : ""} ${!bugged ? getUrgencyClass(remainingMs) : ""} ${bugged ? "bugged" : ""}" data-timer data-channel="${row.channel}" data-boss="${boss.key}">
              ${bugged ? "BUG" : formatRemaining(row[boss.key])}
            </span>
            <button class="set-btn" type="button" data-edit data-channel="${row.channel}" data-boss="${boss.key}" ${bugged ? "disabled" : ""}>Edit</button>
          </div>
        </td>
      `;
    }).join("");

    return `
      <tr>
        <td class="channel-cell">${row.channel}</td>
        ${cells}
        <td class="bug-cell">
          <input class="bug-toggle" type="checkbox" data-bug data-channel="${row.channel}" ${row.bug ? "checked" : ""} aria-label="SOD bug channel ${row.channel}">
        </td>
      </tr>
    `;
  }).join("");
  renderDataboard();
}

function renderDataboard() {
  const upcoming = state.rows.flatMap((row) => {
    return BOSSES
      .filter((boss) => !(boss.key === "sod" && row.bug))
      .map((boss) => ({
        channel: row.channel,
        label: boss.label,
        ms: getRemainingMs(row[boss.key])
      }));
  })
    .filter((item) => item.ms > 0)
    .sort((a, b) => a.ms - b.ms)
    .slice(0, 10);

  if (!upcoming.length) {
    els.topBosses.innerHTML = `<li class="empty-state">No bosses found. Please update timer.</li>`;
    return;
  }

  els.topBosses.innerHTML = upcoming.map((item, index) => `
    <li class="top-item ${getUrgencyClass(item.ms)}">
      <span class="rank">${index + 1}</span>
      <div>
        <div class="top-name">
          <span>${item.label}</span>
          <span>${formatMs(item.ms)}</span>
        </div>
        <div class="top-meta">Channel ${item.channel}</div>
      </div>
    </li>
  `).join("");
}

function tick() {
  document.querySelectorAll("[data-timer]").forEach((timer) => {
    const row = getRow(Number(timer.dataset.channel));
    const bossKey = timer.dataset.boss;
    const bugged = bossKey === "sod" && row.bug;
    const remainingMs = getRemainingMs(row[bossKey]);
    timer.textContent = bugged ? "BUG" : formatMs(remainingMs);
    timer.classList.toggle("live", !bugged && remainingMs > 0);
    timer.classList.toggle("warning", !bugged && getUrgencyClass(remainingMs) === "warning");
    timer.classList.toggle("urgent", !bugged && getUrgencyClass(remainingMs) === "urgent");
    timer.classList.toggle("bugged", bugged);
  });
  renderDataboard();
}

function autoReloadData() {
  if (state.saving || els.dialog.open) return;
  loadData({ silent: true });
}

function openEditor(channel, bossKey) {
  const row = getRow(channel);
  const boss = BOSSES.find((item) => item.key === bossKey);
  state.editing = { channel, boss: bossKey };
  els.editTitle.textContent = `${boss.label} - Channel ${channel}`;
  const remainingMs = getRemainingMs(row[bossKey]);
  const remainingMinutes = remainingMs > 0 ? Math.ceil(remainingMs / 60000) : 60;
  els.spawnInput.value = minutesToDurationInput(remainingMinutes);
  els.spawnInput.setCustomValidity("");
  els.dialog.showModal();
  els.spawnInput.select();
}

async function loadData(options = {}) {
  const silent = options.silent === true;
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    if (!silent) setStatus("no DB url found");
    const localRows = localStorage.getItem("bossCountdown.localRows");
    if (localRows) state.rows = normalizeRows(JSON.parse(localRows));
    renderRows();
    return;
  }

  setBusy(true, silent ? "" : "Loading Data...");
  try {
    const data = await jsonp(`${apiUrl}?action=read`);
    state.rows = normalizeRows(data.rows || data);
    localStorage.setItem("bossCountdown.localRows", JSON.stringify(state.rows));
    setStatus(silent ? `Auto reloaded ${state.rows.length} channels.` : `Loaded data from ${state.rows.length} channels.`);
  } catch (error) {
    console.error(error);
    if (!silent) setStatus("Cannot load data ! Please check Deployment permission");
  } finally {
    setBusy(false);
    renderRows();
  }
}

async function saveRow(row) {
  const apiUrl = getApiUrl();
  localStorage.setItem("bossCountdown.localRows", JSON.stringify(state.rows));

  if (!apiUrl) {
    setStatus("Da luu tam tren trinh duyet. Them SHEET_URL de ghi vao Google Sheet.");
    return;
  }

  setBusy(true, `Saving channel ${row.channel}...`);
  try {
    await fetch(apiUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "updateRow", row })
    });
    setStatus(`Saved data ${row.channel}. Reloading data...`);
    setTimeout(loadData, 900);
  } catch (error) {
    console.error(error);
    setStatus("Cannot send data to DB.");
  } finally {
    setBusy(false);
  }
}

function createEmptyRows() {
  return CHANNELS.map((channel) => ({
    channel,
    kundun: "",
    medusa: "",
    seluphan: "",
    lordsilver: "",
    core: "",
    feara: "",
    niexe: "",
    sod: "",
    bug: false
  }));
}

function normalizeRows(rows) {
  const byChannel = new Map((Array.isArray(rows) ? rows : []).map((row) => [Number(row.channel), row]));
  return CHANNELS.map((channel) => {
    const source = byChannel.get(channel) || {};
    return {
      channel,
      kundun: source.kundun || source.Kundun || "",
      medusa: source.medusa || source.Medusa || "",
      seluphan: source.seluphan || source.Seluphan || "",
      lordsilver: source.lordsilver || source.lordSilver || source.Lordsilver || source.LordSilver || "",
      core: source.core || source.Core || "",
      feara: source.feara || source.Feara || "",
      niexe: source.niexe || source.Niexe || "",
      sod: source.sod || source.SOD || source["S.O.D"] || "",
      bug: source.bug === true || String(source.BUG || source.bug).toLowerCase() === "true"
    };
  });
}

function getRow(channel) {
  return state.rows.find((row) => row.channel === channel);
}

function getApiUrl() {
  return String(window.SHEET_URL || "").trim();
}

function getRemainingMs(value) {
  const date = parseDate(value);
  if (!date) return 0;
  return Math.max(0, date.getTime() - Date.now());
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRemaining(value) {
  return formatMs(getRemainingMs(value));
}

function formatMs(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function getUrgencyClass(ms) {
  if (ms > 0 && ms < URGENT_MS) return "urgent";
  if (ms > 0 && ms < WARNING_MS) return "warning";
  return "";
}

function parseDurationInput(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits || digits.length > 4) return null;
  const padded = digits.padStart(4, "0");
  const hours = Number(padded.slice(0, 2));
  const minutes = Number(padded.slice(2, 4));
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (minutes > 59) return null;
  const totalMinutes = hours * 60 + minutes;
  if (totalMinutes <= 0) return null;
  return { hours, minutes, totalMinutes };
}

function minutesToDurationInput(totalMinutes) {
  const safeMinutes = Math.max(1, Number(totalMinutes) || 1);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${String(hours).padStart(2, "0")}${String(minutes).padStart(2, "0")}`;
}

function setBusy(isBusy, message) {
  state.saving = isBusy;
  [els.reloadData].forEach((button) => {
    button.disabled = isBusy;
  });
  document.querySelectorAll(".set-btn, .bug-toggle").forEach((control) => {
    control.disabled = isBusy || control.closest("td")?.querySelector(".timer.bugged");
  });
  if (message) setStatus(message);
}

function setStatus(message) {
  els.status.textContent = message;
}

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callback = `bossCountdown_${Date.now()}_${Math.round(Math.random() * 100000)}`;
    const script = document.createElement("script");
    const separator = url.includes("?") ? "&" : "?";
    script.src = `${url}${separator}callback=${callback}`;
    script.onerror = () => {
      cleanup();
      reject(new Error("JSONP request failed"));
    };
    window[callback] = (data) => {
      cleanup();
      resolve(data);
    };
    function cleanup() {
      delete window[callback];
      script.remove();
    }
    document.body.appendChild(script);
  });
}
