// Tips
function toggleTips() {
  const tipsContent = document.getElementById('tipsContent');
  tipsContent.classList.toggle('show');
}

// 読み込み
window.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("container");
  const fileInput = document.getElementById("fileInput");

  // ファイル選択
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      readFile(file);
    }
  });

  // すでにある data.txt 読む
  function loadDefaultData() {
    if (location.protocol === "file:") {
      // ローカル実行向け
      container.innerHTML = '<div class="empty-message">ローカルでは自動読み込みできません。📁 ファイルを選択してください。</div>';
    }
    else {
      // ほか向け fetch
      fetch("data.txt")
        .then(res => {
          if (!res.ok) throw new Error(`データファイルが見つかりません (${res.status})`);
          return res.text();
        })
        .then(text => {
          if (text.trim()) {
            renderGroups(parseSchedule(text));
          } else {
            container.innerHTML = '<div class="empty-message">📅 予定なし</div>';
          }
        })
        .catch(err => {
          //console.warn("data.txt loading failed:", err.message);
          container.innerHTML = '<div class="empty-message">📅 ファイルが見つかりません。ファイルを選択してください。</div>';
        });
    }
  }
  loadDefaultData();

  // ローカルファイル読み取り
  function readFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        renderGroups(parseSchedule(reader.result));
      } catch (error) {
        //console.error('File parsing error:', error);
        container.innerHTML = '<div class="empty-message">❌ ファイル読み込みに失敗しました。形式を確認してください。</div>';
      }
    };
    reader.onerror = () => {
      container.innerHTML = '<div class="empty-message">❌ ファイル読み込みエラーが発生しました。</div>';
    };
    reader.readAsText(file);
  }

  // テキストを構造化
  function parseSchedule(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    const groups = {};
    let currentGroup = "グループ未設定";

    for (let line of lines) {
      if (line.startsWith("-")) {
        currentGroup = line.slice(1).trim() || "グループ未設定";
        groups[currentGroup] = [];
        continue;
      }

      const parts = line.split(",");
      const datetime = parts[0];
      const title = parts[1] || "";
      const details = parts[2] || "";
      const location = parts.slice(3).join(","); // 3番目以降を全部住所
      
      let rawDate, time, isAllDay = false;
      if (datetime.includes("T")) {
        [rawDate, time] = datetime.split("T");
      }
      else {
        // 時間省略対応（終日）
        rawDate = datetime;
        time = "";
        isAllDay = true;
      }
      
      if (!rawDate || !title) continue;

      // 日付正規化
      const date = normalizeDate(rawDate);
      const { start, end } = parseTimeRange(date, time, isAllDay);

      groups[currentGroup] = groups[currentGroup] || [];
      groups[currentGroup].push({
        title: title.trim(),
        start,
        end,
        details: details.replace(/\\n/g, "\n").trim(),
        location: location.trim(),
        isAllDay
      });
    }

    return groups;
  }

  // 日付文字列を YYYY-MM-DD に
  function normalizeDate(dateStr) {
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    // YYYYMMDD
    else if (/^\d{8}$/.test(dateStr)) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return `${year}-${month}-${day}`;
    }
    // YYYY-MMDD
    else if (/^\d{4}-\d{4}$/.test(dateStr)) {
      const [year, monthDay] = dateStr.split('-');
      const month = monthDay.substring(0, 2);
      const day = monthDay.substring(2, 4);
      return `${year}-${month}-${day}`;
    }
    // YYYYMM-DD
    else if (/^\d{6}-\d{2}$/.test(dateStr)) {
      const [yearMonth, day] = dateStr.split('-');
      const year = yearMonth.substring(0, 4);
      const month = yearMonth.substring(4, 6);
      return `${year}-${month}-${day}`;
    }
    // MMDD (今年を取得)
    else if (/^\d{4}$/.test(dateStr)) {
      const currentYear = new Date().getFullYear();
      const month = dateStr.substring(0, 2);
      const day = dateStr.substring(2, 4);
      return `${currentYear}-${month}-${day}`;
    }
    return dateStr;
  }

  // 終了時間
  function parseTimeRange(date, rawTime, isAllDay) {
    if (isAllDay) {
      return { start: `${date}T00:00`, end: `${date}T23:59` };
    }

    const [startStr, endStr] = rawTime.split("-");
    const pad = (s) => s.padStart(4, "0");

    const formatTime = (t) => {
      const h = t.slice(0, 2);
      const m = t.slice(2);
      return `${date}T${h}:${m}`;
    };

    const start = formatTime(pad(startStr));
    let end;
    
    if (endStr) {
      end = formatTime(pad(endStr));
    }
    else {
      // 終了時間がない場合は1時間後（時をまたぐ場合も考慮）
      const startHour = parseInt(startStr.slice(0, 2));
      const startMinute = startStr.slice(2);
      const endHour = (startHour + 1) % 24; // 24時間制で循環
      const endHourPadded = endHour.toString().padStart(2, "0");
      end = `${date}T${endHourPadded}:${startMinute}`;
    }

    return { start, end };
  }

  // HTML 表示用の日付
  function getTimeStr(start, end, isAllDay) {
    const [date, startTime] = start.split("T");
    
    // 既に正規化された日付
    const normalizedDate = date;
    
    // 終日の場合は日付のみ
    if (isAllDay) {
      return normalizedDate;
    }
    
    const [, endTime] = end.split("T");
    
    // 終了時間がない場合は「-」で終わるようにしたかったけど勝手に設定されるからないか
    if (startTime === endTime) {
      return `${normalizedDate} ${startTime}-`;
    }
    
    // 通常の YYYY-MM-DD HH-MM
    return `${normalizedDate} ${startTime}-${endTime}`;
  }

  // (1) Googleカレンダー
  // 日付
  function toGoogleTime(datetime) {
    return datetime.replace(/[-:]/g, "") + "00";
  }

  // 登録URL
  function buildGoogleCalLink(event) {
    const detailsText = formatDetailsForGoogle(event.details || "");
    
    // 終日イベント用の日付 YYYYMMDD (終了日は翌日)
    if (event.isAllDay) {
      const startDate = event.start.split('T')[0].replace(/-/g, '');
      const nextDay = new Date(event.start.split('T')[0]);
      nextDay.setDate(nextDay.getDate() + 1);
      const endDate = nextDay.toISOString().split('T')[0].replace(/-/g, '');
      
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startDate}/${endDate}&details=${detailsText}&location=${encodeURIComponent(event.location || "")}`;
    }
    else {
      // 時間指定ありの日付 YYYYMMDDTHHMMSSZ
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${toGoogleTime(event.start)}/${toGoogleTime(event.end)}&details=${detailsText}&location=${encodeURIComponent(event.location || "")}`;
    }
  }

  // 詳細テキスト
  function formatDetailsForGoogle(text) {
    return encodeURIComponent(text.replace(/\\n/g, "\n"));
  }

  // (2)(3) Todoist アプリ / Web
  // 日付 だめだったら today
  function formatDateForTodoist(datetime) {
    const datePart = datetime.split('T')[0]; // YYYY-MM-DD
    
    // YYYY-MM-DD か
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return 'today';
    }
    
    const [year, month, day] = datePart.split('-').map(Number);
    const eventDate = new Date(year, month - 1, day);
    
    if (isNaN(eventDate.getTime())) {
      return 'today';
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (eventDate.getTime() === today.getTime()) {
      return 'today';
    } else if (eventDate.getTime() === today.getTime() + 24 * 60 * 60 * 1000) {
      return 'tomorrow';
    } else {
      return datePart;
    }
  }

  // 時間 HH:MM
  function getTimeOnly(datetime) {
    return datetime.split('T')[1];
  }

  // content
  function buildTodoistContent(event) {
    let content = event.title;
    
    // [1] 終了時間
    if (!event.isAllDay && event.end) {
      const startTime = getTimeOnly(event.start);
      const endTime = getTimeOnly(event.end);
      if (startTime !== endTime) {
        content += `\n\n終了時間/${endTime}`;
      }
    }
    
    // [2] 詳細
    if (event.details && event.details.trim()) {
      content += `\n\n${event.details.trim()}`;
    }
    
    // [3] @場所
    if (event.location) {
      content += `\n\n@${event.location}`;
    }
    
    // [4] 開始時間 (date で時間指定ができないため自然言語で)
    if (!event.isAllDay) {
      content += `\n\n${getTimeOnly(event.start)}`;
    }
    
    return content;
  }

  // アプリ用URL
  function buildTodoistMobileLink(event) {
    const content = buildTodoistContent(event);
    const dateStr = formatDateForTodoist(event.start);
    
    const encodedContent = encodeURIComponent(content);
    const encodedDate = encodeURIComponent(dateStr);
    
    return `todoist://addtask?content=${encodedContent}&date=${encodedDate}`;
  }

  // Web用URL (priority, projectも指定可能らしい)
  function buildTodoistWebLink(event) {
    const content = buildTodoistContent(event);
    const dateStr = formatDateForTodoist(event.start);
    
    const encodedContent = encodeURIComponent(content);
    const encodedDate = encodeURIComponent(dateStr);
    
    return `https://todoist.com/add?content=${encodedContent}&date=${encodedDate}`;
  }

  // HTML
  function renderGroups(groups) {
    container.innerHTML = "";

    // グループが空
    if (Object.keys(groups).length === 0) {
      container.innerHTML = '<div class="empty-message">📅 予定なし</div>';
      return;
    }

    for (const [groupName, events] of Object.entries(groups)) {
      // イベントがない...
      if (!events || events.length === 0) continue;

      const groupEl = document.createElement("section");
      groupEl.className = "group";
      groupEl.innerHTML = `<h2>${escapeHtml(groupName)}</h2>`;

      for (const event of events) {
        const div = document.createElement("div");
        div.className = "event";

        const timeStr = getTimeStr(event.start, event.end, event.isAllDay);
        const detailText = event.details ? 
          `<div class="event-details">${escapeHtml(event.details)}</div>` : "";

        div.innerHTML = `
          <div class="event-title">${escapeHtml(event.title)}</div>
          <div class="event-time">${escapeHtml(timeStr)}</div>
          ${event.location ? `<div class="event-location">${escapeHtml(event.location)}</div>` : ""}
          ${detailText}
          <div class="links">
            <a href="${buildGoogleCalLink(event)}" target="_blank" rel="noopener">Google カレンダー</a>
            <a href="${buildTodoistMobileLink(event)}" rel="noopener">Todoist アプリ</a>
            <a href="${buildTodoistWebLink(event)}" target="_blank" rel="noopener">Todoist ウェブ</a>
          </div>
        `;

        groupEl.appendChild(div);
      }

      container.appendChild(groupEl);
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});