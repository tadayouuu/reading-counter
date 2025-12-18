const GOAL = 50;
const year = new Date().getFullYear();
document.getElementById("year").textContent = `${year}年 読書カウンター`;

let data = { logs: [] };
let selectedBook = null;
let editingId = null;
let selectedYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();

const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;

function load() {
    const saved = localStorage.getItem("readingLogs");
    if (saved) data = JSON.parse(saved);
}
function save() {
    localStorage.setItem("readingLogs", JSON.stringify(data));
}

function update() {
    // let logs = data.logs.filter(
    //     l => new Date(l.finishedAt).getFullYear() === selectedYear
    // );
    // let logs = data.logs.filter(l => {
    //     const d = new Date(l.finishedAt);
    //     return (
    //         d.getFullYear() === selectedYear &&
    //         d.getMonth() === currentMonth
    //     );
    // });

    // if (selectedDay) {
    //     logs = logs.filter(l =>
    //         new Date(l.finishedAt).getMonth() === currentMonth &&
    //         new Date(l.finishedAt).getDate() === selectedDay
    //     );
    // }

    const yearLogs = data.logs.filter(l => {
        const d = new Date(l.finishedAt);
        return d.getFullYear() === selectedYear;
    });

    const monthLogs = yearLogs.filter(l => {
        const d = new Date(l.finishedAt);
        return d.getMonth() === currentMonth;
    });

    document.getElementById("count").textContent = yearLogs.length;
    document.getElementById("progress").style.width =
        Math.min((yearLogs.length / GOAL) * 100, 100) + "%";

    renderList(monthLogs);
    renderCalendar(selectedYear, currentMonth);
}

function renderYearSelect() {
    const select = document.getElementById("yearSelect");
    select.innerHTML = "";

    // logs に入っとる年を全部集める
    const years = [...new Set(
        data.logs.map(l => new Date(l.finishedAt).getFullYear())
    )];

    const current = new Date().getFullYear();
    if (!years.includes(current)) {
        years.push(current);
    }

    years.sort().forEach(y => {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = `${y}年`;
        select.appendChild(opt);
    });

    select.value = selectedYear;
}

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

    // 日ごとの冊数をまとめる
    const map = {};
    logs.forEach(l => {
        const day = new Date(l.finishedAt).getDate();
        map[day] = (map[day] || 0) + 1;
    });

    // 月初の曜日と日数
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 空白（前月分）
    for (let i = 0; i < firstDay; i++) {
        calendar.appendChild(document.createElement("div"));
    }

    // 日付マス
    for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement("div");
        cell.className = "day";
        cell.textContent = d;

        // 今日ハイライト
        const today = new Date();
        if (
            d === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear()
        ) {
            cell.style.background = "#e3f2fd";
        }

        // 読了マーク
        if (map[d]) {
            cell.innerHTML += "<br>" + "📘".repeat(map[d]);
        }

        calendar.appendChild(cell);
    }
    updateMonthLabel();
}

function renderList(logs) {
    const ul = document.getElementById("bookList");
    ul.innerHTML = "";

    logs.slice().reverse().forEach(l => {
        const li = document.createElement("li");

        li.innerHTML = `
            <img src="${l.image || ""}">
            <div>
                <strong>${l.title || "（無題）"}</strong><br>
                <small>${l.media}</small>
                <button onclick="editLog(${l.id})">編集</button>
                <button onclick="deleteLog(${l.id})">削除</button>
            </div>
        `;
        ul.appendChild(li);
    });
}

function editLog(id) {
    const log = data.logs.find(l => l.id === id);
    if (!log) return;

    document.getElementById("title").value = log.title;
    document.querySelector(
        `input[name=media][value="${log.media}"]`
    ).checked = true;

    selectedBook = { image: log.image };
    editingId = id;

    const d = new Date(log.finishedAt);
    document.getElementById("finishedDate").value = d.toISOString().slice(0, 10);
}

function deleteLog(id) {
    if (!confirm("この記録、消してええ？")) return;

    data.logs = data.logs.filter(l => l.id !== id);
    save();
    update();
}

function updateMonthLabel() {
    const label = document.getElementById("monthLabel");

    const monthCount = data.logs.filter(l => {
        const d = new Date(l.finishedAt);
        return (
            d.getFullYear() === selectedYear &&
            d.getMonth() === currentMonth
        );
    }).length;

    label.textContent =
        `${selectedYear}年 ${currentMonth + 1}月（${monthCount}冊）`;
}

// 楽天検索
async function searchBook() {
    console.log("searchBook called");
    const title = document.getElementById("title").value;
    console.log("title:", title);
    if (!title) return;

    const res = await fetch(
        "https://reading-counter-api.kusu-dtc.workers.dev?title=" +
        encodeURIComponent(title)
    );
    console.log("response:", res);
    const books = await res.json();
    console.log("books:", books);

    const area = document.getElementById("preview");
    area.innerHTML = "";

    books.forEach(b => {
        const div = document.createElement("div");
        div.className = "previewItem";
        div.innerHTML = `
      <img src="${b.image}">
      <small>${b.title}</small>
    `;
        div.onclick = () => {
            selectedBook = b;
            document.getElementById("title").value = b.title;
        };
        area.appendChild(div);
    });
}

document.getElementById("search").onclick = searchBook;

// 読了登録
document.getElementById("add").onclick = () => {
    const title = document.getElementById("title").value;
    const media = document.querySelector("input[name=media]:checked").value;

    if (editingId) {
        // Update
        const log = data.logs.find(l => l.id === editingId);
        if (!log) return;

        log.title = title;
        log.media = media;
        log.image = selectedBook?.image || log.image;

        const dateInput = document.getElementById("finishedDate").value;
        if (dateInput) {
            // log.finishedAt = new Date(dateInput).toISOString();
            const d = new Date(dateInput);
            log.finishedAt = d.toISOString();
            selectedYear = d.getFullYear();
            currentMonth = d.getMonth();
        }

        editingId = null;
    } else {
        // Create
        data.logs.push({
            id: Date.now(),
            title,
            image: selectedBook?.image || "",
            media,
            finishedAt: new Date().toISOString()
        });
    }

    document.getElementById("finishedDate").value = "";
    selectedBook = null;
    document.getElementById("title").value = "";
    document.getElementById("preview").innerHTML = "";

    save();
    update();
};

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

document.getElementById("loginBtn").onclick = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
};

document.getElementById("logoutBtn").onclick = () => {
    auth.signOut();
};

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById("loginBtn").style.display = "none";
        document.getElementById("logoutBtn").style.display = "inline";

        loadFromFirestore();
    } else {
        currentUser = null;
        document.getElementById("loginBtn").style.display = "inline";
        document.getElementById("logoutBtn").style.display = "none";

        data = { logs: [] };
        update();
    }
});

async function save() {
    if (!currentUser) return;
    await db.collection("users")
        .doc(currentUser.uid)
        .set(data);
}

async function loadFromFirestore() {
    const doc = await db.collection("users")
        .doc(currentUser.uid)
        .get();

    if (doc.exists) {
        data = doc.data();
    } else {
        data = { logs: [] };
    }
    update();
}

load();
renderYearSelect();
update();
