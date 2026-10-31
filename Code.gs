// 澎湖肌力動起來！健康增肌多元運動班 — 報名系統後端
// 架構跟 OCEAN POP! 海洋小勇士一樣：GitHub Pages 前台 + 這支 Apps Script（JSONP）+ Google 試算表
const SHEET_ID = "1YTbDOo6eUn2c5jBZyzrsNOMsYdl2ZSOKECYfQpgcLNU";

const SHEETS = {
  settings: "活動設定",
  registrations: "報名資料",
  faq: "Q&A"
};

const DEFAULT_SETTINGS = [
  ["活動名稱", "澎湖肌力動起來！健康增肌多元運動班", "前台主標題"],
  ["上課時間", "每週三晚上 19:30–21:00、每週日下午 14:30–16:00", "前台顯示上課時間"],
  ["報名狀態", "開放", "填「開放」才可以送出；其他文字會關閉報名"],
  ["截止公告", "感謝大家熱情報名，本期課程報名已截止！\n如有新班或空位將另行公告，請留意澎湖縣皇家樂活健康運動協會官方 LINE。\n\n⚠️ 請尚未轉帳的學員，於報名後五天內完成轉帳，以保留名額，感謝您的配合！", "報名關閉時前台會顯示這段文字，可自行修改（在格子裡按 Alt+Enter 可換行）"]
];

const FAQ_HEADERS = ["問題", "回答"];

const DEFAULT_FAQ = [
  ["上課時間是什麼時候？", "每週三晚上 19:30–21:00、每週日下午 14:30–16:00，報名時可以選擇您方便的時段喔！"],
  ["沒有運動經驗可以參加嗎？", "當然可以！課程由專業教練帶領，會依每個人的體能狀況調整強度，新手和長輩都能安心參加。"],
  ["費用怎麼繳？", "報名成功後，畫面會顯示轉帳資訊（郵局代號、戶名、帳號），依指示轉帳即可，我們會另行確認收款。"],
  ["協會會員價怎麼認定？", "只要是澎湖縣皇家樂活健康運動協會的會員，即可用會員價報名。不確定自己是不是會員，歡迎透過官方 LINE 詢問。"],
  ["可以先體驗一堂再決定嗎？", "可以！單堂課程體驗價只要 $250，歡迎先來體驗看看再報名完整課程。"],
  ["報名後可以更動或取消課程嗎？", "可以，請於該堂課開始兩週前透過官方 LINE 告知我們，以便我們安排上課人數。"],
  ["臨時不能上課，可以補課或更換日期嗎？", "依方案不同：24堂完整班每期享 2 堂補課（期限至 2026/12/31，需提前預約）；12堂精選班、6堂體驗班不補課，但可更換上課日期（須於欲更換日期至少 14 天前透過官方 LINE 申請）；澎澄 5+1 為固定課程，不提供補課及更換日期。"],
  ["還有其他問題怎麼辦？", "歡迎加入澎湖縣皇家樂活健康運動協會官方 LINE 詢問，我們會盡快回覆您！"]
];

// 增肌多元頁沒有澎澄班，Q&A 預設內容拿掉澎澄那一句
const DEFAULT_FAQ_MUSCLE = DEFAULT_FAQ.map(function (row) {
  return [row[0], row[1].replace("；澎澄 5+1 為固定課程，不提供補課及更換日期。", "。")];
});

const REGISTRATION_HEADERS = [
  "時間",
  "姓名",
  "聯絡電話",
  "身分別",
  "報名方案",
  "選擇課程",
  "應繳金額",
  "特殊狀況或備註",
  "轉帳後五碼",
  "繳費情況",
  "管理備註"
];

const PAYMENT_STATUS_OPTIONS = ["已繳費", "未繳費"];

// 舊名稱相容：前後台更新的空窗期若送來舊值，自動對應成新名稱
const IDENTITY_ALIAS = {
  "一般學員": "全民運動補助方案",
  "全民運動推廣價": "全民運動補助方案",
  "協會會員": "會員優惠價"
};

// 價目表：金額一律以後端這份為準（前台只是顯示用，避免被改參數亂填金額）
const PRICES = {
  "24堂完整班": { "全民運動補助方案": 3600, "增肌多元運動優惠方案": 3600, "會員優惠價": 3400, original: "原價 $6,000" },
  "12堂精選班": { "全民運動補助方案": 2000, "增肌多元運動優惠方案": 2000, "會員優惠價": 1900, original: "原價 $3,000" },
  "6堂體驗班": { "全民運動補助方案": 1100, "增肌多元運動優惠方案": 1100, "會員優惠價": 1050, original: "原價 $1,500" },
  "澎澄運動班（5堂+1）": { "全民運動補助方案": 1500, "會員優惠價": 1400, original: "單堂原價 $380" },
  "單堂課程體驗": { "全民運動補助方案": 250, "增肌多元運動優惠方案": 250, "會員優惠價": 250, original: "" }
};

// 同一支後端、同一張試算表，服務兩個報名頁（前台送來的 page 參數決定是哪一頁）：
//   main   = 原報名頁（不帶 page 參數）→ 原本的分頁，行為跟以前完全一樣
//   muscle = 增肌多元運動優惠方案頁（page=muscle）→ 自己的報名資料／Q&A 分頁、自己的報名狀態
const PAGES = {
  main: {
    id: "main",
    label: "原報名頁",
    registrations: SHEETS.registrations,
    faq: SHEETS.faq,
    defaultFaq: DEFAULT_FAQ,
    statusKey: "報名狀態",
    identities: ["全民運動補助方案", "會員優惠價"],
    plans: ["24堂完整班", "12堂精選班", "6堂體驗班", "澎澄運動班（5堂+1）", "單堂課程體驗"]
  },
  muscle: {
    id: "muscle",
    label: "增肌多元報名頁",
    registrations: "報名資料（增肌多元）",
    faq: "Q&A（增肌多元）",
    defaultFaq: DEFAULT_FAQ_MUSCLE,
    statusKey: "報名狀態（增肌多元頁）",
    identities: ["增肌多元運動優惠方案", "會員優惠價"],
    plans: ["24堂完整班", "12堂精選班", "6堂體驗班", "單堂課程體驗"]
  }
};

// 沒帶或帶了不認得的 page，一律當成原報名頁
function getPage_(params) {
  const key = String((params && params.page) || "").trim();
  return Object.prototype.hasOwnProperty.call(PAGES, key) ? PAGES[key] : PAGES.main;
}

// 每個方案要選幾堂課（前台 index.html 的 PLAN_COURSES 也是同一套規則）
// 「24堂完整班」「澎澄運動班」是整份課表都包含，前台會自動帶入全部日期
// ⚠️ 如果之後課表堂數有增減（改 index.html 的課程表），這裡的數字也要跟著改
const PLAN_COURSE_COUNT = {
  "24堂完整班": 24,
  "12堂精選班": 12,
  "6堂體驗班": 6,
  "澎澄運動班（5堂+1）": 5,
  "單堂課程體驗": 1
};

function doGet(e) {
  const params = e.parameter || {};
  const action = params.action || "status";
  const callback = sanitizeCallback_(params.callback);

  const page = getPage_(params);

  let result;

  try {
    setupSheets_();

    if (action === "submit") {
      result = submitRegistration_(params, page);
    } else if (action === "faq") {
      result = getFaq_(page);
    } else {
      result = getStatus_(page);
    }
  } catch (error) {
    result = {
      status: "error",
      message: error.message || "系統錯誤"
    };
  }

  return output_(result, callback);
}

// 第一次可手動執行這個，會自動建立後台工作表
function setupSheet() {
  setupSheets_();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("報名系統")
    .addItem("整理報名資料（依時間排序）", "sortRegistrations")
    .addItem("補上新欄位（例如「選擇課程」，保留既有資料）", "updateRegistrationHeaders")
    .addItem("重建報名資料表（更新欄位，僅在還沒有正式報名資料時使用）", "rebuildRegistrationSheet")
    .addToUi();
}

// 補上程式有、但試算表還沒有的欄位（例如新增的「選擇課程」）
// 會用「插入空白欄」的方式加，既有報名資料會整欄跟著移動，不會錯格
function updateRegistrationHeaders() {
  const sheet = getSs_().getSheetByName(SHEETS.registrations);
  const before = getHeaders_(sheet);

  ensureRegistrationColumns_(sheet);
  sheet.autoResizeColumns(1, REGISTRATION_HEADERS.length);

  const added = REGISTRATION_HEADERS.filter(function (h) { return before.indexOf(h) === -1; });
  const message = added.length
    ? "已新增欄位：" + added.join("、") + "（既有資料已整欄對齊，沒有錯格）"
    : "欄位已是最新，沒有需要新增的。";

  // 獨立式腳本沒有綁定試算表，toast 會失敗；用 log 當備援，訊息才不會不見
  try {
    SpreadsheetApp.getActive().toast(message, "完成", 6);
  } catch (e) {
    Logger.log(message);
  }
}

function rebuildRegistrationSheet() {
  const ss = getSs_();
  const reg = ss.getSheetByName(SHEETS.registrations);
  if (reg) ss.deleteSheet(reg);
  setupSheets_();
  SpreadsheetApp.getActive().toast("已重建「報名資料」表（套用最新欄位）。", "完成", 5);
}

// Q&A 分頁「問題」「回答」任何時候編輯，前台的 Q&A 小工具都會自動抓最新內容（不用重新部署）
function getFaq_(page) {
  const sheet = getSs_().getSheetByName((page || PAGES.main).faq);
  const values = sheet.getDataRange().getValues().slice(1);

  const items = values
    .filter(function (row) { return String(row[0] || "").trim(); })
    .map(function (row) {
      return { q: String(row[0] || "").trim(), a: String(row[1] || "").trim() };
    });

  return {
    status: "success",
    items: items
  };
}

function getSs_() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function setupSheets_() {
  const ss = getSs_();

  let settings = ss.getSheetByName(SHEETS.settings);
  if (!settings) {
    settings = ss.insertSheet(SHEETS.settings);
    settings.getRange(1, 1, DEFAULT_SETTINGS.length, 3).setValues(DEFAULT_SETTINGS);
    settings.autoResizeColumns(1, 3);
  }
  ensurePageStatusRows_(settings);

  Object.keys(PAGES).forEach(function (key) {
    const page = PAGES[key];

    let reg = ss.getSheetByName(page.registrations);
    if (!reg) {
      reg = ss.insertSheet(page.registrations);
      reg.getRange(1, 1, 1, REGISTRATION_HEADERS.length).setValues([REGISTRATION_HEADERS]);
      reg.setFrozenRows(1);
      reg.getRange(1, 1, 1, REGISTRATION_HEADERS.length).setFontWeight("bold").setBackground("#1F7A70").setFontColor("#ffffff");
      reg.autoResizeColumns(1, REGISTRATION_HEADERS.length);
      applyPaymentStatusFormatting_(reg, REGISTRATION_HEADERS.indexOf("繳費情況") + 1);
    }

    let faq = ss.getSheetByName(page.faq);
    if (!faq) {
      const rows = page.defaultFaq;
      faq = ss.insertSheet(page.faq);
      faq.getRange(1, 1, 1, FAQ_HEADERS.length).setValues([FAQ_HEADERS]);
      faq.getRange(2, 1, rows.length, FAQ_HEADERS.length).setValues(rows);
      faq.setFrozenRows(1);
      faq.getRange(1, 1, 1, FAQ_HEADERS.length).setFontWeight("bold").setBackground("#1F7A70").setFontColor("#ffffff");
      faq.setColumnWidth(1, 260);
      faq.setColumnWidth(2, 420);
      faq.getRange(2, 1, rows.length, FAQ_HEADERS.length).setWrap(true);
    }
  });
}

// 「活動設定」分頁裡，每個報名頁都有自己的一列報名狀態（原頁用「報名狀態」那列）。
// 新頁的那列不存在就自動補上，初始值抄原頁現在的狀態；之後兩頁可以各自開關。
function ensurePageStatusRows_(settings) {
  const keys = settings.getRange(1, 1, Math.max(settings.getLastRow(), 1), 2).getValues();
  const map = {};
  keys.forEach(function (row) { if (row[0]) map[row[0]] = row[1]; });

  Object.keys(PAGES).forEach(function (key) {
    const page = PAGES[key];
    if (Object.prototype.hasOwnProperty.call(map, page.statusKey)) return;
    settings.appendRow([page.statusKey, map["報名狀態"] || "開放", page.label + "的報名狀態：填「開放」才可以送出；其他文字只會關閉這一頁的報名"]);
  });
}

// 「繳費情況」下拉選單 + 未繳費整列自動變粉紅色
function applyPaymentStatusFormatting_(sheet, statusCol) {
  if (statusCol < 1) return;
  const maxRows = Math.max(sheet.getMaxRows(), 500);

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(PAYMENT_STATUS_OPTIONS, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, statusCol, maxRows - 1, 1).setDataValidation(rule);

  const colLetter = columnToLetter_(statusCol);
  const fullRange = sheet.getRange(2, 1, maxRows - 1, REGISTRATION_HEADERS.length);

  const pinkRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$' + colLetter + '2="未繳費"')
    .setBackground("#F9C9D1")
    .setRanges([fullRange])
    .build();

  sheet.setConditionalFormatRules(sheet.getConditionalFormatRules().concat([pinkRule]));
}

function columnToLetter_(column) {
  let temp;
  let letter = "";
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 2) / 26;
  }
  return letter;
}

function getSettings_(page) {
  const sheet = getSs_().getSheetByName(SHEETS.settings);
  const values = sheet.getDataRange().getValues();
  const map = {};

  values.forEach(function (row) {
    if (row[0]) map[row[0]] = row[1];
  });

  // 這一頁自己的報名狀態那列被刪掉時，退回看原頁的「報名狀態」
  const statusKey = (page || PAGES.main).statusKey;
  const status = Object.prototype.hasOwnProperty.call(map, statusKey) ? map[statusKey] : map["報名狀態"];

  return {
    activityName: map["活動名稱"] || "",
    classTime: map["上課時間"] || "",
    registrationStatus: status || "",
    closedNotice: map["截止公告"] || ""
  };
}

// 回傳 page：增肌多元頁看到自己的代號，才知道後端已經是會分頁的版本，才會開放送出
function getStatus_(page) {
  const settings = getSettings_(page);

  return {
    status: "success",
    page: (page || PAGES.main).id,
    activity: settings
  };
}

function submitRegistration_(params, page) {
  page = page || PAGES.main;
  const settings = getSettings_(page);

  if (String(settings.registrationStatus || "").trim() !== "開放") {
    return {
      status: "closed",
      message: "目前報名尚未開放或已關閉"
    };
  }

  const name = String(params.name || "").trim();
  const phone = String(params.phone || "").trim();
  let identity = String(params.identity || "").trim();
  identity = IDENTITY_ALIAS[identity] || identity; // 舊名稱自動對應成新名稱
  const plan = String(params.plan || "").trim();
  const note = String(params.note || "").trim();

  const required = {
    姓名: name,
    聯絡電話: phone,
    身分別: identity,
    報名方案: plan
  };

  for (const key in required) {
    if (!required[key]) {
      return {
        status: "error",
        message: "「" + key + "」為必填欄位"
      };
    }
  }

  if (page.identities.indexOf(identity) === -1) {
    return { status: "error", message: "身分別選項不正確" };
  }

  if (!PRICES[plan] || page.plans.indexOf(plan) === -1) {
    return { status: "error", message: "報名方案選項不正確" };
  }

  const courseResult = parseCourses_(params.courses, plan);
  if (courseResult.error) {
    return { status: "error", message: courseResult.error };
  }

  const price = PRICES[plan][identity];

  const sheet = getSs_().getSheetByName(page.registrations);
  const headers = ensureRegistrationColumns_(sheet); // 欄位缺了會自動補，資料才不會被丟掉

  // 同姓名 + 同電話 + 同方案 視為重複報名（仍會記錄，前台會提醒）
  const colName = headers.indexOf("姓名");
  const colPhone = headers.indexOf("聯絡電話");
  const colPlan = headers.indexOf("報名方案");
  const isDuplicate = sheet.getDataRange().getValues().slice(1).some(function (row) {
    return String(row[colName]).trim() === name &&
      String(row[colPhone]).trim() === phone &&
      String(row[colPlan]).trim() === plan;
  });

  appendByHeaders_(sheet, headers, {
    "時間": new Date(),
    "姓名": name,
    "聯絡電話": phone,
    "身分別": identity,
    "報名方案": plan,
    "選擇課程": courseResult.text,
    "應繳金額": price,
    "特殊狀況或備註": note,
    "轉帳後五碼": "",
    "繳費情況": "未繳費",
    "管理備註": ""
  });

  return {
    status: "success",
    duplicate: isDuplicate,
    name: name,
    price: price,
    courses: courseResult.text
  };
}

// 檢查前台送來的上課日期：堂數要對、格式要對（例：8/02）、不能重複
function parseCourses_(raw, plan) {
  // 相容處理：舊版報名頁（瀏覽器還留著舊快取）不會送這個參數，先放行不擋人報名
  if (typeof raw === "undefined") {
    return { text: "（舊版報名頁，未選課程）" };
  }

  const needed = PLAN_COURSE_COUNT[plan];
  const list = String(raw || "")
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s; });

  if (typeof needed === "number" && list.length !== needed) {
    return { error: "請選擇 " + needed + " 堂上課日期（目前收到 " + list.length + " 堂）" };
  }

  const seen = {};
  for (let i = 0; i < list.length; i++) {
    if (!/^\d{1,2}\/\d{1,2}$/.test(list[i])) {
      return { error: "上課日期格式不正確" };
    }
    if (seen[list[i]]) {
      return { error: "上課日期有重複，請重新選擇" };
    }
    seen[list[i]] = true;
  }

  return { text: list.join("、") };
}

function getHeaders_(sheet) {
  const width = Math.max(sheet.getLastColumn(), REGISTRATION_HEADERS.length);
  const headers = sheet.getRange(1, 1, 1, width).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });

  // 表頭壞掉或還沒建立時，退回用程式裡的預設欄位順序，避免資料寫錯格
  return headers.indexOf("姓名") === -1 ? REGISTRATION_HEADERS.slice() : headers;
}

// 確保試算表有程式需要的每一個欄位；缺的就自動補上。
// 沒有這道保險的話，試算表少一欄（例如忘了補「選擇課程」），
// 那一欄的資料會被無聲丟掉——學員明明選了課，後台卻看不到。
function ensureRegistrationColumns_(sheet) {
  const headers = getHeaders_(sheet);
  let changed = false;

  REGISTRATION_HEADERS.forEach(function (target, i) {
    if (headers.indexOf(target) !== -1) return; // 已經有這欄就不動

    const pos = i + 1;
    if (pos > sheet.getMaxColumns()) {
      sheet.insertColumnAfter(sheet.getMaxColumns()); // 補在最後面
    } else {
      sheet.insertColumnBefore(pos); // 插在正確位置，既有資料整欄跟著移動，不會錯格
    }
    sheet.getRange(1, pos).setValue(target);
    headers.splice(i, 0, target);
    changed = true;
  });

  if (changed) {
    sheet.getRange(1, 1, 1, REGISTRATION_HEADERS.length)
      .setFontWeight("bold").setBackground("#1F7A70").setFontColor("#ffffff");
  }

  return headers;
}

// 依「表頭名稱」對位寫入：欄位順序被調整、或舊表還缺欄位，都不會把資料寫錯格
function appendByHeaders_(sheet, headers, data) {
  const row = headers.map(function (h) {
    return Object.prototype.hasOwnProperty.call(data, h) ? data[h] : "";
  });
  sheet.appendRow(row);
}

function sortRegistrations() {
  const sheet = getSs_().getSheetByName(SHEETS.registrations);
  const lastRow = sheet.getLastRow();

  if (lastRow > 2) {
    sheet.getRange(2, 1, lastRow - 1, REGISTRATION_HEADERS.length).sort({ column: 1, ascending: true });
  }

  SpreadsheetApp.getActive().toast("已依時間排序完成。", "完成", 5);
}

function output_(result, callback) {
  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + JSON.stringify(result) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitizeCallback_(callback) {
  const text = String(callback || "").trim();

  if (/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(text)) {
    return text;
  }

  return "";
}
