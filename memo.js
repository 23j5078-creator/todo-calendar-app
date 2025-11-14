document.addEventListener("DOMContentLoaded", () => {
  const authSection = document.getElementById("auth-section");
  const memoSection = document.getElementById("memo-section");

  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const loginBtn = document.getElementById("login-btn");
  const registerBtn = document.getElementById("register-btn");

  const currentUserLabel = document.getElementById("current-user-label");
  const logoutBtn = document.getElementById("logout-btn");

  const memoBodyInput = document.getElementById("memo-body");
  const addMemoBtn = document.getElementById("add-memo-btn");
  const memoListEl = document.getElementById("memo-list");
  const adminSection = document.getElementById("admin-section");
  const userListEl = document.getElementById("user-list");

  const CURRENT_USER_KEY = "memoapp-current-user";
  const USER_PREFIX = "memoapp-user-";
  
  const CURRENT_USER_KEY = "memoapp-current-user";
  const USER_PREFIX = "memoapp-user-";

  const ADMIN_USERNAME = "admin"; // これを追加


  let currentUser = null;
  let currentUserData = null;

  // ===== ユーティリティ =====
  async function hashPassword(password) {
    const enc = new TextEncoder();
    const data = enc.encode(password);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const bytes = new Uint8Array(digest);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function getUserKey(username) {
    return USER_PREFIX + username;
  }

  function loadUserData(username) {
    const raw = localStorage.getItem(getUserKey(username));
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      if (!Array.isArray(obj.memos)) obj.memos = [];
      return obj;
    } catch {
      return null;
    }
  }

  function saveUserData(username, data) {
    localStorage.setItem(getUserKey(username), JSON.stringify(data));
  }

  function formatDateTime(isoStr) {
    const d = new Date(isoStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${day} ${h}:${min}`;
  }

  // ===== メモ描画 =====
  function renderMemos() {
    memoListEl.innerHTML = "";

    if (!currentUserData || !currentUserData.memos.length) {
      const li = document.createElement("li");
      li.className = "memo-item";
      li.textContent = "メモはまだありません。下の入力欄から追加してみてください。";
      memoListEl.appendChild(li);
      return;
    }

    const memos = [...currentUserData.memos].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    for (const memo of memos) {
      const li = document.createElement("li");
      li.className = "memo-item";

      const titleRow = document.createElement("div");
      titleRow.className = "memo-title-row";

      const metaEl = document.createElement("div");
      metaEl.className = "memo-meta";
      metaEl.textContent = formatDateTime(memo.createdAt);

      const actions = document.createElement("div");
      actions.className = "memo-actions";

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "icon-btn";
      deleteBtn.textContent = "削除";
      deleteBtn.addEventListener("click", () => {
        if (confirm("このメモを削除しますか？")) {
          currentUserData.memos = currentUserData.memos.filter(
            (m) => m.id !== memo.id
          );
          saveUserData(currentUser, currentUserData);
          renderMemos();
        }
      });

      actions.appendChild(deleteBtn);

      titleRow.appendChild(metaEl);
      titleRow.appendChild(actions);

      const bodyEl = document.createElement("div");
      bodyEl.className = "memo-body-text";
      bodyEl.textContent = memo.body;

      li.appendChild(titleRow);
      li.appendChild(bodyEl);

      memoListEl.appendChild(li);
    }
  }
  function renderUserList() {
    userListEl.innerHTML = "";

    // localStorage に保存されているユーザーキーを全部探す
    const users = Object.keys(localStorage)
      .filter((key) => key.startsWith(USER_PREFIX))
      .map((key) => key.replace(USER_PREFIX, ""));

    if (!users.length) {
      const li = document.createElement("li");
      li.className = "memo-item";
      li.textContent = "登録されているユーザーはいません。";
      userListEl.appendChild(li);
      return;
    }

    users.forEach((username) => {
      const li = document.createElement("li");
      li.className = "memo-item";

      const nameEl = document.createElement("span");
      nameEl.textContent = username;

      const btn = document.createElement("button");
      btn.className = "user-delete-btn";
      btn.textContent = "削除";

      // admin 自分自身は削除できないようにする
      if (username === ADMIN_USERNAME) {
        btn.disabled = true;
        btn.textContent = "admin（削除不可）";
      } else {
        btn.addEventListener("click", () => {
          if (confirm(`${username} のアカウントとメモを削除しますか？`)) {
            localStorage.removeItem(USER_PREFIX + username);
            // もし現在ログイン中のユーザーなら、強制ログアウト
            if (currentUser === username) {
              handleLogout();
            } else {
              renderUserList();
            }
          }
        });
      }

      const row = document.createElement("div");
      row.className = "memo-title-row";
      row.appendChild(nameEl);
      row.appendChild(btn);

      li.appendChild(row);
      userListEl.appendChild(li);
    });
  }

  // ===== 画面切り替え =====
  function showAuthSection() {
    authSection.hidden = false;
    memoSection.hidden = true;
    currentUserLabel.textContent = "";
    currentUser = null;
    currentUserData = null;
  }

    function showMemoSection(username, userData) {
    currentUser = username;
    currentUserData = userData;
    authSection.hidden = true;
    memoSection.hidden = false;
    currentUserLabel.textContent = username;
    renderMemos();

    // 管理者かどうか判定
    if (username === ADMIN_USERNAME) {
      adminSection.hidden = false;
      renderUserList();
    } else {
      adminSection.hidden = true;
    }
  }


  // ===== ログインチェック =====
  (function init() {
    const lastUser = localStorage.getItem(CURRENT_USER_KEY);
    if (lastUser) {
      const userData = loadUserData(lastUser);
      if (userData) {
        showMemoSection(lastUser, userData);
        return;
      }
    }
    showAuthSection();
  })();

  // ===== ログイン =====
  async function handleLogin() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      alert("ユーザー名とパスワードを入力してください。");
      return;
    }

    const userData = loadUserData(username);
    if (!userData) {
      alert("このユーザーは登録されていません。新規登録してください。");
      return;
    }

    const hash = await hashPassword(password);
    if (hash !== userData.passwordHash) {
      alert("パスワードが違います。");
      return;
    }

    localStorage.setItem(CURRENT_USER_KEY, username);
    passwordInput.value = "";
    showMemoSection(username, userData);
  }

  // ===== 新規登録 =====
  async function handleRegister() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      alert("ユーザー名とパスワードを入力してください。");
      return;
    }

    if (username.includes(" ")) {
      alert("ユーザー名にスペースは使えません。");
      return;
    }

    if (loadUserData(username)) {
      alert("このユーザー名は既に使われています。");
      return;
    }

    const hash = await hashPassword(password);

    const newUserData = {
      passwordHash: hash,
      memos: [],
    };

    saveUserData(username, newUserData);
    localStorage.setItem(CURRENT_USER_KEY, username);
    passwordInput.value = "";
    alert("新規登録しました。ログインしました。");
    showMemoSection(username, newUserData);
  }

  // ===== ログアウト =====
  function handleLogout() {
    localStorage.removeItem(CURRENT_USER_KEY);
    showAuthSection();
  }

  // ===== メモ追加 =====
  function handleAddMemo() {
    if (!currentUser || !currentUserData) {
      alert("まずログインしてください。");
      return;
    }

    const body = memoBodyInput.value.trim();
    if (!body) {
      alert("メモの内容を入力してください。");
      return;
    }

    const memo = {
      id: Date.now(),
      body,
      createdAt: new Date().toISOString(),
    };

    currentUserData.memos.push(memo);
    saveUserData(currentUser, currentUserData);

    memoBodyInput.value = "";
    renderMemos();
  }

  // ===== イベント設定 =====
  loginBtn.addEventListener("click", () => {
    handleLogin();
  });

  registerBtn.addEventListener("click", () => {
    handleRegister();
  });

  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  });

  addMemoBtn.addEventListener("click", () => {
    handleAddMemo();
  });

  logoutBtn.addEventListener("click", () => {
    handleLogout();
  });
});
