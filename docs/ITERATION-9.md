# Iteration 9: Smart Practice (reinforcement learning)

Page: `/practice/smart` (also linked from the Placement hub). No AI service, no new table, no new writes, no secrets.

## The idea

Choosing what to practise next is a **multi-armed bandit**, the simplest reinforcement-learning setting (one state, no transitions; it is not Q-learning):

| Bandit term | In PrepWise |
|---|---|
| Arm | A question category (about 10) |
| Pull | Practise one question from that category |
| Reward | 1 when the answer is **wrong** (the topic needs work), 0 when right |
| Belief | Beta(1 + wrong, 1 + right) for each arm's "wrong rate" |
| Policy | **Thompson sampling**: draw one sample from each belief, practise the arm with the highest draw |

Weak topics come up more often (exploitation) while uncertain ones still get tried (exploration). Only the latest **200 answers** count (a sliding window), because a student improves: an old mistake should not keep a topic "weak" forever, and a topic that has not been practised for a long time becomes uncertain again and returns. Inside the chosen category the next question is an unseen one whose difficulty follows the recent accuracy in that category (easier after repeated misses, harder after repeated successes). When everything in a category has been seen, the one practised longest ago comes back.

Code: `packages/core/src/bandit/engine.ts` (pure, seeded, no imports), `apps/api/src/routes/smart.ts`, `apps/web/src/pages/practice/SmartPractice.jsx`.

## Fit to the free setup

- `GET /api/smart/next` reads at most 200 recent answers and one candidate list, writes nothing. The answer itself is saved by the existing `POST /api/attempts`, and that **is** the bandit's reward signal, so there is no extra database write and no new table.
- The choice is a pure function of stored answers with a seeded random generator: refreshing the page before answering gives the same question, and every new answer changes the seed.
- `GET /api/smart/curve` returns up to 200 points; the chart is inline SVG (no library).

## What the student sees

The next question (answers are never sent before you attempt it), a **"Why this topic?"** panel (the reason in words, whether it is practising a weak area or exploring, and each category's estimated wrong rate with the chosen one highlighted), and a **learning curve**: rolling accuracy over the last 10 answers, right and wrong dots, and "first 10 answers versus latest 10" once there are 20 answers. A module filter (aptitude, DSA, technical, HR) limits the arms.

## Evidence

**Unit tests** (`packages/core/src/bandit`, 10 tests): determinism, Beta sampling mean, the weak topic is chosen most often while a middling topic is still explored, an unseen topic is favoured, one arm is marked chosen, explore/exploit labelling, difficulty adaptation, rolling accuracy, and a paired simulation showing the bandit gains more skill than random.

**Simulation** (`node scripts/simulate-bandit.mjs`): a synthetic student with 8 topics, each with a skill (probability of a right answer) that rises with diminishing returns when practised. 400 students, the same students for every policy, skill gained (mean, 95% confidence interval):

| Policy | 40 practice questions | 120 practice questions |
|---|---|---|
| Random | 0.124 ± 0.002 | 0.283 ± 0.004 |
| Round-robin | 0.126 ± 0.002 | 0.287 ± 0.004 |
| Greedy, no exploration | 0.121 ± 0.002 | 0.272 ± 0.004 |
| **Thompson sampling (the bandit)** | **0.131 ± 0.002** | **0.292 ± 0.004** |
| Oracle (knows every true skill) | 0.147 ± 0.002 | 0.301 ± 0.004 |

Paired differences are statistically significant: the bandit beats random by +0.008 (40 questions) and +0.009 (120), round-robin by +0.005 and +0.004, and the greedy policy by +0.010 and +0.019. **Be honest about the size:** the gain over random is about 3 percent in this model, and the oracle shows how much room is left. Greedy without exploration does *worse than random*, which is the case for exploration.

**Smoke test** (`scripts/smoke-smart.mjs`, 20 checks) on a real database: no repeats among unseen questions, correct answers never revealed, refresh-stable choice, and an end-to-end check where one category is answered wrong on purpose: it was practised in **77% of 30 draws** against 14% by chance, and its estimated wrong rate was the highest.

## Bugs found

- A blanket rename of a helper also renamed an API response field, which crashed the page. The smoke test had not checked that field; it does now.
- The Content-Security-Policy added in Iteration 8 blocked the small theme script in `index.html` (found in the browser console). Its hash is now allowed, and `/practice/*` is covered by the policy.

## Limits

- The simulation uses a model of learning I made up; it shows the policy behaves as designed, not that real students improve by this much. No real student data was used.
- The reward is "wrong answer", so a topic with very hard questions looks weak even if you are learning. Difficulty targeting softens this but does not remove it.
- Arms are categories, not individual skills, and answers are multiple choice only.
- Mastered topics are rarely drawn until their old answers leave the 200-answer window (a deliberate form of spaced revision).
- A bandit only reorders practice. It does not predict placement results.
