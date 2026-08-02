"use strict";

const API_URL =
  "https://hook.eu1.make.com/sj21un9u53ctmonprv7yuyzuqtx7xxvc";

const element = (id) => document.getElementById(id);

const form = element("searchForm");
const companyInput = element("company");
const numberInput = element("number");
const searchButton = element("searchButton");
const message = element("message");
const resultPanel = element("resultPanel");

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function displayText(value, fallback = "-") {
  return hasValue(value) ? String(value).trim() : fallback;
}

function displayNumber(value, fallback = "-") {
  if (!hasValue(value)) return fallback;

  const number = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(number)
    ? number.toLocaleString("ko-KR")
    : displayText(value, fallback);
}

/**
 * Make의 응답 문자열 안에 실제 줄바꿈 문자가 들어가 JSON.parse가 실패하는 경우를
 * 대비해, JSON 문자열 내부의 제어문자를 안전한 이스케이프 문자로 변환합니다.
 */
function escapeControlCharactersInsideJsonStrings(rawText) {
  let output = "";
  let insideString = false;
  let escaped = false;

  for (const character of rawText) {
    if (escaped) {
      output += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      output += character;
      escaped = true;
      continue;
    }

    if (character === '"') {
      output += character;
      insideString = !insideString;
      continue;
    }

    if (insideString && character === "\n") {
      output += "\\n";
      continue;
    }

    if (insideString && character === "\r") {
      output += "\\r";
      continue;
    }

    if (insideString && character === "\t") {
      output += "\\t";
      continue;
    }

    output += character;
  }

  return output;
}

async function readJsonResponse(response) {
  const rawText = await response.text();

  try {
    return JSON.parse(rawText);
  } catch (firstError) {
    try {
      return JSON.parse(escapeControlCharactersInsideJsonStrings(rawText));
    } catch {
      console.error("Make 원본 응답:", rawText);
      throw firstError;
    }
  }
}

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function renderDocument(containerId, url) {
  const container = element(containerId);
  container.replaceChildren();

  if (!hasValue(url)) {
    const empty = document.createElement("span");
    empty.className = "document-empty";
    empty.textContent = "미발행";
    container.appendChild(empty);
    return;
  }

  const link = document.createElement("a");
  link.className = "document-link";
  link.href = String(url).trim();
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "PDF 열기";
  container.appendChild(link);
}


const PAYMENT_MONTHS = [
  ["08", "8월"],
  ["09", "9월"],
  ["10", "10월"],
  ["11", "11월"],
  ["12", "12월"],
  ["01", "1월"],
  ["02", "2월"],
  ["03", "3월"],
  ["04", "4월"],
  ["05", "5월"],
  ["06", "6월"],
  ["07", "7월"],
];

function normalizeAmount(value) {
  if (!hasValue(value)) return 0;
  const normalized = String(value).replaceAll(",", "").replace(/[^\d.-]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function renderPayments(payments = {}) {
  const grid = element("paymentsGrid");
  const summary = element("paymentSummary");
  grid.replaceChildren();

  let paidMonthCount = 0;
  let totalPaid = 0;

  for (const [key, label] of PAYMENT_MONTHS) {
    const amount = normalizeAmount(payments?.[key]);
    const paid = amount > 0;

    if (paid) {
      paidMonthCount += 1;
      totalPaid += amount;
    }

    const card = document.createElement("article");
    card.className = `payment-card ${paid ? "paid" : "unpaid"}`;

    const month = document.createElement("span");
    month.className = "payment-month";
    month.textContent = label;

    const amountText = document.createElement("strong");
    amountText.className = "payment-amount";

    if (paid) {
      const check = document.createElement("span");
      check.className = "payment-check";
      check.textContent = "✔";
      amountText.append(check, ` ${amount.toLocaleString("ko-KR")}원`);
    } else {
      amountText.textContent = "0원";
    }

    card.append(month, amountText);
    grid.appendChild(card);
  }

  summary.textContent =
    paidMonthCount > 0
      ? `${paidMonthCount}개월 · 총 ${totalPaid.toLocaleString("ko-KR")}원`
      : "입금내역 없음";

  return { paidMonthCount, totalPaid };
}

function renderResult(data) {
  const issuedAt = displayText(
    data.certificate_issued_at,
    "보험증권 발행안함"
  );

  element("apartmentName").textContent = displayText(
    data.apartment,
    "단지명 없음"
  );

  element("recordKey").textContent =
    `${displayText(data.company)} · 관리번호 ${displayText(data.number)}`;

  element("insurancePeriod").textContent = displayText(data.insurance_period);
  element("certificateIssuedAt").textContent = issuedAt;

  element("monthlyPremium").textContent = hasValue(data.monthly_premium)
    ? `${displayNumber(data.monthly_premium)}원`
    : "-";

  element("employeeCounts").textContent =
    `관리소장 ${displayNumber(data.manager_count, "0")}명 · ` +
    `회계과장급 ${displayNumber(data.accounting_count, "0")}명 · ` +
    `기술직 ${displayNumber(data.technical_count, "0")}명`;

  element("managerNames").textContent = displayText(data.manager_names);
  element("insuredMembers").textContent = displayText(data.insured_members);

  const paymentInfo = renderPayments(data.payments || {});

  const issueStatus = element("issueStatus");
  if (hasValue(data.insurance_certificate_pdf) || hasValue(data.certificate_issued_at)) {
    issueStatus.textContent = "보험증권 발행완료";
    issueStatus.className = "issue-status issued";
  } else if (paymentInfo.paidMonthCount > 0) {
    issueStatus.textContent = "보험증권 발행대상";
    issueStatus.className = "issue-status eligible";
  } else {
    issueStatus.textContent = "납부내역 없음";
    issueStatus.className = "issue-status not-issued";
  }

  renderDocument(
    "insuranceCertificatePdf",
    data.insurance_certificate_pdf
  );
  renderDocument("paymentNoticePdf", data.payment_notice_pdf);
  renderDocument(
    "guaranteeCertificatePdf",
    data.guarantee_certificate_pdf
  );

  resultPanel.classList.remove("hidden");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const company = companyInput.value.trim();
  const number = numberInput.value.trim();

  if (!company || !number) {
    setMessage("위탁사명과 관리번호를 모두 입력해주세요.", "error");
    return;
  }

  searchButton.disabled = true;
  searchButton.textContent = "조회 중";
  resultPanel.classList.add("hidden");
  setMessage("Airtable에서 정보를 조회하고 있습니다.");

  try {
    const requestUrl = new URL(API_URL);
    requestUrl.searchParams.set("company", company);
    requestUrl.searchParams.set("number", number);

    const response = await fetch(requestUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await readJsonResponse(response);

    if (!response.ok || data.success !== true) {
      throw new Error(data.message || "등록되지 않은 단지입니다.");
    }

    renderResult(data);
    setMessage("조회가 완료되었습니다.", "success");
  } catch (error) {
    console.error(error);
    setMessage(
      error instanceof Error
        ? error.message
        : "조회 중 알 수 없는 오류가 발생했습니다.",
      "error"
    );
  } finally {
    searchButton.disabled = false;
    searchButton.textContent = "조회";
  }
});

companyInput.focus();
