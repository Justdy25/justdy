import type { WorksheetDocument } from "../schema";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function questionTypeLabel(
  type: WorksheetDocument["questions"][number]["type"],
): string {
  switch (type) {
    case "multiple_choice":
      return "MULTIPLE CHOICE";
    case "true_false":
      return "TRUE / FALSE";
    case "short_answer":
      return "SHORT ANSWER";
    case "fill_in_blank":
      return "FILL IN THE BLANK";
    case "matching":
      return "MATCHING";
    case "open_response":
      return "OPEN RESPONSE";
    default:
      return "QUESTION";
  }
}

function answerFor(
  question: WorksheetDocument["questions"][number],
  worksheet: WorksheetDocument,
) {
  const key = worksheet.answerKey?.find(
    (item) => item.questionNumber === question.number,
  );
  return key?.answer ?? question.answer ?? "";
}

function explanationFor(
  question: WorksheetDocument["questions"][number],
  worksheet: WorksheetDocument,
) {
  const key = worksheet.answerKey?.find(
    (item) => item.questionNumber === question.number,
  );
  return key?.explanation ?? question.explanation ?? "";
}

function renderEntry(
  question: WorksheetDocument["questions"][number],
  worksheet: WorksheetDocument,
) {
  const answer = answerFor(question, worksheet);
  const explanation = explanationFor(question, worksheet);
  return `
    <article class="answer-key-entry">
      <div class="answer-key-answer-row">
        <span class="answer-key-number">${question.number}.</span>
        <strong class="answer-key-answer">${escapeHtml(answer)}</strong>
      </div>
      ${explanation ? `<div class="answer-key-explanation"><strong>Explanation:</strong> ${escapeHtml(explanation)}</div>` : ""}
      <div class="answer-key-type">${questionTypeLabel(question.type)}</div>
    </article>
  `;
}

export function renderClassicAnswerKey(worksheet: WorksheetDocument): string {
  const questions = [...worksheet.questions].sort(
    (a, b) => a.number - b.number,
  );
  const pageSize = 20;
  const pages: WorksheetDocument["questions"][] = [];
  for (let i = 0; i < questions.length; i += pageSize) {
    pages.push(questions.slice(i, i + pageSize));
  }

  const pageHtml = pages
    .map((pageQuestions, pageIndex) => {
      const midpoint = Math.ceil(pageQuestions.length / 2);
      const left = pageQuestions.slice(0, midpoint);
      const right = pageQuestions.slice(midpoint);
      return `
      <section class="answer-key-page">
        <div class="answer-key-frame">
          <header class="answer-key-header">
            <div class="answer-key-grade">${escapeHtml(worksheet.gradeLevel)}</div>
            <div class="answer-key-title-box">
              <div class="answer-key-title">${escapeHtml(worksheet.title || worksheet.topic || "WORKSHEET")}</div>
              <div class="answer-key-subject">${escapeHtml(worksheet.subject || "")}</div>
            </div>
            <div class="answer-key-banner">ANSWER KEY</div>
          </header>

          <main class="answer-key-grid">
            <div class="answer-key-column">${left.map((q) => renderEntry(q, worksheet)).join("")}</div>
            <div class="answer-key-column answer-key-column-right">${right.map((q) => renderEntry(q, worksheet)).join("")}</div>
          </main>

          <footer class="answer-key-footer">
            <span>Justdy Learning • ${escapeHtml(worksheet.gradeLevel)}</span>
            <span>Answer Key • Page ${pageIndex + 1}</span>
          </footer>
        </div>
      </section>
    `;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
@page { size: Letter; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #171717; font-family: Arial, Helvetica, sans-serif; }
body { font-size: 9px; }
.answer-key-page { width: 8.5in; min-height: 11in; padding: .28in; break-after: page; page-break-after: always; }
.answer-key-page:last-child { break-after: auto; page-break-after: auto; }
.answer-key-frame { position: relative; width: 100%; min-height: 10.44in; border: 1px solid #cbd5e1; border-radius: 10px; padding: .28in .32in .48in; overflow: hidden; }
.answer-key-grade { position: absolute; right: .22in; top: .16in; font-size: 8px; font-weight: 800; letter-spacing: .7px; text-transform: uppercase; color: #334155; }
.answer-key-title-box { margin-top: .04in; border: 2px solid #334155; border-radius: 8px; padding: 10px 16px 8px; text-align: center; }
.answer-key-title { font-size: 18px; line-height: 1.08; font-weight: 900; letter-spacing: .5px; text-transform: uppercase; }
.answer-key-subject { margin-top: 4px; font-size: 8px; font-weight: 800; letter-spacing: 1.3px; text-transform: uppercase; color: #334155; }
.answer-key-banner { margin: 10px auto 14px; width: fit-content; min-width: 150px; padding: 5px 18px; border: 1px solid #334155; border-radius: 5px; font-size: 9px; font-weight: 900; letter-spacing: 1.7px; text-align: center; }
.answer-key-grid { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); column-gap: 22px; align-items: start; }
.answer-key-column-right { border-left: 1px solid #e2e8f0; padding-left: 20px; }
.answer-key-entry { break-inside: avoid; page-break-inside: avoid; padding: 0 0 8px; margin: 0 0 8px; border-bottom: 1px solid #e2e8f0; }
.answer-key-answer-row { display: flex; align-items: baseline; gap: 7px; }
.answer-key-number { min-width: 18px; font-weight: 900; font-size: 9px; }
.answer-key-answer { font-size: 9.4px; line-height: 1.25; }
.answer-key-explanation { margin: 3px 0 0 25px; font-size: 7.8px; line-height: 1.35; color: #334155; }
.answer-key-type { margin: 4px 0 0 25px; font-size: 6.4px; line-height: 1; font-weight: 900; letter-spacing: 1px; color: #64748b; }
.answer-key-footer { position: absolute; left: .32in; right: .32in; bottom: .18in; padding-top: 5px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 6.8px; font-weight: 700; color: #64748b; }
@media print { .answer-key-page { break-after: page; page-break-after: always; } .answer-key-page:last-child { break-after: auto; page-break-after: auto; } }
</style>
</head>
<body>${pageHtml}</body>
</html>`;
}
