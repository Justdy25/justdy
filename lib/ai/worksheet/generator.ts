import { openai } from "@/lib/openai";

import { WorksheetDocumentSchema } from "./schema";

import type { WorksheetQuestionType, WorksheetDifficulty } from "./types";

export interface GenerateWorksheetInput {
  gradeLevel: string;

  subject: string;

  topic: string;

  title?: string;

  learningObjective?: string;

  questionCount: number;

  difficulty: WorksheetDifficulty;

  questionTypes: WorksheetQuestionType[];

  instructions?: string;
}

function buildWorksheetPrompt(input: GenerateWorksheetInput): string {
  return `
You are the educational content engine for Justdy Learning.

Create a professional, accurate, age-appropriate printable educational worksheet.

STUDENT INFORMATION

Grade:
${input.gradeLevel}

Subject:
${input.subject}

Topic:
${input.topic}

WORKSHEET TITLE:
${input.title || input.topic}

LEARNING OBJECTIVE:
${
  input.learningObjective ||
  `Students will develop understanding and proficiency in ${input.topic}.`
}

NUMBER OF QUESTIONS:
${input.questionCount}

DIFFICULTY:
${input.difficulty}

ALLOWED QUESTION TYPES:
${input.questionTypes.join(", ")}

INSTRUCTIONS:
${
  input.instructions ||
  "Read each question carefully and show your work where appropriate."
}

CONTENT REQUIREMENTS

1. Create exactly ${input.questionCount} questions.

2. Every question must be appropriate for:
${input.gradeLevel}

3. Every question must directly relate to:
${input.topic}

4. Do not create duplicate questions.

5. Questions must be clear and unambiguous.

6. Do not use unnecessarily advanced vocabulary.

7. Multiple-choice questions must contain exactly four options.

8. Multiple-choice options must be distinct.

9. Every multiple-choice question must have exactly one correct answer.

10. Do not reveal the answer inside the question.

11. Use correct mathematical notation when mathematics is involved.

12. Do not invent facts.

13. Every question must have a valid answer.

14. The answer key must correspond exactly to the questions.

15. Assign reasonable point values.

16. totalPoints must equal the sum of all question points.

17. Question numbers must start at 1 and increase sequentially.

18. Answer-key question numbers must match the worksheet questions exactly.

19. Keep explanations concise but useful.

20. The worksheet should feel professionally authored rather than generic AI output.

QUESTION TYPE RULES

multiple_choice:
- exactly four options
- one correct answer

true_false:
- answer must be "True" or "False"

short_answer:
- provide a concise expected answer

fill_in_blank:
- provide the expected missing answer

matching:
- provide the correct matching answer

open_response:
- provide a suitable model answer

IMPORTANT

Return ONLY valid JSON matching the required structure.
`;
}

function buildJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,

    required: [
      "version",
      "title",
      "subject",
      "gradeLevel",
      "topic",
      "learningObjective",
      "instructions",
      "questions",
      "totalPoints",
      "answerKey",
    ],

    properties: {
      version: {
        type: "string",
      },

      title: {
        type: "string",
      },

      subject: {
        type: "string",
      },

      gradeLevel: {
        type: "string",
      },

      topic: {
        type: "string",
      },

      learningObjective: {
        type: "string",
      },

      instructions: {
        type: "string",
      },

      questions: {
        type: "array",

        items: {
          type: "object",

          additionalProperties: false,

          required: [
            "id",
            "number",
            "type",
            "question",
            "options",
            "answer",
            "explanation",
            "points",
          ],

          properties: {
            id: {
              type: "string",
            },

            number: {
              type: "integer",
            },

            type: {
              type: "string",

              enum: [
                "multiple_choice",
                "short_answer",
                "true_false",
                "fill_in_blank",
                "matching",
                "open_response",
              ],
            },

            question: {
              type: "string",
            },

            options: {
              anyOf: [
                {
                  type: "array",

                  items: {
                    type: "object",

                    additionalProperties: false,

                    required: ["id", "text"],

                    properties: {
                      id: {
                        type: "string",
                      },

                      text: {
                        type: "string",
                      },
                    },
                  },
                },

                {
                  type: "null",
                },
              ],
            },

            answer: {
              type: "string",
            },

            explanation: {
              anyOf: [
                {
                  type: "string",
                },

                {
                  type: "null",
                },
              ],
            },

            points: {
              type: "integer",
            },
          },
        },
      },

      totalPoints: {
        type: "integer",
      },

      answerKey: {
        type: "array",

        items: {
          type: "object",

          additionalProperties: false,

          required: ["questionNumber", "answer", "explanation"],

          properties: {
            questionNumber: {
              type: "integer",
            },

            answer: {
              type: "string",
            },

            explanation: {
              anyOf: [
                {
                  type: "string",
                },

                {
                  type: "null",
                },
              ],
            },
          },
        },
      },
    },
  } as const;
}

export async function generateWorksheet(input: GenerateWorksheetInput) {
  if (
    !Number.isInteger(input.questionCount) ||
    input.questionCount < 1 ||
    input.questionCount > 100
  ) {
    throw new Error("Question count must be between 1 and 100.");
  }

  if (!input.questionTypes || input.questionTypes.length === 0) {
    throw new Error("At least one question type is required.");
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5",

    response_format: {
      type: "json_schema",

      json_schema: {
        name: "justdy_worksheet",

        strict: true,

        schema: buildJsonSchema(),
      },
    },

    messages: [
      {
        role: "system",

        content:
          "You are the educational content engine for Justdy Learning. Generate accurate, age-appropriate educational content.",
      },

      {
        role: "user",

        content: buildWorksheetPrompt(input),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("The AI returned an empty worksheet.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("The AI returned invalid JSON.");
  }

  const worksheet = WorksheetDocumentSchema.parse(parsed);

  return worksheet;
}
