document.addEventListener("DOMContentLoaded", () => {
  // ==========================
  // ロック画面（簡易パスワード認証）
  // ==========================
  const lockScreen = document.getElementById("lock-screen");
  const mainApp = document.getElementById("main-app");
  const appPwInput = document.getElementById("app-password");
  const unlockBtn = document.getElementById("unlock-btn");

  // 好きなパスワードに変えてOK（ソース見れば分かるので本当の秘密には使わない）
  const LOCK_PASSWORD = "todo123";

  function unlockApp() {
    const entered = appPwInput.value;
    if (entered === LOCK_PASSWORD) {
      if (lockScreen) lockScreen.style.display = "none";
      if (mainApp) mainApp.hidden = false;
      appPwInput.value = "";
    } else {
      alert("パスワードが違います");
    }
  }

  if (unlockBtn && appPwInput) {
    unlockBtn.addEventListener("click", unlockApp);
    appPwInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        unlockApp();
      }
    });
  }

  // ==========================
  // DOM 取得（本体アプリ）
  // ==========================
  const input = document.getElementById("new-task");
  const dateInput = document.getElementById("task-date");
  const startTimeInput = document.getElementById("task-start-time");
  const endTimeInput = document.getElementById("task-end-time");
  const typeSelect = document.getElementById("task-type");
  const colorSelect = document.getElementById("task-color");
  const addBtn = document.getElementById("add-btn");

  const listEl = document.getElementById("task-list");
  const leftCountEl = document.getElementById("left-count");
  const filterButtons = document.querySelectorAll(".filter-btn");

  const syncToGoogleBtn = document.getElementById("sync-to-google");
  const syncFromGoogleBtn = document.getElementById("sync-from-google");
  const autoSyncCheckbox = document.getElementById("auto-sync-checkbox");

  // ==========================
  // 設定・状態
  // ==========================
  const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5分
  let autoSyncTimer = null;
  let editingTaskId = null; // 今編集中のタスクID（なければ null）

  const STORAGE_KEY = "todo-tasks-gcal-v3";
  let tasks = [];
  let currentFilter = "all";

  // ==========================
  // localStorage 関連
  // ==========================
  function loadTasks() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      tasks = [];
      return;
    }
    try {
      const data = JSON.parse(raw);
      tasks = (Array.isArray(data) ? data : []).map((t) => ({
        id: t.id,
        text: t.text,
        completed: !!t.completed,
        createdAt: t.createdAt || new Date().toISOString(),
        date: t.date || t.dueDate || null,          // YYYY-MM-DD
        startTime: t.startTime || null,             // HH:MM
        endTime: t.endTime || t.dueTime || null,    // HH:MM
        colorId: t.colorId || "",
        type: t.type === "event" ? "event" : "task" // デフォルトはタスク
      }));
    } catch {
      tasks = [];
    }
  }

  function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function getTodayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // ==========================
  // 基本操作
  // ==========================
  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks();
    render();
  }

  function toggleTask(id) {
    tasks = tasks.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    saveTasks();
    render();
  }

  function getFilteredTasks() {
    if (currentFilter === "active") {
      return tasks.filter((t) => !t.completed);
    }
    if (currentFilter === "completed") {
      return tasks.filter((t) => t.completed);
    }
    return tasks;
  }

  function setFilter(filter) {
    currentFilter = filter;
    filterButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.filter === filter);
    });
    render();
  }

  function updateLeftCount() {
    const left = tasks.filter((t) => !t.completed).length;
    leftCountEl.textContent = `残り ${left} 件`;
  }

  // ==========================
  // 表示用フォーマット
  // ==========================
  function formatDate(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${day} ${h}:${min}`;
  }

  function formatDue(dateStr, startTime, endTime, type) {
    if (!dateStr && !startTime && !endTime) return "";
    const dateLabel = dateStr
      ? (() => {
          const [y, m, d] = dateStr.split("-");
          return `${y}/${m}/${d}`;
        })()
      : "";

    if (type === "event") {
      if (dateStr && startTime && endTime) {
        return `予定: ${dateLabel} ${startTime}〜${endTime}`;
      }
      if (dateStr && startTime) {
        return `予定: ${dateLabel} ${startTime}〜`;
      }
      if (dateStr) return `予定: ${dateLabel}`;
      return "予定";
    } else {
      if (dateStr && endTime) {
        return `締切: ${dateLabel} ${endTime}`;
      }
      if (dateStr) return `締切: ${dateLabel}`;
      if (endTime) return `締切時間: ${endTime}`;
      return "タスク";
    }
  }

  function getColorHex(colorId) {
    switch (colorId) {
      case "1": return "#a4bdfc"; // 青
      case "2": return "#7ae7bf"; // 緑
      case "5": return "#fbd75b"; // 黄
      case "11": return "#dc2127"; // 赤
      default: return "#4f7cff";
    }
  }

  function getColorLabel(colorId) {
    switch (colorId) {
      case "1": return "青";
      case "2": return "緑";
      case "5": return "黄";
      case "11": return "赤";
      default: return "";
    }
  }

  // ==========================
  // Google 認証（OAuth2）
  // ==========================
  const GOOGLE_CLIENT_ID =
    "229894785828-89et0trr2qo7v1j03hqdgbem6819hatj.apps.googleusercontent.com";
  const GOOGLE_SCOPES =
    "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";

  let googleTokenClient = null;
  let googleAccessToken = null;

  function ensureGoogleTokenClient() {
    if (!googleTokenClient) {
      if (!window.google || !google.accounts || !google.accounts.oauth2) {
        alert("Googleのスクリプトがまだ読み込まれていません。少し待ってから再試行してください。");
        return null;
      }
      googleTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: (tokenResponse) => {
          googleAccessToken = tokenResponse.access_token;
        },
      });
    }
    return googleTokenClient;
  }

  function getAccessToken() {
    return new Promise((resolve, reject) => {
      const client = ensureGoogleTokenClient();
      if (!client) {
        reject(new Error("token client not ready"));
        return;
      }

      if (googleAccessToken) {
        resolve(googleAccessToken);
        return;
      }

      client.callback = (tokenResponse) => {
        googleAccessToken = tokenResponse.access_token;
        resolve(googleAccessToken);
      };

      client.requestAccessToken({ prompt: "consent" });
    });
  }

  // タスクからカレンダー用の開始日時
  function buildStartDate(task) {
    if (!task.date) return null;

    if (task.type === "event") {
      const time = task.startTime || "09:00";
      return new Date(`${task.date}T${time}:00`);
    } else {
      const time = task.endTime || "23:00";
      return new Date(`${task.date}T${time}:00`);
    }
  }

  // タスクからカレンダー用の終了日時
  function buildEndDate(task, startDate) {
    if (task.type === "event") {
      if (task.date && task.endTime) {
        return new Date(`${task.date}T${task.endTime}:00`);
      }
      return new Date(startDate.getTime() + 60 * 60 * 1000); // +1時間
    } else {
      return new Date(startDate.getTime() + 30 * 60 * 1000); // +30分
    }
  }

  // ==========================
  // Googleカレンダー ↔ ToDo 連携
  // ==========================
  async function syncTasksToGoogle() {
    try {
      const token = await getAccessToken();

      const targetTasks = tasks.filter((t) => !t.completed && t.date);

      if (targetTasks.length === 0) {
        alert("日付が設定された未完了のタスク / 予定がありません。");
        return;
      }

      for (const task of targetTasks) {
        const startDate = buildStartDate(task);
        if (!startDate) continue;
        const endDate = buildEndDate(task, startDate);

        const eventBody = {
          summary: task.text,
          description:
            task.type === "event"
              ? "予定（ToDoアプリから追加）"
              : "タスクの締切（ToDoアプリから追加）",
          start: {
            dateTime: startDate.toISOString(),
            timeZone: "Asia/Tokyo",
          },
          end: {
            dateTime: endDate.toISOString(),
            timeZone: "Asia/Tokyo",
          },
        };

        if (task.colorId) {
          eventBody.colorId = task.colorId;
        }

        const res = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(eventBody),
          }
        );

        if (!res.ok) {
          console.error("カレンダー登録失敗", await res.text());
        }
      }

      alert("未完了のタスク / 予定をGoogleカレンダーに登録しました！");
    } catch (e) {
      console.error(e);
      alert("Googleカレンダーへの同期に失敗しました。設定や権限を確認してください。");
    }
  }

  async function syncFromGoogleToTasks(options = {}) {
    const { silent = false } = options;
    try {
      const token = await getAccessToken();

      const now = new Date();
      const max = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7日先まで

      const params = new URLSearchParams({
        timeMin: now.toISOString(),
        timeMax: max.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
      });

      const res = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?" +
          params.toString(),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        console.error("カレンダー取得失敗", await res.text());
        if (!silent) {
          alert("Googleカレンダーから予定を取得できませんでした。");
        }
        return;
      }

      const data = await res.json();

      for (const ev of data.items || []) {
        const title = ev.summary || "(無題)";
        const start = ev.start || {};
        const end = ev.end || {};
        let dateStr = null;
        let startTime = null;
        let endTime = null;

        if (start.dateTime) {
          const s = new Date(start.dateTime);
          const sIso = s.toISOString();
          dateStr = sIso.substring(0, 10);
          startTime = sIso.substring(11, 16);
        } else if (start.date) {
          dateStr = start.date; // 終日イベント
        }

        if (end.dateTime) {
          const eDate = new Date(end.dateTime);
          const eIso = eDate.toISOString();
          endTime = eIso.substring(11, 16);
        }

        const colorId = ev.colorId || "";

        const exists = tasks.some(
          (t) =>
            t.text === `[GCal] ${title}` &&
            t.date === dateStr &&
            (t.startTime || "") === (startTime || "") &&
            (t.endTime || "") === (endTime || "")
        );
        if (exists) continue;

        tasks.unshift({
          id: Date.now() + Math.random(),
          text: `[GCal] ${title}`,
          completed: false,
          createdAt: new Date().toISOString(),
          date: dateStr,
          startTime,
          endTime,
          colorId,
          type: "event",
        });
      }

      saveTasks();
      render();
      if (!silent) {
        alert("Googleカレンダーから予定を読み込みました！（7日分）");
      }
    } catch (e) {
      console.error(e);
      if (!silent) {
        alert("Googleカレンダーとの連携に失敗しました。");
      }
    }
  }

  function startAutoSync() {
    if (autoSyncTimer) return;
    // まず1回すぐ同期（アラートなし）
    syncFromGoogleToTasks({ silent: true });
    // その後、指定間隔で自動同期
    autoSyncTimer = setInterval(() => {
      syncFromGoogleToTasks({ silent: true });
    }, AUTO_SYNC_INTERVAL_MS);
  }

  function stopAutoSync() {
    if (autoSyncTimer) {
      clearInterval(autoSyncTimer);
      autoSyncTimer = null;
    }
  }

  // ==========================
  // 編集開始（フォームに反映）
  // ==========================
  function startEditTask(task) {
    input.value = task.text || "";
    dateInput.value = task.date || "";
    startTimeInput.value = task.startTime || "";
    endTimeInput.value = task.endTime || "";
    typeSelect.value = task.type || "task";
    colorSelect.value = task.colorId || "";

    editingTaskId = task.id;
    addBtn.textContent = "更新";
  }

  function clearForm() {
    input.value = "";
    dateInput.value = "";
    startTimeInput.value = "";
    endTimeInput.value = "";
    typeSelect.value = "task";
    colorSelect.value = "";
  }

  // ==========================
  // タスク要素の生成（編集ボタン付き）
  // ==========================
  function createTaskElement(task, todayStr) {
    const li = document.createElement("li");
    li.className = "task-item";
    if (task.completed) li.classList.add("completed");

    if (task.date && task.date < todayStr && !task.completed) {
      li.classList.add("overdue");
    }

    if (task.colorId) {
      li.style.borderLeftColor = getColorHex(task.colorId);
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = task.completed;
    checkbox.addEventListener("change", () => toggleTask(task.id));

    const textContainer = document.createElement("div");
    textContainer.style.flex = "1";

    const textSpan = document.createElement("div");
    textSpan.className = "task-text";
    if (task.completed) textSpan.classList.add("completed");
    textSpan.textContent = task.text;

    const meta = document.createElement("div");
    meta.className = "task-meta";

    const createdText = formatDate(task.createdAt);
    const dueText = formatDue(task.date, task.startTime, task.endTime, task.type);

    const parts = [];
    parts.push(`作成: ${createdText}`);
    if (dueText) parts.push(dueText);
    parts.push(task.type === "event" ? "種別: 予定" : "種別: タスク");
    meta.textContent = parts.join(" ／ ");

    textContainer.appendChild(textSpan);
    textContainer.appendChild(meta);

    const right = document.createElement("div");
    right.className = "task-right";

    if (task.colorId) {
      const label = document.createElement("span");
      label.className = "task-color-label";
      label.textContent = getColorLabel(task.colorId);
      right.appendChild(label);
    }

    // Googleカレンダーの予定作成画面を開くボタン（新しいタブ）
    if (task.date) {
      const calBtn = document.createElement("button");
      calBtn.className = "icon-btn";
      calBtn.textContent = "カレンダー画面";
      calBtn.title = "Googleカレンダーの予定作成画面を開く";
      calBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const baseDate = buildStartDate(task) || new Date(task.date);
        const toYyyymmdd = (date) => {
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, "0");
          const d = String(date.getDate()).padStart(2, "0");
          return `${y}${m}${d}`;
        };
        const startStr = toYyyymmdd(baseDate);
        const endDate = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
        const endStr = toYyyymmdd(endDate);
        const title = encodeURIComponent(task.text);
        const details = encodeURIComponent("ToDoアプリから追加");
        const dates = `${startStr}/${endStr}`;
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&sf=true&output=xml`;
        window.open(url, "_blank", "noopener,noreferrer");
      });
      right.appendChild(calBtn);
    }

    // 編集ボタン
    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn";
    editBtn.textContent = "編集";
    editBtn.addEventListener("click", () => {
      startEditTask(task);
    });
    right.appendChild(editBtn);

    // 削除ボタン
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn";
    deleteBtn.textContent = "削除";
    deleteBtn.addEventListener("click", () => {
      if (confirm("このタスクを削除しますか？")) {
        deleteTask(task.id);
      }
    });
    right.appendChild(deleteBtn);

    li.appendChild(checkbox);
    li.appendChild(textContainer);
    li.appendChild(right);

    return li;
  }

  // ==========================
  // 描画
  // ==========================
  function render() {
    const filtered = getFilteredTasks();
    listEl.innerHTML = "";
    const todayStr = getTodayStr();

    if (filtered.length === 0) {
      const li = document.createElement("li");
      li.className = "task-item";
      li.textContent = "タスク / 予定はありません。やることを書いてみよう！";
      listEl.appendChild(li);
      updateLeftCount();
      return;
    }

    const todayTasks = [];
    const futureTasks = [];
    const otherTasks = [];

    filtered.forEach((t) => {
      if (!t.date) {
        otherTasks.push(t);
      } else if (t.date === todayStr) {
        todayTasks.push(t);
      } else if (t.date > todayStr) {
        futureTasks.push(t);
      } else {
        otherTasks.push(t);
      }
    });

    function appendGroup(title, arr) {
      if (arr.length === 0) return;
      const header = document.createElement("li");
      header.className = "section-header";
      header.textContent = title;
      listEl.appendChild(header);
      arr.forEach((task) => {
        listEl.appendChild(createTaskElement(task, todayStr));
      });
    }

    appendGroup("今日のタスク / 予定", todayTasks);
    appendGroup("今後の予定 / 締切", futureTasks);
    appendGroup("その他（締切なし・過去分など）", otherTasks);

    updateLeftCount();
  }

  // ==========================
  // 追加 / 更新（フォーム送信処理）
  // ==========================
  function handleSubmit() {
    const text = input.value.trim();
    if (!text) {
      alert("やることの内容を入力してください");
      return;
    }

    const dateStr = dateInput.value || null;
    const startTimeStr = startTimeInput.value || null;
    const endTimeStr = endTimeInput.value || null;
    const typeStr = typeSelect.value || "task";
    const colorIdStr = colorSelect.value || "";
    const type = typeStr === "event" ? "event" : "task";

    if (editingTaskId !== null) {
      // 編集モード：既存タスクを更新
      const t = tasks.find((t) => t.id === editingTaskId);
      if (t) {
        t.text = text;
        t.date = dateStr;
        t.startTime = type === "event" ? startTimeStr : null;
        t.endTime = endTimeStr;
        t.type = type;
        t.colorId = colorIdStr;
      }
      editingTaskId = null;
      addBtn.textContent = "追加";
    } else {
      // 新規追加
      const task = {
        id: Date.now(),
        text,
        completed: false,
        createdAt: new Date().toISOString(),
        date: dateStr,
        startTime: type === "event" ? startTimeStr : null,
        endTime: endTimeStr,
        colorId: colorIdStr,
        type,
      };
      tasks.unshift(task);
    }

    saveTasks();
    render();
    clearForm();
  }

  // ==========================
  // イベント登録
  // ==========================
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      handleSubmit();
    });
  }

  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        handleSubmit();
      }
    });
  }

  [dateInput, startTimeInput, endTimeInput].forEach((el) => {
    if (!el) return;
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        handleSubmit();
      }
    });
  });

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setFilter(btn.dataset.filter);
    });
  });

  if (syncToGoogleBtn) {
    syncToGoogleBtn.addEventListener("click", () => {
      syncTasksToGoogle();
    });
  }

  if (syncFromGoogleBtn) {
    syncFromGoogleBtn.addEventListener("click", () => {
      syncFromGoogleToTasks();
    });
  }

  if (autoSyncCheckbox) {
    autoSyncCheckbox.addEventListener("change", () => {
      if (autoSyncCheckbox.checked) {
        startAutoSync();
      } else {
        stopAutoSync();
      }
    });
  }

  // ==========================
  // 初期化
  // ==========================
  loadTasks();
  render();
});
