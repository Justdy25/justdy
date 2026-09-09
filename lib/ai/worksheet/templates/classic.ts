import type { WorksheetDocument } from "../schema";
import type { WorksheetRenderOptions } from "../renderer-types";
import {
  DEFAULT_WORKSHEET_DESIGN,
  type WorksheetDesign,
} from "../worksheet-design";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderQuestion(question: WorksheetDocument["questions"][number]) {
  const questionText = escapeHtml(question.question);
  let body = "";

  if (question.type === "multiple_choice" && question.options) {
    body = `
      <div class="worksheet-options">
        ${question.options
          .map(
            (option, index) => `
          <div class="worksheet-option">
            <span class="worksheet-option-circle">${String.fromCharCode(65 + index)}</span>
            <span class="worksheet-option-text">${escapeHtml(option.text)}</span>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  if (question.type === "true_false") {
    body = `
      <div class="worksheet-true-false">
        <span class="worksheet-tf-option"><span class="worksheet-tf-circle"></span>True</span>
        <span class="worksheet-tf-option"><span class="worksheet-tf-circle"></span>False</span>
      </div>
    `;
  }

  if (question.type === "short_answer" || question.type === "fill_in_blank") {
    body = `
      <div class="worksheet-answer-lines">
        <div></div><div></div>
      </div>
    `;
  }

  if (question.type === "open_response") {
    body = `
      <div class="worksheet-response-lines">
        <div></div><div></div><div></div><div></div><div></div><div></div>
      </div>
    `;
  }

  if (question.type === "matching") {
    body = `
      <div class="worksheet-matching-lines">
        <div></div><div></div><div></div>
      </div>
    `;
  }

  return `
    <section class="worksheet-question">
      <div class="worksheet-question-text">
        <span class="worksheet-question-number">${question.number}.</span>
        <span class="worksheet-question-content">${questionText}</span>
      </div>
      ${body}
    </section>
  `;
}

function safeColor(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function designCss(design: WorksheetDesign): string {
  const accent = safeColor(
    design.accentColor,
    DEFAULT_WORKSHEET_DESIGN.accentColor,
  );
  const border = safeColor(
    design.borderColor,
    DEFAULT_WORKSHEET_DESIGN.borderColor,
  );

  const density = {
    compact: { question: "7px", padding: "5px" },
    comfortable: { question: "13px", padding: "9px" },
    spacious: { question: "19px", padding: "13px" },
  }[design.density];

  const answer = {
    small: { answer: "15px", response: "18px" },
    medium: { answer: "20px", response: "22px" },
    large: { answer: "29px", response: "32px" },
  }[design.answerSpace];

  const templateRules = {
    classic: `
      .worksheet-document{background:#fff}
      .worksheet-question{background:#fff;border-bottom:1px solid ${border}}
      .worksheet-question-number{color:${accent}}
      .worksheet-title-box{background:#fff}
    `,
    modern: `
      .worksheet-print-frame{border-width:1px;border-radius:18px}
      .worksheet-document{background:#fff}
      .worksheet-title-box{width:94%;border:0!important;border-radius:18px!important;background:#f8fafc;box-shadow:0 0 0 1px ${border} inset!important;padding:17px 22px!important}
      .worksheet-title{font-size:22px;letter-spacing:.1px}
      .worksheet-subject{font-size:9px;letter-spacing:1.6px}
      .worksheet-student-info{gap:18px;margin-bottom:15px}
      .worksheet-directions{background:#f8fafc;border:0;border-left:4px solid ${accent};border-radius:10px;padding:10px 13px}
      .worksheet-question{background:#f8fafc;border:1px solid ${border};border-radius:12px;padding:11px 13px;margin-bottom:11px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
      .worksheet-question-number{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;border-radius:7px;background:${accent};color:#fff!important;font-size:9px}
      .worksheet-options{margin-left:30px;margin-bottom:2px}
      .worksheet-option-circle{border-radius:7px;background:#fff}
    `,
    playful: `
      .worksheet-print-frame{border:2px dashed ${border};border-radius:20px}
      .worksheet-document{background:#fffdf8}
      .worksheet-title-box{width:92%;border:3px solid ${accent}!important;border-radius:20px!important;background:#fff;padding:15px 20px!important;box-shadow:4px 4px 0 ${accent}33!important}
      .worksheet-title-box::before{border:0!important}
      .worksheet-title{font-size:22px;letter-spacing:.4px}
      .worksheet-title:after{content:" ✦";color:${accent}}
      .worksheet-directions{background:#fff;border:1px solid ${border};border-left:5px solid ${accent};border-radius:12px}
      .worksheet-question{background:#fff;border:1px solid ${border};border-radius:14px;padding:10px 12px;margin-bottom:10px;box-shadow:2px 2px 0 ${border}88}
      .worksheet-question-number{display:inline-flex;align-items:center;justify-content:center;min-width:25px;height:25px;border-radius:50%;background:${accent};color:#fff!important;font-size:9px}
      .worksheet-options{margin-left:30px}
      .worksheet-option-circle{border-width:2px;background:#fff}
      .worksheet-document::after{content:"✦  •  ✦  •  ✦";display:block;text-align:center;color:${accent};font-size:10px;letter-spacing:5px;margin-top:12px}
    `,
    assessment: `
      .worksheet-print-frame{border:1px solid #222;border-radius:2px}
      .worksheet-title-box{width:100%;border:2px solid #222!important;border-radius:3px!important;padding:10px 14px!important;margin-bottom:14px}
      .worksheet-title{font-size:19px;letter-spacing:.8px}
      .worksheet-subject{color:#222!important;font-size:8.5px;letter-spacing:1.8px}
      .worksheet-student-info{border:1px solid #999;padding:7px 8px;margin-bottom:13px;gap:20px}
      .worksheet-directions{border:1px solid #777;border-radius:2px;background:#fafafa;padding:8px 10px}
      .worksheet-question{border-bottom:1px solid #999;padding-bottom:9px;margin-bottom:10px;background:#fff}
      .worksheet-question-number{font-weight:900;color:#111!important}
      .worksheet-question-text{font-size:10.5px}
      .worksheet-option-circle{border:1px solid #222}
      .worksheet-print-footer{border-top-color:#999}
    `,
  }[design.template];

  const titleRules = {
    boxed: `.worksheet-title-box{border-color:${accent}!important;border-radius:var(--title-radius)!important;box-shadow:0 2px 0 ${accent}22!important}.worksheet-title-box::before{border-color:${accent}66!important}`,
    underline: `.worksheet-title-box{width:100%!important;border:0!important;border-bottom:3px solid ${accent}!important;border-radius:0!important;padding:8px 10px 10px!important;box-shadow:none!important}.worksheet-title-box::before{display:none!important}`,
    plain: `.worksheet-title-box{width:100%!important;border:0!important;border-radius:0!important;padding:5px 0 10px!important;box-shadow:none!important}.worksheet-title-box::before{display:none!important}`,
  }[design.titleStyle];

  const columns =
    design.questionLayout === "two-column"
      ? `.worksheet-document main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:18px;align-items:start}.worksheet-document main .worksheet-question{break-inside:avoid}`
      : `.worksheet-document main{display:block}`;

  const header =
    design.headerFields === "name-date"
      ? `.worksheet-student-info .student-field:nth-of-type(3){display:none}`
      : "";

  const decorationRules =
    design.decorations === "minimal"
      ? `.worksheet-document::before{content:"";position:absolute;top:.18in;left:.18in;right:.18in;height:3px;background:${accent};border-radius:99px;opacity:.7}`
      : design.decorations === "playful"
        ? `.worksheet-document::before{content:"✦  •  ✦";position:absolute;top:.16in;left:0;right:0;text-align:center;color:${accent};font-size:12px;letter-spacing:7px;font-weight:800}`
        : "";

  return `
    :root{--design-accent:${accent};--design-border:${border};--density-question:${density.question};--density-padding:${density.padding};--answer-space:${answer.answer};--response-space:${answer.response};--title-radius:9px}
    ${templateRules}
    ${titleRules}
    ${columns}
    ${header}
    ${decorationRules}

    .worksheet-print-frame{border-color:var(--design-border)}
    .worksheet-print-grade{color:var(--design-accent)}
    .worksheet-print-footer{border-top-color:var(--design-border)}
    .worksheet-subject{color:var(--design-accent)}
    .worksheet-directions{border-color:var(--design-border);border-left-color:var(--design-accent)}
    .worksheet-question{margin-bottom:var(--density-question);padding-bottom:var(--density-padding)}
    .worksheet-question-text{color:#171717}
    .worksheet-option-circle,.worksheet-tf-circle{border-color:var(--design-accent)}
    .worksheet-option-circle{color:var(--design-accent)}
    .worksheet-answer-lines div{height:var(--answer-space);border-bottom-color:var(--design-border)}
    .worksheet-response-lines div,.worksheet-matching-lines div{height:var(--response-space);border-bottom-color:var(--design-border)}
    .worksheet-question,.worksheet-options,.worksheet-true-false,.worksheet-answer-lines,.worksheet-response-lines,.worksheet-matching-lines{break-inside:avoid;page-break-inside:avoid}
    @media print{.worksheet-document main{grid-template-columns:${design.questionLayout === "two-column" ? "repeat(2,minmax(0,1fr))" : "1fr"}}}
  `;
}

export function renderClassicWorksheet(
  worksheet: WorksheetDocument,
  options: WorksheetRenderOptions,
): string {
  const design = options.design ?? DEFAULT_WORKSHEET_DESIGN;
  const showNameField =
    design.headerFields === "all" ||
    design.headerFields === "name-date" ||
    design.headerFields === "name-date-score"
      ? options.showNameField
      : false;
  const showDateField =
    design.headerFields === "all" ||
    design.headerFields === "name-date" ||
    design.headerFields === "name-date-score"
      ? options.showDateField
      : false;
  const showScoreField =
    design.headerFields === "all" || design.headerFields === "name-date-score"
      ? options.showScoreField
      : false;
  const hasExplicitPages = Boolean(options.questionPages?.length);
  const questionPages = hasExplicitPages
    ? options.questionPages!
    : [worksheet.questions];

  /*
   * STUDENT INFORMATION FIELDS
   */
  const studentFields = `
    ${
      showNameField
        ? `
          <div class="student-field name-field">

            <strong>Name:</strong>

            <span class="field-line"></span>

          </div>
        `
        : ""
    }

    ${
      showDateField
        ? `
          <div class="student-field">

            <strong>Date:</strong>

            <span class="field-line small"></span>

          </div>
        `
        : ""
    }

    ${
      showScoreField
        ? `
          <div class="student-field">

            <strong>Score:</strong>

            <span class="field-line small"></span>

          </div>
        `
        : ""
    }
  `;

  /*
   * FOOTER BRANDING
   *
   * IMPORTANT:
   * This is intentionally ONLY in the footer.
   * It is NOT displayed in the top-left header.
   */
  const branding = options.showBranding
    ? `
        <span>
          Justdy Learning
          ${
            worksheet.gradeLevel ? ` • ${escapeHtml(worksheet.gradeLevel)}` : ""
          }
        </span>
      `
    : "";

  return `
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8" />

<title>
${escapeHtml(worksheet.title)}
</title>

<style>

/* =========================================================
   PAGE
========================================================= */

@page {
  size: Letter;
  margin: 0;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background: #ffffff;
}

body {
  font-family:
    Arial,
    Helvetica,
    sans-serif;

  color: #171717;

  font-size: 10.5pt;

  line-height: 1.4;

  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}


/* =========================================================
   WORKSHEET PAGE FRAME
========================================================= */

.worksheet-print-frame {
  position: fixed;

  inset: 0.25in;

  border:
    1.6px solid #1d1d1d;

  border-radius: 10px;

  pointer-events: none;

  z-index: 100;
}


/* =========================================================
   WORKSHEET TOP HEADER
========================================================= */

/*
 * IMPORTANT:
 *
 * There is intentionally NO company name here.
 *
 * Only the grade appears in the top-right corner.
 */

.worksheet-print-header {
  position: fixed;

  top: 0.38in;

  left: 0.62in;

  right: 0.62in;

  height: 0.22in;

  display: flex;

  align-items: center;

  justify-content: flex-end;

  z-index: 101;
}

.worksheet-print-grade {
  font-size: 9.5px;

  font-weight: 800;

  letter-spacing: 0.4px;

  text-transform: uppercase;
}


/* =========================================================
   WORKSHEET FOOTER
========================================================= */

.worksheet-print-footer {
  position: fixed;

  left: 0.62in;

  right: 0.62in;

  bottom: 0.31in;

  height: 0.2in;

  display: flex;

  align-items: center;

  justify-content: space-between;

  border-top:
    1px solid #d9d9d9;

  padding-top: 5px;

  font-size: 8px;

  color: #555;

  z-index: 101;
}

.worksheet-footer-brand {
  font-weight: 700;
}

.worksheet-footer-page {
  font-size: 8px;

  color: #555;
}


/* =========================================================
   DOCUMENT CONTENT
========================================================= */

.worksheet-document {
  width: 8.5in;

  padding:
    0.63in
    0.62in
    0.62in;

  position: relative;
}


/* =========================================================
   EXPLICIT PRINT PAGES
========================================================= */

.worksheet-page {
  width: 8.5in;
  height: 11in;
  min-height: 11in;
  break-after: page;
  page-break-after: always;
  overflow: visible;
}

.worksheet-page:last-child {
  break-after: auto;
  page-break-after: auto;
}

.worksheet-continuation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 14px;
  padding: 0 0 7px;
  border-bottom: 1px solid var(--design-border, #d9d9d9);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: .8px;
}

.worksheet-continuation-header span {
  color: var(--design-accent, #334155);
  font-weight: 700;
}


/* =========================================================
   TITLE
========================================================= */

.worksheet-title-box {
  width: 90%;

  margin:
    0 auto
    17px;

  padding:
    13px
    18px;

  border:
    2px solid #222;

  border-radius: 9px;

  text-align: center;

  position: relative;
}

.worksheet-title-box::before {
  content: "";

  position: absolute;

  inset: 4px;

  border:
    1px solid #444;

  border-radius: 5px;

  pointer-events: none;
}

.worksheet-title {
  margin: 0;

  position: relative;

  font-size: 21px;

  font-weight: 900;

  line-height: 1.12;

  letter-spacing: 0.2px;

  text-transform: uppercase;
}

.worksheet-subject {
  position: relative;

  margin-top: 5px;

  font-size: 9.5px;

  font-weight: 700;

  letter-spacing: 1.3px;

  text-transform: uppercase;
}


/* =========================================================
   STUDENT INFORMATION
========================================================= */

.worksheet-student-info {
  display: flex;

  align-items: center;

  gap: 24px;

  margin:
    0
    0
    13px;

  padding:
    0
    2px;

  font-size: 10px;

  white-space: nowrap;
}

.worksheet-student-field {
  display: flex;

  align-items: flex-end;

  gap: 5px;
}

.worksheet-name-field {
  flex: 1;
}

.worksheet-field-line {
  display: inline-block;

  width: 2.15in;

  height: 15px;

  border-bottom:
    1px solid #333;
}

.worksheet-field-line.small {
  width: 0.85in;
}


/* =========================================================
   DIRECTIONS
========================================================= */

.worksheet-directions {
  margin-bottom: 14px;

  padding:
    8px
    11px;

  border:
    1px solid #aaa;

  border-radius: 5px;

  font-size: 9.7px;

  line-height: 1.45;
}

.worksheet-directions-title {
  font-weight: 800;

  margin-right: 5px;
}


/* =========================================================
   QUESTIONS
========================================================= */

.worksheet-question {
  margin:
    0
    0
    13px;

  padding:
    0
    0
    9px;

  border-bottom:
    1px solid #d9d9d9;

  break-inside: avoid;

  page-break-inside: avoid;
}

.worksheet-question:last-child {
  border-bottom: none;
}

.worksheet-question-text {
  display: flex;

  align-items: flex-start;

  gap: 6px;

  font-size: 10.7px;

  line-height: 1.42;

  font-weight: 650;
}

.worksheet-question-number {
  flex-shrink: 0;

  min-width: 18px;

  font-weight: 900;
}

.worksheet-question-content {
  flex: 1;
}


/* =========================================================
   MULTIPLE CHOICE
========================================================= */

.worksheet-options {
  margin:
    7px
    0
    0
    21px;

  display: grid;

  grid-template-columns:
    repeat(4, 1fr);

  gap: 7px;

  align-items: center;
}

.worksheet-option {
  display: flex;

  align-items: center;

  gap: 6px;

  min-width: 0;

  font-size: 9.7px;

  line-height: 1.3;
}

.worksheet-option-circle {
  width: 19px;

  height: 19px;

  border:
    1px solid #444;

  border-radius: 50%;

  display: inline-flex;

  align-items: center;

  justify-content: center;

  flex-shrink: 0;

  font-size: 8px;

  font-weight: 800;
}

.worksheet-option-text {
  overflow-wrap: anywhere;
}


/* =========================================================
   TRUE / FALSE
========================================================= */

.worksheet-true-false {
  display: flex;

  gap: 35px;

  margin:
    8px
    0
    0
    21px;

  font-size: 9.8px;
}

.worksheet-tf-option {
  display: inline-flex;

  align-items: center;

  gap: 6px;
}

.worksheet-tf-circle {
  width: 16px;

  height: 16px;

  border:
    1px solid #555;

  border-radius: 50%;
}


/* =========================================================
   ANSWER LINES
========================================================= */

.worksheet-answer-lines {
  margin:
    7px
    0
    0
    21px;
}

.worksheet-answer-lines div {
  height: 20px;

  border-bottom:
    1px solid #777;
}


/* =========================================================
   OPEN RESPONSE
========================================================= */

.worksheet-response-lines {
  margin:
    8px
    0
    0
    21px;
}

.worksheet-response-lines div {
  height: 22px;

  border-bottom:
    1px solid #aaa;
}


/* =========================================================
   MATCHING
========================================================= */

.worksheet-matching-lines {
  margin:
    8px
    0
    0
    21px;
}

.worksheet-matching-lines div {
  height: 22px;

  border-bottom:
    1px solid #999;
}


/* =========================================================
   PRINT SAFETY
========================================================= */

.worksheet-document main {
  position: relative;

  z-index: 1;
}

.worksheet-question,
.worksheet-options,
.worksheet-true-false,
.worksheet-answer-lines,
.worksheet-response-lines,
.worksheet-matching-lines {
  break-inside: avoid;

  page-break-inside: avoid;
}

${designCss(design)}
</style>

</head>

<body>

<!-- =======================================================
     WORKSHEET FRAME
======================================================== -->

<div class="worksheet-print-frame"></div>


<!-- =======================================================
     TOP RIGHT GRADE

     NO COMPANY NAME HERE
======================================================== -->

<header class="worksheet-print-header">

  <div class="worksheet-print-grade">
    ${escapeHtml(worksheet.gradeLevel)}
  </div>

</header>


<!-- =======================================================
     FOOTER
======================================================== -->

<footer class="worksheet-print-footer">

  <div class="worksheet-footer-brand">
    ${branding}
  </div>

  <div class="worksheet-footer-page">
    Worksheet
  </div>

</footer>


<!-- =======================================================
     DOCUMENT
======================================================== -->

${
  hasExplicitPages
    ? `${questionPages
        .map(
          (pageQuestions, pageIndex) => `
      <div class="worksheet-document worksheet-page">

        ${
          pageIndex === 0
            ? `
              <div class="worksheet-title-box">
                <h1 class="worksheet-title">
                  ${escapeHtml(worksheet.title)}
                </h1>
                <div class="worksheet-subject">
                  ${escapeHtml(worksheet.subject)}
                </div>
              </div>

              <div class="worksheet-student-info">
                ${studentFields}
              </div>

              <div class="worksheet-directions">
                <span class="worksheet-directions-title">
                  Directions:
                </span>
                ${escapeHtml(worksheet.instructions)}
              </div>
            `
            : `
              <div class="worksheet-continuation-header">
                <strong>${escapeHtml(worksheet.title)}</strong>
                <span>${escapeHtml(worksheet.subject)}</span>
              </div>
            `
        }

        <main>
          ${pageQuestions.map(renderQuestion).join("")}
        </main>
      </div>
    `,
        )
        .join("\n")}`
    : `<div class="worksheet-document">

  <div class="worksheet-title-box">
    <h1 class="worksheet-title">
      ${escapeHtml(worksheet.title)}
    </h1>
    <div class="worksheet-subject">
      ${escapeHtml(worksheet.subject)}
    </div>
  </div>

  <div class="worksheet-student-info">
    ${studentFields}
  </div>

  <div class="worksheet-directions">
    <span class="worksheet-directions-title">
      Directions:
    </span>
    ${escapeHtml(worksheet.instructions)}
  </div>

  <main>
    ${questionPages[0].map(renderQuestion).join("")}
  </main>

</div>`
}

</body>

</html>
`;
}
