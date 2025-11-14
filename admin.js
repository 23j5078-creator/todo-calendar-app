document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logout-btn");
  const userListEl = document.getElementById("user-list");

  const CURRENT_USER_KEY = "memoapp-current-user";
  const USER_PREFIX = "memoapp-user-";

  // 管理者か確認（簡易的に管理者アカウント固定）
  const adminUsername = "admin"; // 管理者ユーザー名
  const loggedInUser = localStorage.getItem(CURRENT_USER_KEY);

  if (loggedInUser !== adminUsername) {
    alert("管理者以外はアクセスできません。");
    window.location.href = "index.html"; // やることリストへリダイレクト
  }

  // ユーザー一覧を表示
  function renderUserList() {
    userListEl.innerHTML = "";
    const users = Object.keys(localStorage)
      .filter((key) => key.startsWith(USER_PREFIX))
      .map((key) => key.replace(USER_PREFIX, ""));

    if (users.length === 0) {
      const li = document.createElement("li");
      li.textContent = "登録されているユーザーはありません。";
      userListEl.appendChild(li);
      return;
    }

    users.forEach((username) => {
      const li = document.createElement("li");

      const userSpan = document.createElement("span");
      userSpan.textContent = username;

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "削除";
      deleteBtn.addEventListener("click", () => {
        if (confirm(`${username} を削除しますか？`)) {
          deleteUser(username);
          renderUserList(); // 再描画
        }
      });

      li.appendChild(userSpan);
      li.appendChild(deleteBtn);
      userListEl.appendChild(li);
    });
  }

  // ユーザー削除処理
  function deleteUser(username) {
    localStorage.removeItem(USER_PREFIX + username);
  }

  // ログアウト処理
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem(CURRENT_USER_KEY);
    window.location.href = "index.html"; // ログイン画面にリダイレクト
  });

  renderUserList(); // ユーザーリストの表示
});
