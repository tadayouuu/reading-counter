/* =========================
   Firebase 初期化（module）
========================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCyhj_1FKhJ4OrsiIZOeA1xFS8WIKW_W-w",
    authDomain: "reading-counter.firebaseapp.com",
    projectId: "reading-counter",
    storageBucket: "reading-counter.firebasestorage.app",
    messagingSenderId: "738854844218",
    appId: "1:738854844218:web:2adaf8ed4ba98e0a620203"
};

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

/* =========================
   基本状態
========================= */
const GOAL = 50;
const currentYear = new Date().getFullYear();
const yearTitleEl = document.getElementById("year");
yearTitleEl.textContent = `${currentYear}年 読書カウンター`;

let data = { logs: [] };
let selectedBook = null;
let editingId = null;
let selectedYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let currentUser = null;

/* =========================
   ローカル保存（ログアウト時用）
========================= */
function loadLocal() {
    const saved = localStorage.getItem("readingLogs");
    if (saved) data = JSON.parse(saved);
}
function saveLocal() {
    localStorage.setItem("readingLogs", JSON.stringify(data));
}

/* =========================
   Firestore 保存（ログイン時）
========================= */
async function loadRemote() {
    if (!currentUser) return;
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    data = snap.exists() ? snap.data() : { logs: [] };
}
async function saveRemote() {
    if (!currentUser) return;
    await setDoc(doc(db, "users", currentUser.uid), data);
}

/* 共通保存 */
async function saveAll() {
    if (currentUser) {
        await saveRemote();
    } else {
        saveLocal();
    }
}

/* =========================
   画面更新
========================= */
function update() {
    const yearLogs = data.logs.filter(l => {
        const d = new Date(l.finishedAt);
        return d.getFullYear() === selectedYear;
    });

    const monthLogs = yearLogs.filter(l => {
        const d = new Date(l.finishedAt);
        return d.getMonth() === currentMonth;
    });

    document.getElementById("count").textContent = yearLogs.length;
    // document.getElementById("progress").style.width =
    //     Math.min((yearLogs.length / GOAL) * 100, 100) + "%";

    const count = yearLogs.length;
    const progress = document.getElementById("progress");
    progress.style.width = Math.min((count / GOAL) * 100, 100) + "%";

    let color = "#9acd32"; // 黄緑（デフォルト）

    if (count >= 40) {
        color = "#c0392b"; // 赤
    } else if (count >= 30) {
        color = "#8e5a2b"; // 茶
    } else if (count >= 20) {
        color = "#f1c40f"; // 黄
    } else if (count >= 10) {
        color = "#2ecc71"; // 緑
    }

    progress.style.backgroundColor = color;

    renderList(monthLogs);
    renderCalendar(selectedYear, currentMonth);
    renderYearBookList(selectedYear);
}

/* =========================
   年セレクト
========================= */
function renderYearSelect() {
    const select = document.getElementById("yearSelect");
    select.innerHTML = "";

    const years = [...new Set(
        data.logs.map(l => new Date(l.finishedAt).getFullYear())
    )];

    if (!years.includes(currentYear)) {
        years.push(currentYear);
    }

    years.sort().forEach(y => {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = `${y}年`;
        select.appendChild(opt);
    });

    select.value = selectedYear;
}

/* =========================
   カレンダー
========================= */
function getLogsByMonth(year, month) {
    return data.logs.filter(l => {
        const d = new Date(l.finishedAt);
        return d.getFullYear() === year && d.getMonth() === month;
    });
}

function renderCalendar(year, month) {
    const calendar = document.getElementById("calendar");
    calendar.innerHTML = "";

    const logs = getLogsByMonth(year, month);
    const map = {};
    logs.forEach(l => {
        const day = new Date(l.finishedAt).getDate();
        map[day] = (map[day] || 0) + 1;
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        calendar.appendChild(document.createElement("div"));
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement("div");
        cell.className = "day";
        cell.textContent = d;

        if (map[d]) {
            cell.innerHTML += "<br>" + "📘".repeat(map[d]);
        }
        calendar.appendChild(cell);
    }

    updateMonthLabel();
}

function updateMonthLabel() {
    const label = document.getElementById("monthLabel");
    const count = data.logs.filter(l => {
        const d = new Date(l.finishedAt);
        return d.getFullYear() === selectedYear && d.getMonth() === currentMonth;
    }).length;

    label.textContent = `${selectedYear}年 ${currentMonth + 1}月（${count}冊）`;
}

/* =========================
   一覧
========================= */
function renderList(logs) {
    const ul = document.getElementById("bookList");
    ul.innerHTML = "";

    logs.slice().reverse().forEach(l => {
        const li = document.createElement("li");
        const stars = l.rating ? "★".repeat(l.rating) + "☆".repeat(5 - l.rating) : "";
        li.innerHTML = `
            <div class="item">
            <img class="cover" src="${l.image || ""}">
                <div class="info">
                    <div class="main">
                        <strong>${l.title || "（無題）"}</strong><br>
                        <small>${l.media}</small>
                        <button onclick="editLog(${l.id})">編集</button>
                        <button onclick="deleteLog(${l.id})">削除</button>
                    </div>
                    <div class="sub">
                        <div class="stars">${stars || ""}</p>
                        <div class="comment">${l.comment || ""}</p>
                    </div>
                </div>
            </div>
    `;
        ul.appendChild(li);
    });
}

function renderYearBookList(year) {
    const ul = document.getElementById("yearBookList");
    const title = document.getElementById("yearListTitle");

    const logs = data.logs
        .filter(l => new Date(l.finishedAt).getFullYear() === year)
        .slice()
        .sort((a, b) => new Date(a.finishedAt) - new Date(b.finishedAt));

    title.textContent = `${year}年に読んだ本（${logs.length}冊）`;
    ul.innerHTML = "";

    logs.forEach(l => {
        const li = document.createElement("li");
        li.innerHTML = `
          <span>${new Date(l.finishedAt).toLocaleDateString()}</span>
          ：<strong>${l.title || "（無題）"}</strong>
          <small>［${l.media}］</small>
        `;
        ul.appendChild(li);
    });
}

window.editLog = function (id) {
    const log = data.logs.find(l => l.id === id);
    if (!log) return;

    document.getElementById("title").value = log.title;
    document.querySelector(`input[name=media][value="${log.media}"]`).checked = true;
    selectedBook = { image: log.image };
    editingId = id;

    const d = new Date(log.finishedAt);
    document.getElementById("finishedDate").value = d.toISOString().slice(0, 10);
    document.getElementById("rating").value = log.rating ?? "";
    document.getElementById("comment").value = log.comment ?? "";
};

window.deleteLog = function (id) {
    if (!confirm("この記録、消してええ？")) return;
    data.logs = data.logs.filter(l => l.id !== id);
    saveAll();
    update();
};

/* =========================
   楽天検索
========================= */
async function searchBook() {
    const title = document.getElementById("title").value;
    if (!title) return;

    const res = await fetch(
        "https://reading-counter-api.kusu-dtc.workers.dev?title=" +
        encodeURIComponent(title)
    );
    const books = await res.json();

    const area = document.getElementById("preview");
    area.innerHTML = "";

    books.forEach(b => {
        const div = document.createElement("div");
        div.className = "previewItem";
        div.innerHTML = `<img src="${b.image}"><small>${b.title}</small>`;
        div.onclick = () => {
            selectedBook = b;
            document.getElementById("title").value = b.title;
        };
        area.appendChild(div);
    });
}

document.getElementById("search").onclick = searchBook;

/* =========================
   読了登録
========================= */
document.getElementById("add").onclick = async () => {
    const title = document.getElementById("title").value;
    const media = document.querySelector("input[name=media]:checked").value;
    const rating = document.getElementById("rating").value;
    const comment = document.getElementById("comment").value;

    if (editingId) {
        const log = data.logs.find(l => l.id === editingId);
        if (!log) return;

        log.title = title;
        log.media = media;
        log.image = selectedBook?.image || log.image;

        const dateInput = document.getElementById("finishedDate").value;
        if (dateInput) {
            const d = new Date(dateInput);
            log.finishedAt = d.toISOString();
            selectedYear = d.getFullYear();
            currentMonth = d.getMonth();
            log.rating = rating ? Number(rating) : null;
            log.comment = comment || "";
        }
        editingId = null;
    } else {
        const dateInput = document.getElementById("finishedDate").value;
        const d = dateInput ? new Date(dateInput) : new Date();

        data.logs.push({
            id: Date.now(),
            title,
            image: selectedBook?.image || "",
            media,
            finishedAt: d.toISOString(),
            rating: rating ? Number(rating) : null,
            comment: comment || ""
        });

        selectedYear = d.getFullYear();
        currentMonth = d.getMonth();
    }

    document.getElementById("finishedDate").value = "";
    document.getElementById("title").value = "";
    document.getElementById("preview").innerHTML = "";
    document.getElementById("rating").value = "";
    document.getElementById("comment").value = "";
    selectedBook = null;

    await saveAll();
    update();
};

/* =========================
   月移動
========================= */
document.getElementById("yearSelect").onchange = e => {
    selectedYear = Number(e.target.value);
    update();
};

document.getElementById("prevMonth").onclick = () => {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        selectedYear--;
    }
    renderYearSelect();
    update();
};

document.getElementById("nextMonth").onclick = () => {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        selectedYear++;
    }
    renderYearSelect();
    update();
};

/* =========================
   認証
========================= */
document.getElementById("loginBtn").onclick = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
};

document.getElementById("logoutBtn").onclick = () => {
    signOut(auth);
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById("loginBtn").style.display = "none";
        document.getElementById("logoutBtn").style.display = "inline";

        await loadRemote();
    } else {
        currentUser = null;
        document.getElementById("loginBtn").style.display = "inline";
        document.getElementById("logoutBtn").style.display = "none";

        loadLocal();
    }
    renderYearSelect();
    update();
});
