# Iteration 10: study search and a retrieval-augmented assistant (TF-IDF)

Pages: `/hub/search` (works with no AI at all) and `/hub/ai-assistant` (optional, cites its sources).

## What it does

Both features search PrepWise's **own study material** first:

| Passage kind | Count | Link target |
|---|---|---|
| Learning topics (outline, practice, skills covered) | 62 | Roadmap |
| Interview questions with key ideas and model answers | 87 | Mock interview |
| Multiple-choice practice questions with explanations | 210 | The practice module |
| Coding problem statements, constraints and hints (**never the reference solutions**) | 27 | The problem |

386 passages in total (`packages/content/src/rag-corpus.ts`).

- **Study Search:** type a question, get the closest passages with a match percentage and the query words highlighted. It needs no AI and no network after the page loads.
- **Assistant with sources:** before a message is sent, the browser retrieves the top passages and sends only their **ids**. The Worker looks the ids up in its own bundled content, puts the passages in the prompt as numbered reference data, asks the model to cite `[1]`, `[2]`, and returns the list of sources, which the page shows as links. Citations are stored with the reply (`sources_json`, migration `0011`) so they are still there when the conversation is reopened. A checkbox ("Use PrepWise study material as sources") turns it off.

## The method

TF-IDF with cosine similarity (`packages/core/src/rag/tfidf.ts`): each passage and the query become vectors of word weights `(1 + ln tf) × idf`, with `idf = ln((N+1)/(df+1)) + 1`; passages are ranked by cosine similarity. Words are lower-cased, stop words dropped and lightly stemmed ("scheduling" matches "schedule"); title words count three times. It is deterministic and has no model to train.

## Fit to the free setup

- **No Worker CPU for search.** Retrieval runs in the browser. The corpus loads on first use as its own chunk (about 150 KB, **39 KB gzipped**), so it never slows the rest of the app.
- **The Worker only does id lookups** (no tokenising or scoring) and adds the bundled corpus to the Worker bundle, about 180 KB.
- **One small migration** (a nullable column). No new secrets, no new services.
- **Safe by construction:** the browser cannot supply passage text, only ids from a fixed pattern; unknown, malformed and duplicate ids are dropped; at most 5 are used; the passages sit inside marked delimiters and are labelled as data, not instructions.

## Evidence

`packages/core/src/rag/rag.test.ts` (8 tests) plus the prompt test. The retrieval test uses **32 queries written by me**, each with the passage(s) that are a correct answer (for example "difference between a process and a thread" should return the OS process-versus-thread interview question):

| | Recall@3 | Mean reciprocal rank |
|---|---|---|
| First run, before any tuning | **94%** | 0.881 |
| After adding generic study words (`learn`, `study`, `prepare`, `topic` ...) to the stop list | 97% | 0.889 |

The stop-list change was made **after** seeing that "learn sql basics" returned "deep learning" topics, so the 97% is optimistic; 94% is the honest number. The one remaining miss: "two sum problem" ranks three practice questions about Two Sum above the coding problem, which is arguably still a good answer.

`scripts/smoke-ai.mjs --mock` now also checks the retrieval path end to end against the mock provider: ids become numbered citations, unknown/malformed/duplicate ids are dropped, the provider receives the marked reference block, citations carry no passage text, no sources means no block, more than 5 ids is rejected, client-supplied "source text" is ignored, and citations survive reopening the conversation. Browser (local, mock provider, CSP on): search returned the right interview question first, and the assistant reply listed four linked sources.

## Limits (please state these in your viva)

- **It matches words, not meaning.** A question phrased with different vocabulary can miss (no embeddings or synonyms).
- **The citation list shows what the model was given, not proof of what it used.** The `[1]` markers in the answer are the model's own, and a model can ignore or misuse the material. This was only tested against a mock provider, not a real model.
- The 32 test queries are mine and mostly target interview and topic passages; real students will phrase things differently.
- The corpus is only as good as the content, which still needs review by a teacher.
- Search is not personalised, and only the top 4 passages (minimum score 0.12) are sent to the assistant.
