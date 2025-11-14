// ▼ 簡易ログイン情報（自由に変えてOK）
const USERNAME = "user";
const PASSWORD = "pass";

// ▼ ログイン処理
document.getElementById("login-btn").addEventListener("click", () => {
  const u = document.getElementById("login-user").value;
  const p = document.getElementById("login-pass").value;

  if (u === USERNAME && p === PASSWORD) {
    localStorage.setItem("memo_login", "true");
    showMemoApp();
  } else {
    alert("ユーザー名またはパスワードが違います");
  }
});

// ▼ ログイン状態チェック
window.onload = () => {
  if (localStorage.getItem("memo_login") === "true") {
    showMemoApp();
  }
};

// ▼ ログアウト
document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("memo_login");
  location.reload();
});

// ▼ メモ保存
document.getElementById("save-btn").addEventListener("click", () => {
  const text = document.getElementById("memo-input").value;
  if (text.trim() === "") return;

  let memos = JSON.parse(localStorage.getItem("memos") || "[]");
  memos.push(text);
  localStorage.setItem("memos", JSON.stringify(memos));

  document.getElementById("memo-input").value = "";
  loadMemos();
});

// ▼ メモ読み込み
function loadMemos() {
  let memos = JSON.parse(localStorage.getItem("memos") || "[]");
  const list = document.getElementById("memo-list");
  list.innerHTML = "";
  memos.forEach((m) => {
    const li = document.createElement("li");
    li.textContent = m;
    list.appendChild(li);
  });
}

// ▼ メモ画面を表示
function showMemoApp() {
  document.getElementById("login-area").style.display = "none";
  document.getElementById("memo-area").style.display = "block";
  loadMemos();
}
