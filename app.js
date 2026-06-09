const PERIODS = [
  { key: "morning", label: "오전" },
  { key: "afternoon", label: "오후" },
];

const WORK_TYPES = [
  { key: "joint", label: "합동" },
  { key: "move", label: "이전" },
  { key: "existing", label: "기존" },
];

const STORAGE_KEYS = {
  session: "workcheck:session",
  settings: "workcheck:settings",
  records: "workcheck:records",
};

const defaultSettings = {
  teamCount: 4,
};

let state = {
  client: null,
  connected: false,
  user: null,
  settings: structuredClone(defaultSettings),
  records: [],
};

const elements = {
  loginView: document.querySelector("#loginView"),
  appView: document.querySelector("#appView"),
  loginForm: document.querySelector("#loginForm"),
  loginId: document.querySelector("#loginId"),
  loginPassword: document.querySelector("#loginPassword"),
  loginMessage: document.querySelector("#loginMessage"),
  sessionText: document.querySelector("#sessionText"),
  connectionStatus: document.querySelector("#connectionStatus"),
  logoutButton: document.querySelector("#logoutButton"),
  workDate: document.querySelector("#workDate"),
  teamCount: document.querySelector("#teamCount"),
  saveSettingsButton: document.querySelector("#saveSettingsButton"),
  reloadButton: document.querySelector("#reloadButton"),
  saveRecordsButton: document.querySelector("#saveRecordsButton"),
  downloadButton: document.querySelector("#downloadButton"),
  recordsBody: document.querySelector("#recordsBody"),
  recordsFoot: document.querySelector("#recordsFoot"),
  summaryText: document.querySelector("#summaryText"),
  quantityCellTemplate: document.querySelector("#quantityCellTemplate"),
};

init();

async function init() {
  elements.workDate.value = new Date().toISOString().slice(0, 10);
  bindEvents();
  connectSupabase();

  const savedSession = readLocal(STORAGE_KEYS.session, null);
  if (savedSession?.id) {
    await completeLogin(savedSession);
  }
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", login);
  elements.logoutButton.addEventListener("click", logout);
  elements.saveSettingsButton.addEventListener("click", saveSettings);
  elements.reloadButton.addEventListener("click", loadRecords);
  elements.saveRecordsButton.addEventListener("click", saveRecords);
  elements.downloadButton.addEventListener("click", downloadExcel);
  elements.workDate.addEventListener("change", loadRecords);
}

function connectSupabase() {
  const config = window.WORKCHECK_CONFIG || {};
  const url = config.SUPABASE_URL || "";
  const key = config.SUPABASE_PUBLISHABLE_KEY || "";

  if (!url || !key || !window.supabase) {
    setConnection(false);
    elements.loginMessage.textContent = "Supabase 환경설정이 없습니다. Render 환경변수를 확인하세요.";
    return;
  }

  state.client = window.supabase.createClient(url, key);
  setConnection(true);
}

async function login(event) {
  event.preventDefault();
  elements.loginMessage.textContent = "";

  const loginId = elements.loginId.value.trim();
  const password = elements.loginPassword.value;

  if (!state.connected) {
    if (!loginId || !password) {
      elements.loginMessage.textContent = "아이디와 패스워드를 입력하세요.";
      return;
    }

    const localUser = {
      id: `local-${loginId}`,
      loginId,
      displayName: loginId,
      role: loginId === "admin" ? "admin" : "user",
    };
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(localUser));
    await completeLogin(localUser);
    return;
  }

  const { data, error } = await state.client.rpc("work_login", {
    p_login_id: loginId,
    p_password: password,
  });

  const user = Array.isArray(data) ? data[0] : data;
  if (error || !user) {
    elements.loginMessage.textContent = "아이디 또는 패스워드가 맞지 않습니다.";
    return;
  }

  const sessionUser = {
    id: user.user_id,
    loginId: user.login_id,
    displayName: user.display_name || user.login_id,
    role: user.role || "user",
  };

  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(sessionUser));
  await completeLogin(sessionUser);
}

async function completeLogin(user) {
  state.user = user;
  await loadSettings();

  elements.loginView.hidden = true;
  elements.appView.hidden = false;
  elements.sessionText.textContent = `${user.displayName || user.loginId} · ${user.role === "admin" ? "관리자" : "일반사용자"}`;
  renderRole();
  renderSettings();
  await loadRecords();
}

function logout() {
  localStorage.removeItem(STORAGE_KEYS.session);
  state.user = null;
  state.records = [];
  elements.loginPassword.value = "";
  elements.appView.hidden = true;
  elements.loginView.hidden = false;
}

function renderRole() {
  document.querySelectorAll(".admin-only").forEach((element) => {
    element.hidden = state.user?.role !== "admin";
  });
}

function setConnection(connected) {
  state.connected = connected;
  elements.connectionStatus.textContent = connected ? "Supabase 연결" : "로컬 모드";
  elements.connectionStatus.classList.toggle("connected", connected);
}

async function loadSettings() {
  if (state.connected) {
    const { data, error } = await state.client.from("work_settings").select("value").eq("id", "default").maybeSingle();
    if (!error && data?.value) {
      state.settings = normalizeSettings(data.value);
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
      return;
    }
  }

  state.settings = normalizeSettings(readLocal(STORAGE_KEYS.settings, defaultSettings));
}

function renderSettings() {
  elements.teamCount.value = state.settings.teamCount;
}

async function saveSettings() {
  if (state.user?.role !== "admin") return;

  state.settings = normalizeSettings({ teamCount: Number(elements.teamCount.value) });
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));

  if (state.connected) {
    const { error } = await state.client.from("work_settings").upsert({
      id: "default",
      value: state.settings,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      alert(`조 수량 저장 실패: ${error.message}`);
      return;
    }
  }

  state.records = mergeRecordsWithGrid(state.records);
  renderRecords();
  alert("조 수량을 저장했습니다.");
}

async function loadRecords() {
  if (!state.user) return;

  if (state.connected) {
    const { data, error } = await state.client
      .from("work_records")
      .select("*")
      .eq("work_date", elements.workDate.value)
      .order("team_no")
      .order("period")
      .order("work_type");

    if (error) {
      alert(`조회 실패: ${error.message}`);
      return;
    }

    state.records = mergeRecordsWithGrid((data || []).map(fromDbRecord));
    renderRecords();
    return;
  }

  const allLocal = readLocal(STORAGE_KEYS.records, {});
  state.records = mergeRecordsWithGrid(allLocal[elements.workDate.value] || []);
  renderRecords();
}

async function saveRecords() {
  if (!state.user) return;

  syncInputsToState();
  saveRecordsLocal();

  if (state.connected) {
    const payload = state.records.map(toDbRecord);
    const { error } = await state.client.from("work_records").upsert(payload, {
      onConflict: "work_date,team_no,period,work_type",
    });

    if (error) {
      alert(`저장 실패: ${error.message}`);
      return;
    }
  }

  renderRecords();
  alert("수량을 저장했습니다.");
}

function saveRecordsLocal() {
  const allLocal = readLocal(STORAGE_KEYS.records, {});
  allLocal[elements.workDate.value] = state.records;
  localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(allLocal));
}

function createBlankRecords() {
  const records = [];

  for (let teamNo = 1; teamNo <= state.settings.teamCount; teamNo += 1) {
    for (const period of PERIODS) {
      for (const type of WORK_TYPES) {
        records.push({
          workDate: elements.workDate.value,
          teamNo,
          period: period.key,
          workType: type.key,
          actualQty: 0,
        });
      }
    }
  }

  return records;
}

function mergeRecordsWithGrid(records) {
  const byKey = new Map(records.map((record) => [recordKey(record), record]));
  return createBlankRecords().map((base) => {
    const saved = byKey.get(recordKey(base));
    return saved ? { ...base, actualQty: Number(saved.actualQty || 0) } : base;
  });
}

function renderRecords() {
  elements.recordsBody.innerHTML = "";
  elements.recordsFoot.innerHTML = "";

  for (let teamNo = 1; teamNo <= state.settings.teamCount; teamNo += 1) {
    const row = document.createElement("tr");
    const teamHeader = document.createElement("th");
    teamHeader.textContent = `${teamNo}조`;
    row.append(teamHeader);

    for (const period of PERIODS) {
      for (const type of WORK_TYPES) {
        row.append(createQuantityCell(teamNo, period.key, type.key));
      }
    }

    row.append(createTextCell(getTeamTotal(teamNo)));
    elements.recordsBody.append(row);
  }

  renderFoot();
  renderSummary();
}

function createQuantityCell(teamNo, period, workType) {
  const record = findRecord(teamNo, period, workType);
  const td = document.createElement("td");
  const cell = elements.quantityCellTemplate.content.firstElementChild.cloneNode(true);
  const input = cell.querySelector("input");
  input.value = record.actualQty;
  input.dataset.teamNo = teamNo;
  input.dataset.period = period;
  input.dataset.workType = workType;
  input.addEventListener("input", () => {
    syncInputsToState();
    renderFoot();
    renderSummary();
  });
  td.append(cell);
  return td;
}

function renderFoot() {
  syncInputsToState();

  const row = document.createElement("tr");
  row.append(createTextCell("합계", "th"));

  for (const period of PERIODS) {
    for (const type of WORK_TYPES) {
      const total = state.records
        .filter((record) => record.period === period.key && record.workType === type.key)
        .reduce((sum, record) => sum + Number(record.actualQty || 0), 0);
      row.append(createTextCell(total));
    }
  }

  row.append(createTextCell(getGrandTotal()));
  elements.recordsFoot.replaceChildren(row);
}

function renderSummary() {
  elements.summaryText.textContent = `${elements.workDate.value} 입력 ${getGrandTotal().toLocaleString()}개`;
}

function syncInputsToState() {
  document.querySelectorAll(".quantity-cell input").forEach((input) => {
    const record = findRecord(Number(input.dataset.teamNo), input.dataset.period, input.dataset.workType);
    if (record) record.actualQty = Number(input.value || 0);
  });
}

function createTextCell(text, tagName = "td") {
  const cell = document.createElement(tagName);
  cell.textContent = text;
  return cell;
}

function findRecord(teamNo, period, workType) {
  return state.records.find(
    (record) => record.teamNo === teamNo && record.period === period && record.workType === workType,
  );
}

function getTeamTotal(teamNo) {
  return state.records
    .filter((record) => record.teamNo === teamNo)
    .reduce((sum, record) => sum + Number(record.actualQty || 0), 0);
}

function getGrandTotal() {
  return state.records.reduce((sum, record) => sum + Number(record.actualQty || 0), 0);
}

function downloadExcel() {
  syncInputsToState();
  const date = elements.workDate.value;
  const headerRows = [["조", "오전 합동", "오전 이전", "오전 기존", "오후 합동", "오후 이전", "오후 기존", "합계"]];
  const bodyRows = [];

  for (let teamNo = 1; teamNo <= state.settings.teamCount; teamNo += 1) {
    bodyRows.push([
      `${teamNo}조`,
      ...PERIODS.flatMap((period) =>
        WORK_TYPES.map((type) => findRecord(teamNo, period.key, type.key).actualQty),
      ),
      getTeamTotal(teamNo),
    ]);
  }

  bodyRows.push([
    "합계",
    ...PERIODS.flatMap((period) =>
      WORK_TYPES.map((type) =>
        state.records
          .filter((record) => record.period === period.key && record.workType === type.key)
          .reduce((sum, record) => sum + Number(record.actualQty || 0), 0),
      ),
    ),
    getGrandTotal(),
  ]);

  const rows = [...headerRows, ...bodyRows]
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`)
    .join("");
  const html = `<!doctype html><html><head><meta charset="UTF-8"></head><body><table>${rows}</table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `실적관리_${date}.xls`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function toDbRecord(record) {
  return {
    work_date: record.workDate,
    team_no: record.teamNo,
    period: record.period,
    work_type: record.workType,
    actual_qty: record.actualQty,
    updated_by: state.user.id,
    updated_at: new Date().toISOString(),
  };
}

function fromDbRecord(record) {
  return {
    workDate: record.work_date,
    teamNo: record.team_no,
    period: record.period,
    workType: record.work_type,
    actualQty: record.actual_qty,
  };
}

function recordKey(record) {
  return `${record.workDate}:${record.teamNo}:${record.period}:${record.workType}`;
}

function normalizeSettings(settings) {
  return {
    teamCount: Math.max(1, Number(settings.teamCount || settings.team_count || defaultSettings.teamCount)),
  };
}

function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
