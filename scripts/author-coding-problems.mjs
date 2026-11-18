// Authors the coding problem bank and VERIFIES it:
//   * expected outputs are computed by the JavaScript reference solution,
//   * the independent Python reference solution must produce the same output for every test,
//   * the starter code must fail (not crash the judge) and every problem needs edge-case tests.
// Writes packages/content/src/coding-problems.json (public: statements, starters, tests) and
// packages/content/src/coding-solutions.json (reference solutions, served only by the API after a solve).
// Usage: node scripts/author-coding-problems.mjs
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let seed = 12345;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
const ints = (len, lo, hi) => Array.from({ length: len }, () => lo + rnd(hi - lo + 1));
const word = (len, alphabet = "abcde") => Array.from({ length: len }, () => alphabet[rnd(alphabet.length)]).join("");

const P = [];
const add = (p) => P.push(p);

// ------------------------------------------------------------------ EASY
add({
  id: "two-sum", title: "Two Sum", difficulty: "EASY", topic: "Arrays & Hashing", skills: ["Data Structures", "Algorithms"],
  fn: "two_sum", params: ["nums", "target"],
  statement: "Given an array of integers `nums` and an integer `target`, return the indices `[i, j]` (with i < j) of the two numbers that add up to `target`. Exactly one valid pair exists.",
  constraints: ["2 <= nums.length <= 10^4", "Each element is an integer", "Exactly one solution exists"],
  hints: ["Brute force checks every pair in O(n^2).", "For each number, which other number do you need? Can you look it up in O(1)?"],
  tests: [[[2, 7, 11, 15], 9], [[3, 2, 4], 6], [[3, 3], 6], [[-1, -2, -3, -4, -5], -8], [[0, 4, 3, 0], 0], [[1, 5, 9, 14, 20, 31], 45], [[512, 3, 1048576, 77, 16384, 9, 2, 1, 4096, 131072, 640, 8, 8192, 33554432].filter((x, k) => k !== 99), 1048576 + 8]],
  js: `function two_sum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const need = target - nums[i];\n    if (seen.has(need)) return [seen.get(need), i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}`,
  py: `def two_sum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        if target - x in seen:\n            return [seen[target - x], i]\n        seen[x] = i\n    return []`,
  complexity: "O(n) time, O(n) space", explanation: "Store each value's index in a hash map. For each number, check whether target - number was already seen.",
});
add({
  id: "valid-anagram", title: "Valid Anagram", difficulty: "EASY", topic: "Strings & Hashing", skills: ["Data Structures", "Algorithms"],
  fn: "is_anagram", params: ["s", "t"],
  statement: "Return `true` if string `t` is an anagram of string `s` (same letters with the same counts, in any order), otherwise `false`.",
  constraints: ["0 <= s.length, t.length <= 5 * 10^4", "Lowercase English letters"],
  hints: ["Different lengths can never be anagrams.", "Count the letters of each string, or sort both."],
  tests: [["anagram", "nagaram"], ["rat", "car"], ["", ""], ["a", "a"], ["ab", "a"], ["aacc", "ccac"], ["listen", "silent"], [word(300, "abc"), word(300, "abc")]],
  js: `function is_anagram(s, t) {\n  if (s.length !== t.length) return false;\n  const c = {};\n  for (const ch of s) c[ch] = (c[ch] || 0) + 1;\n  for (const ch of t) { if (!c[ch]) return false; c[ch]--; }\n  return true;\n}`,
  py: `def is_anagram(s, t):\n    from collections import Counter\n    return Counter(s) == Counter(t)`,
  complexity: "O(n) time, O(1) space (26 letters)", explanation: "Count letters in s, then subtract the counts of t. Any shortage means they differ.",
});
add({
  id: "valid-palindrome", title: "Valid Palindrome", difficulty: "EASY", topic: "Two Pointers", skills: ["Algorithms", "Problem Solving"],
  fn: "is_palindrome", params: ["s"],
  statement: "A phrase is a palindrome if, after converting to lowercase and removing every character that is not a letter or digit, it reads the same forwards and backwards. Return `true` or `false` for the string `s`.",
  constraints: ["0 <= s.length <= 2 * 10^5", "s contains printable ASCII characters"],
  hints: ["Skip characters that are not letters or digits.", "Compare from both ends moving inwards."],
  tests: [["A man, a plan, a canal: Panama"], ["race a car"], [" "], [""], ["0P"], ["No 'x' in Nixon"], ["ab_a"], ["a".repeat(500) + "b" + "a".repeat(500)]],
  js: `function is_palindrome(s) {\n  let i = 0, j = s.length - 1;\n  const ok = (c) => /[a-z0-9]/i.test(c);\n  while (i < j) {\n    while (i < j && !ok(s[i])) i++;\n    while (i < j && !ok(s[j])) j--;\n    if (s[i].toLowerCase() !== s[j].toLowerCase()) return false;\n    i++; j--;\n  }\n  return true;\n}`,
  py: `def is_palindrome(s):\n    t = [c.lower() for c in s if c.isalnum()]\n    return t == t[::-1]`,
  complexity: "O(n) time, O(1) space", explanation: "Two pointers move inwards, skipping non-alphanumeric characters, and compare lowercase characters.",
});
add({
  id: "fizzbuzz", title: "FizzBuzz", difficulty: "EASY", topic: "Basics", skills: ["Problem Solving"],
  fn: "fizz_buzz", params: ["n"],
  statement: "Return a list of strings for the numbers 1 to `n`: \"FizzBuzz\" if divisible by both 3 and 5, \"Fizz\" if divisible by 3, \"Buzz\" if divisible by 5, otherwise the number as a string.",
  constraints: ["1 <= n <= 10^4"],
  hints: ["Check divisibility by 15 first.", "Convert plain numbers to strings."],
  tests: [[1], [3], [5], [15], [16], [30]],
  js: `function fizz_buzz(n) {\n  const out = [];\n  for (let i = 1; i <= n; i++) out.push(i % 15 === 0 ? "FizzBuzz" : i % 3 === 0 ? "Fizz" : i % 5 === 0 ? "Buzz" : String(i));\n  return out;\n}`,
  py: `def fizz_buzz(n):\n    out = []\n    for i in range(1, n + 1):\n        out.append("FizzBuzz" if i % 15 == 0 else "Fizz" if i % 3 == 0 else "Buzz" if i % 5 == 0 else str(i))\n    return out`,
  complexity: "O(n) time", explanation: "Loop from 1 to n and test divisibility, checking 15 before 3 and 5.",
});
add({
  id: "valid-parentheses", title: "Valid Parentheses", difficulty: "EASY", topic: "Stacks", skills: ["Data Structures"],
  fn: "is_valid", params: ["s"],
  statement: "Given a string `s` containing only the characters `()[]{}`, return `true` if every bracket is closed by the same type, in the correct order.",
  constraints: ["0 <= s.length <= 10^4", "s consists only of ()[]{}"],
  hints: ["The most recent open bracket must be closed first.", "A stack fits this last-in first-out rule."],
  tests: [["()"], ["()[]{}"], ["(]"], ["([)]"], ["{[]}"], [""], ["(("], ["]"], ["({[]})".repeat(100)]],
  js: `function is_valid(s) {\n  const pair = { ")": "(", "]": "[", "}": "{" };\n  const st = [];\n  for (const c of s) {\n    if (c in pair) { if (st.pop() !== pair[c]) return false; } else st.push(c);\n  }\n  return st.length === 0;\n}`,
  py: `def is_valid(s):\n    pair = {')': '(', ']': '[', '}': '{'}\n    st = []\n    for c in s:\n        if c in pair:\n            if not st or st.pop() != pair[c]:\n                return False\n        else:\n            st.append(c)\n    return not st`,
  complexity: "O(n) time, O(n) space", explanation: "Push open brackets. On a closing bracket the top of the stack must be its partner. The stack must end empty.",
});
add({
  id: "merge-sorted-arrays", title: "Merge Two Sorted Arrays", difficulty: "EASY", topic: "Two Pointers", skills: ["Algorithms"],
  fn: "merge_sorted", params: ["a", "b"],
  statement: "Given two arrays `a` and `b`, each sorted in non-decreasing order, return one sorted array containing all their elements.",
  constraints: ["0 <= a.length, b.length <= 10^4"],
  hints: ["Use one pointer in each array.", "Always take the smaller front element."],
  tests: [[[1, 3, 5], [2, 4, 6]], [[], [1]], [[], []], [[1, 1, 1], [1, 1]], [[-5, 0, 7], [-6, -1, 8, 9]], [[1, 2, 3], [4, 5, 6]], [ints(200, 0, 50).sort((x, y) => x - y), ints(150, 0, 50).sort((x, y) => x - y)]],
  js: `function merge_sorted(a, b) {\n  const out = [];\n  let i = 0, j = 0;\n  while (i < a.length && j < b.length) out.push(a[i] <= b[j] ? a[i++] : b[j++]);\n  while (i < a.length) out.push(a[i++]);\n  while (j < b.length) out.push(b[j++]);\n  return out;\n}`,
  py: `def merge_sorted(a, b):\n    out, i, j = [], 0, 0\n    while i < len(a) and j < len(b):\n        if a[i] <= b[j]:\n            out.append(a[i]); i += 1\n        else:\n            out.append(b[j]); j += 1\n    return out + a[i:] + b[j:]`,
  complexity: "O(n + m) time, O(n + m) space", explanation: "Two pointers: repeatedly take the smaller of the two current elements, then append what remains.",
});
add({
  id: "contains-duplicate", title: "Contains Duplicate", difficulty: "EASY", topic: "Arrays & Hashing", skills: ["Data Structures"],
  fn: "contains_duplicate", params: ["nums"],
  statement: "Return `true` if any value appears at least twice in the array `nums`, and `false` if every element is distinct.",
  constraints: ["0 <= nums.length <= 10^5"],
  hints: ["Remember what you have already seen.", "A set gives O(1) membership checks."],
  tests: [[[1, 2, 3, 1]], [[1, 2, 3, 4]], [[]], [[7]], [[1, 1, 1, 3, 3, 4, 3, 2, 4, 2]], [[...Array.from({ length: 500 }, (_, i) => i * 3)]], [[...Array.from({ length: 500 }, (_, i) => i * 3), 3]]],
  js: `function contains_duplicate(nums) {\n  const seen = new Set();\n  for (const x of nums) { if (seen.has(x)) return true; seen.add(x); }\n  return false;\n}`,
  py: `def contains_duplicate(nums):\n    return len(set(nums)) != len(nums)`,
  complexity: "O(n) time, O(n) space", explanation: "Add each number to a set; if it is already there, there is a duplicate.",
});
add({
  id: "climbing-stairs", title: "Climbing Stairs", difficulty: "EASY", topic: "Dynamic Programming", skills: ["Algorithms", "Problem Solving"],
  fn: "climb_stairs", params: ["n"],
  statement: "You climb a staircase of `n` steps taking 1 or 2 steps at a time. Return the number of distinct ways to reach the top.",
  constraints: ["1 <= n <= 45"],
  hints: ["To reach step n you came from step n-1 or n-2.", "That is the Fibonacci recurrence; keep only the last two values."],
  tests: [[1], [2], [3], [4], [5], [10], [30], [45]],
  js: `function climb_stairs(n) {\n  let a = 1, b = 1;\n  for (let i = 2; i <= n; i++) [a, b] = [b, a + b];\n  return b;\n}`,
  py: `def climb_stairs(n):\n    a, b = 1, 1\n    for _ in range(2, n + 1):\n        a, b = b, a + b\n    return b`,
  complexity: "O(n) time, O(1) space", explanation: "ways(n) = ways(n-1) + ways(n-2). Roll two variables instead of storing a table.",
});
add({
  id: "binary-search", title: "Binary Search", difficulty: "EASY", topic: "Binary Search", skills: ["Algorithms"],
  fn: "search", params: ["nums", "target"],
  statement: "Given a sorted array `nums` of distinct integers and an integer `target`, return the index of `target`, or `-1` if it is not present. Aim for O(log n).",
  constraints: ["0 <= nums.length <= 10^5", "All elements are distinct and sorted ascending"],
  hints: ["Look at the middle element.", "Discard the half that cannot contain the target."],
  tests: [[[-1, 0, 3, 5, 9, 12], 9], [[-1, 0, 3, 5, 9, 12], 2], [[5], 5], [[5], -5], [[], 1], [[1, 3], 3], [[1, 3], 1], [Array.from({ length: 1000 }, (_, i) => i * 2), 998]],
  js: `function search(nums, target) {\n  let lo = 0, hi = nums.length - 1;\n  while (lo <= hi) {\n    const mid = (lo + hi) >> 1;\n    if (nums[mid] === target) return mid;\n    if (nums[mid] < target) lo = mid + 1; else hi = mid - 1;\n  }\n  return -1;\n}`,
  py: `def search(nums, target):\n    lo, hi = 0, len(nums) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if nums[mid] == target:\n            return mid\n        if nums[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1`,
  complexity: "O(log n) time, O(1) space", explanation: "Keep a window [lo, hi]. Compare the middle with the target and discard the half that cannot contain it.",
});
add({
  id: "move-zeroes", title: "Move Zeroes", difficulty: "EASY", topic: "Two Pointers", skills: ["Algorithms"],
  fn: "move_zeroes", params: ["nums"],
  statement: "Return a new array with all zeros moved to the end while keeping the order of the non-zero elements.",
  constraints: ["0 <= nums.length <= 10^4"],
  hints: ["Collect the non-zero elements in order.", "Fill the rest with zeros."],
  tests: [[[0, 1, 0, 3, 12]], [[0]], [[1, 2, 3]], [[0, 0, 0]], [[]], [[4, 0, 0, 5, 0, 6, 0]], [ints(200, -3, 3)]],
  js: `function move_zeroes(nums) {\n  const out = nums.filter((x) => x !== 0);\n  while (out.length < nums.length) out.push(0);\n  return out;\n}`,
  py: `def move_zeroes(nums):\n    out = [x for x in nums if x != 0]\n    return out + [0] * (len(nums) - len(out))`,
  complexity: "O(n) time, O(n) space", explanation: "Keep the non-zero values in order, then pad with zeros to the original length.",
});
add({
  id: "best-time-to-buy-sell-stock", title: "Best Time to Buy and Sell Stock", difficulty: "EASY", topic: "Arrays & Hashing", skills: ["Algorithms", "Problem Solving"],
  fn: "max_profit", params: ["prices"],
  statement: "`prices[i]` is a stock price on day i. Choose one day to buy and a later day to sell. Return the maximum profit, or `0` if no profit is possible.",
  constraints: ["0 <= prices.length <= 10^5"],
  hints: ["For each day, the best buy is the lowest price before it.", "Track the minimum so far in one pass."],
  tests: [[[7, 1, 5, 3, 6, 4]], [[7, 6, 4, 3, 1]], [[]], [[5]], [[1, 2]], [[2, 4, 1]], [[3, 3, 3]], [ints(300, 1, 500)]],
  js: `function max_profit(prices) {\n  let min = Infinity, best = 0;\n  for (const p of prices) { min = Math.min(min, p); best = Math.max(best, p - min); }\n  return best;\n}`,
  py: `def max_profit(prices):\n    low, best = float('inf'), 0\n    for p in prices:\n        low = min(low, p)\n        best = max(best, p - low)\n    return best`,
  complexity: "O(n) time, O(1) space", explanation: "Walk once, remembering the lowest price so far and the best profit selling today.",
});
add({
  id: "missing-number", title: "Missing Number", difficulty: "EASY", topic: "Math & Bit Tricks", skills: ["Algorithms", "Problem Solving"],
  fn: "missing_number", params: ["nums"],
  statement: "`nums` contains n distinct numbers taken from the range 0 to n. Return the one number in that range that is missing.",
  constraints: ["1 <= n <= 10^4", "All numbers are distinct"],
  hints: ["What is the sum of 0..n?", "Subtract the actual sum."],
  tests: [[[3, 0, 1]], [[0, 1]], [[9, 6, 4, 2, 3, 5, 7, 0, 1]], [[0]], [[1]], [[...Array.from({ length: 1000 }, (_, i) => i).filter((x) => x !== 417)]]],
  js: `function missing_number(nums) {\n  const n = nums.length;\n  return (n * (n + 1)) / 2 - nums.reduce((a, b) => a + b, 0);\n}`,
  py: `def missing_number(nums):\n    n = len(nums)\n    return n * (n + 1) // 2 - sum(nums)`,
  complexity: "O(n) time, O(1) space", explanation: "The sum of 0..n is n(n+1)/2. The difference from the actual sum is the missing number.",
});
add({
  id: "first-unique-character", title: "First Unique Character", difficulty: "EASY", topic: "Strings & Hashing", skills: ["Data Structures"],
  fn: "first_unique_char", params: ["s"],
  statement: "Return the index of the first character in `s` that appears exactly once. If there is none, return `-1`.",
  constraints: ["0 <= s.length <= 10^5", "Lowercase English letters"],
  hints: ["Count every character first.", "Then scan again for the first count of 1."],
  tests: [["leetcode"], ["loveleetcode"], ["aabb"], [""], ["z"], ["abcabcd"], [word(300, "abcdefgh") + "z"]],
  js: `function first_unique_char(s) {\n  const c = {};\n  for (const ch of s) c[ch] = (c[ch] || 0) + 1;\n  for (let i = 0; i < s.length; i++) if (c[s[i]] === 1) return i;\n  return -1;\n}`,
  py: `def first_unique_char(s):\n    from collections import Counter\n    c = Counter(s)\n    for i, ch in enumerate(s):\n        if c[ch] == 1:\n            return i\n    return -1`,
  complexity: "O(n) time, O(1) space", explanation: "Two passes: count occurrences, then find the first character whose count is 1.",
});

// ------------------------------------------------------------------ MEDIUM
add({
  id: "longest-substring-without-repeating", title: "Longest Substring Without Repeating Characters", difficulty: "MEDIUM", topic: "Sliding Window", skills: ["Algorithms", "Problem Solving"],
  fn: "length_of_longest_substring", params: ["s"],
  statement: "Return the length of the longest substring of `s` that contains no repeated characters.",
  constraints: ["0 <= s.length <= 5 * 10^4", "s consists of English letters, digits, symbols and spaces"],
  hints: ["Keep a window that never contains a repeat.", "When a repeat appears, move the left edge past its previous position."],
  tests: [["abcabcbb"], ["bbbbb"], ["pwwkew"], [""], [" "], ["au"], ["dvdf"], ["abba"], [word(400, "abcdefghij")]],
  js: `function length_of_longest_substring(s) {\n  const last = new Map();\n  let left = 0, best = 0;\n  for (let i = 0; i < s.length; i++) {\n    if (last.has(s[i]) && last.get(s[i]) >= left) left = last.get(s[i]) + 1;\n    last.set(s[i], i);\n    best = Math.max(best, i - left + 1);\n  }\n  return best;\n}`,
  py: `def length_of_longest_substring(s):\n    last, left, best = {}, 0, 0\n    for i, ch in enumerate(s):\n        if ch in last and last[ch] >= left:\n            left = last[ch] + 1\n        last[ch] = i\n        best = max(best, i - left + 1)\n    return best`,
  complexity: "O(n) time, O(k) space", explanation: "Sliding window with a map of each character's last index. On a repeat inside the window, jump the left edge past it.",
});
add({
  id: "group-anagrams", title: "Group Anagrams", difficulty: "MEDIUM", topic: "Arrays & Hashing", skills: ["Data Structures", "Algorithms"],
  fn: "group_anagrams", params: ["strs"], compare: "unordered-deep",
  statement: "Group the strings in `strs` so that anagrams are together. Return a list of groups. The order of the groups and of the words inside a group does not matter.",
  constraints: ["0 <= strs.length <= 10^4", "Lowercase English letters"],
  hints: ["Anagrams share the same sorted letters.", "Use the sorted word as a hash map key."],
  tests: [[["eat", "tea", "tan", "ate", "nat", "bat"]], [[""]], [["a"]], [[]], [["abc", "bca", "cab", "xyz", "zyx", "x"]], [["ab", "ba", "ab", "ba"]], [Array.from({ length: 120 }, () => word(4, "abc"))]],
  js: `function group_anagrams(strs) {\n  const m = new Map();\n  for (const w of strs) {\n    const k = [...w].sort().join("");\n    if (!m.has(k)) m.set(k, []);\n    m.get(k).push(w);\n  }\n  return [...m.values()];\n}`,
  py: `def group_anagrams(strs):\n    m = {}\n    for w in strs:\n        m.setdefault("".join(sorted(w)), []).append(w)\n    return list(m.values())`,
  complexity: "O(n * k log k) time", explanation: "Sort each word's letters to get a key shared by all its anagrams, and bucket words by that key.",
});
add({
  id: "product-of-array-except-self", title: "Product of Array Except Self", difficulty: "MEDIUM", topic: "Arrays & Hashing", skills: ["Algorithms", "Problem Solving"],
  fn: "product_except_self", params: ["nums"],
  statement: "Return an array `answer` where `answer[i]` is the product of every element of `nums` except `nums[i]`. Do not use division. Aim for O(n) time.",
  constraints: ["2 <= nums.length <= 10^5", "The product of any prefix or suffix fits in a 32-bit integer"],
  hints: ["Product of everything to the left times everything to the right.", "Two passes: prefix products then suffix products."],
  tests: [[[1, 2, 3, 4]], [[-1, 1, 0, -3, 3]], [[2, 3]], [[0, 0]], [[1, 1, 1, 1]], [[5, -2, 4]], [ints(14, -3, 3)]],
  js: `function product_except_self(nums) {\n  const n = nums.length, out = new Array(n).fill(1);\n  let left = 1;\n  for (let i = 0; i < n; i++) { out[i] = left; left *= nums[i]; }\n  let right = 1;\n  for (let i = n - 1; i >= 0; i--) { out[i] *= right; right *= nums[i]; }\n  return out;\n}`,
  py: `def product_except_self(nums):\n    n = len(nums)\n    out = [1] * n\n    left = 1\n    for i in range(n):\n        out[i] = left\n        left *= nums[i]\n    right = 1\n    for i in range(n - 1, -1, -1):\n        out[i] *= right\n        right *= nums[i]\n    return out`,
  complexity: "O(n) time, O(1) extra space", explanation: "First pass stores the product of everything to the left; second pass multiplies in everything to the right.",
});
add({
  id: "container-with-most-water", title: "Container With Most Water", difficulty: "MEDIUM", topic: "Two Pointers", skills: ["Algorithms", "Problem Solving"],
  fn: "max_area", params: ["height"],
  statement: "`height[i]` is the height of a vertical line at position i. Choose two lines that, with the x-axis, hold the most water. Return that maximum area (width between the lines times the shorter height).",
  constraints: ["2 <= height.length <= 10^5", "0 <= height[i] <= 10^4"],
  hints: ["Start with the widest container.", "Moving the taller line inwards can never help; move the shorter one."],
  tests: [[[1, 8, 6, 2, 5, 4, 8, 3, 7]], [[1, 1]], [[4, 3, 2, 1, 4]], [[1, 2, 1]], [[0, 0, 0]], [[2, 3, 4, 5, 18, 17, 6]], [ints(300, 0, 1000)]],
  js: `function max_area(height) {\n  let i = 0, j = height.length - 1, best = 0;\n  while (i < j) {\n    best = Math.max(best, (j - i) * Math.min(height[i], height[j]));\n    if (height[i] < height[j]) i++; else j--;\n  }\n  return best;\n}`,
  py: `def max_area(height):\n    i, j, best = 0, len(height) - 1, 0\n    while i < j:\n        best = max(best, (j - i) * min(height[i], height[j]))\n        if height[i] < height[j]:\n            i += 1\n        else:\n            j -= 1\n    return best`,
  complexity: "O(n) time, O(1) space", explanation: "Two pointers from both ends. The shorter line limits the area, so only moving it can improve the result.",
});
add({
  id: "three-sum", title: "3Sum", difficulty: "MEDIUM", topic: "Two Pointers", skills: ["Algorithms", "Problem Solving"],
  fn: "three_sum", params: ["nums"], compare: "unordered-deep",
  statement: "Return all unique triplets `[a, b, c]` in `nums` such that a + b + c = 0. The result must not contain duplicate triplets. Order does not matter.",
  constraints: ["0 <= nums.length <= 3000"],
  hints: ["Sort first.", "Fix one number, then use two pointers for the other two; skip duplicates."],
  tests: [[[-1, 0, 1, 2, -1, -4]], [[0, 1, 1]], [[0, 0, 0]], [[0, 0, 0, 0]], [[]], [[-2, 0, 1, 1, 2]], [[-4, -2, -2, -2, 0, 1, 2, 2, 2, 3, 3, 4, 4, 6, 6]], [ints(60, -10, 10)]],
  js: `function three_sum(nums) {\n  const a = [...nums].sort((x, y) => x - y), out = [];\n  for (let i = 0; i < a.length - 2; i++) {\n    if (i > 0 && a[i] === a[i - 1]) continue;\n    let l = i + 1, r = a.length - 1;\n    while (l < r) {\n      const s = a[i] + a[l] + a[r];\n      if (s < 0) l++;\n      else if (s > 0) r--;\n      else { out.push([a[i], a[l], a[r]]); l++; r--; while (l < r && a[l] === a[l - 1]) l++; while (l < r && a[r] === a[r + 1]) r--; }\n    }\n  }\n  return out;\n}`,
  py: `def three_sum(nums):\n    a = sorted(nums)\n    out = []\n    for i in range(len(a) - 2):\n        if i > 0 and a[i] == a[i - 1]:\n            continue\n        l, r = i + 1, len(a) - 1\n        while l < r:\n            s = a[i] + a[l] + a[r]\n            if s < 0:\n                l += 1\n            elif s > 0:\n                r -= 1\n            else:\n                out.append([a[i], a[l], a[r]])\n                l += 1\n                r -= 1\n                while l < r and a[l] == a[l - 1]:\n                    l += 1\n                while l < r and a[r] == a[r + 1]:\n                    r -= 1\n    return out`,
  complexity: "O(n^2) time", explanation: "Sort, fix the first number, and sweep two pointers over the rest, skipping repeated values to avoid duplicate triplets.",
});
add({
  id: "coin-change", title: "Coin Change", difficulty: "MEDIUM", topic: "Dynamic Programming", skills: ["Algorithms", "Problem Solving"],
  fn: "coin_change", params: ["coins", "amount"],
  statement: "Given coin denominations `coins` (unlimited supply of each) and a target `amount`, return the fewest coins that make exactly that amount, or `-1` if it is impossible.",
  constraints: ["1 <= coins.length <= 12", "0 <= amount <= 10^4"],
  hints: ["Let best[x] be the fewest coins for amount x.", "best[x] = 1 + min(best[x - c]) over coins c."],
  tests: [[[1, 2, 5], 11], [[1, 3, 4], 6], [[1, 5, 10, 12], 15], [[2], 3], [[1], 0], [[1], 2], [[186, 419, 83, 408], 6249], [[2, 5, 10, 1], 27], [[5, 7], 23], [[3, 7, 405, 436], 8839]],
  js: `function coin_change(coins, amount) {\n  const best = new Array(amount + 1).fill(Infinity);\n  best[0] = 0;\n  for (let x = 1; x <= amount; x++)\n    for (const c of coins) if (c <= x && best[x - c] + 1 < best[x]) best[x] = best[x - c] + 1;\n  return best[amount] === Infinity ? -1 : best[amount];\n}`,
  py: `def coin_change(coins, amount):\n    INF = float('inf')\n    best = [0] + [INF] * amount\n    for x in range(1, amount + 1):\n        for c in coins:\n            if c <= x and best[x - c] + 1 < best[x]:\n                best[x] = best[x - c] + 1\n    return -1 if best[amount] == INF else best[amount]`,
  complexity: "O(amount * coins) time, O(amount) space", explanation: "Bottom-up DP over amounts. Greedy fails (for example coins 1, 3, 4 and amount 6), so every coin is tried for every amount.",
});
add({
  id: "number-of-islands", title: "Number of Islands", difficulty: "MEDIUM", topic: "Graphs (BFS/DFS)", skills: ["Algorithms", "Data Structures"],
  fn: "num_islands", params: ["grid"],
  statement: "`grid` is a 2D array of 0 (water) and 1 (land). An island is a group of land cells connected horizontally or vertically. Return the number of islands.",
  constraints: ["0 <= rows, columns <= 300", "Cells are 0 or 1"],
  hints: ["When you find land, flood-fill the whole island.", "Mark visited cells so they are not counted again."],
  tests: [[[[1, 1, 1, 1, 0], [1, 1, 0, 1, 0], [1, 1, 0, 0, 0], [0, 0, 0, 0, 0]]], [[[1, 1, 0, 0, 0], [1, 1, 0, 0, 0], [0, 0, 1, 0, 0], [0, 0, 0, 1, 1]]], [[]], [[[0]]], [[[1]]], [[[1, 0, 1], [0, 1, 0], [1, 0, 1]]], [Array.from({ length: 40 }, () => ints(40, 0, 1))]],
  js: `function num_islands(grid) {\n  const g = grid.map((r) => [...r]);\n  let count = 0;\n  for (let r = 0; r < g.length; r++) for (let c = 0; c < g[r].length; c++) {\n    if (g[r][c] !== 1) continue;\n    count++;\n    const stack = [[r, c]];\n    g[r][c] = 0;\n    while (stack.length) {\n      const [y, x] = stack.pop();\n      for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {\n        const ny = y + dy, nx = x + dx;\n        if (ny >= 0 && ny < g.length && nx >= 0 && nx < g[ny].length && g[ny][nx] === 1) { g[ny][nx] = 0; stack.push([ny, nx]); }\n      }\n    }\n  }\n  return count;\n}`,
  py: `def num_islands(grid):\n    g = [row[:] for row in grid]\n    count = 0\n    for r in range(len(g)):\n        for c in range(len(g[r])):\n            if g[r][c] != 1:\n                continue\n            count += 1\n            g[r][c] = 0\n            stack = [(r, c)]\n            while stack:\n                y, x = stack.pop()\n                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):\n                    ny, nx = y + dy, x + dx\n                    if 0 <= ny < len(g) and 0 <= nx < len(g[ny]) and g[ny][nx] == 1:\n                        g[ny][nx] = 0\n                        stack.append((ny, nx))\n    return count`,
  complexity: "O(rows * cols) time", explanation: "Scan the grid. Each unvisited land cell starts a new island; flood-fill (DFS with an explicit stack) to erase it.",
});
add({
  id: "merge-intervals", title: "Merge Intervals", difficulty: "MEDIUM", topic: "Sorting & Intervals", skills: ["Algorithms"],
  fn: "merge_intervals", params: ["intervals"],
  statement: "Merge all overlapping intervals `[start, end]` (touching intervals such as [1,4] and [4,5] overlap). Return the merged intervals sorted by start.",
  constraints: ["0 <= intervals.length <= 10^4", "start <= end"],
  hints: ["Sort by start.", "Compare each interval with the last merged one."],
  tests: [[[[1, 3], [2, 6], [8, 10], [15, 18]]], [[[1, 4], [4, 5]]], [[]], [[[1, 4]]], [[[1, 10], [2, 3], [4, 5]]], [[[5, 6], [1, 2], [3, 4]]], [[[2, 3], [4, 5], [6, 7], [8, 9], [1, 10]]], [Array.from({ length: 80 }, () => { const s = rnd(200); return [s, s + rnd(6)]; })]],
  js: `function merge_intervals(intervals) {\n  const a = intervals.map((x) => [...x]).sort((p, q) => p[0] - q[0]);\n  const out = [];\n  for (const cur of a) {\n    const last = out[out.length - 1];\n    if (last && cur[0] <= last[1]) last[1] = Math.max(last[1], cur[1]);\n    else out.push(cur);\n  }\n  return out;\n}`,
  py: `def merge_intervals(intervals):\n    out = []\n    for s, e in sorted(intervals):\n        if out and s <= out[-1][1]:\n            out[-1][1] = max(out[-1][1], e)\n        else:\n            out.append([s, e])\n    return out`,
  complexity: "O(n log n) time", explanation: "Sort by start, then extend the last merged interval whenever the next one starts inside it.",
});
add({
  id: "top-k-frequent-elements", title: "Top K Frequent Elements", difficulty: "MEDIUM", topic: "Arrays & Hashing", skills: ["Data Structures", "Algorithms"],
  fn: "top_k_frequent", params: ["nums", "k"], compare: "unordered",
  statement: "Return the `k` most frequent values in `nums`, in any order. The answer is guaranteed to be unique (no ties at the cut-off).",
  constraints: ["1 <= k <= number of distinct values"],
  hints: ["Count frequencies first.", "Sort the distinct values by count, or use a bucket per count."],
  tests: [[[1, 1, 1, 2, 2, 3], 2], [[1], 1], [[4, 4, 4, 4, 5, 5, 5, 6, 6, 7], 3], [[-1, -1, 2, 2, 2, 3], 1], [[5, 3, 3, 1, 1, 1, 5, 5, 5, 9], 2], [[...Array(40).fill(7), ...Array(25).fill(8), ...Array(10).fill(9), ...Array(3).fill(10), 11], 3]],
  js: `function top_k_frequent(nums, k) {\n  const c = new Map();\n  for (const x of nums) c.set(x, (c.get(x) || 0) + 1);\n  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map((e) => e[0]);\n}`,
  py: `def top_k_frequent(nums, k):\n    from collections import Counter\n    return [x for x, _ in Counter(nums).most_common(k)]`,
  complexity: "O(n log n) time (O(n) with buckets)", explanation: "Count occurrences, order distinct values by count and take the first k.",
});
add({
  id: "longest-palindromic-substring-length", title: "Longest Palindromic Substring (Length)", difficulty: "MEDIUM", topic: "Strings & Hashing", skills: ["Algorithms", "Problem Solving"],
  fn: "longest_palindrome_length", params: ["s"],
  statement: "Return the length of the longest palindromic substring of `s`.",
  constraints: ["1 <= s.length <= 1000", "Letters and digits"],
  hints: ["Every palindrome has a centre.", "Expand outwards from each of the 2n-1 centres."],
  tests: [["babad"], ["cbbd"], ["a"], ["ac"], ["aaaa"], ["forgeeksskeegfor"], ["abacdfgdcaba"], [word(200, "ab")]],
  js: `function longest_palindrome_length(s) {\n  let best = 0;\n  const grow = (l, r) => { while (l >= 0 && r < s.length && s[l] === s[r]) { l--; r++; } return r - l - 1; };\n  for (let i = 0; i < s.length; i++) best = Math.max(best, grow(i, i), grow(i, i + 1));\n  return best;\n}`,
  py: `def longest_palindrome_length(s):\n    best = 0\n    def grow(l, r):\n        while l >= 0 and r < len(s) and s[l] == s[r]:\n            l -= 1\n            r += 1\n        return r - l - 1\n    for i in range(len(s)):\n        best = max(best, grow(i, i), grow(i, i + 1))\n    return best`,
  complexity: "O(n^2) time, O(1) space", explanation: "Expand around every odd and even centre while the characters match, and keep the longest span.",
});
add({
  id: "maximum-subarray", title: "Maximum Subarray", difficulty: "MEDIUM", topic: "Dynamic Programming", skills: ["Algorithms", "Problem Solving"],
  fn: "max_sub_array", params: ["nums"],
  statement: "Return the largest sum of any non-empty contiguous subarray of `nums`.",
  constraints: ["1 <= nums.length <= 10^5"],
  hints: ["At each position, either extend the previous subarray or start fresh.", "That is Kadane's algorithm."],
  tests: [[[-2, 1, -3, 4, -1, 2, 1, -5, 4]], [[1]], [[5, 4, -1, 7, 8]], [[-3, -2, -5]], [[-1]], [[0, 0, 0]], [[2, -1, 2, -1, 2]], [ints(400, -50, 50)]],
  js: `function max_sub_array(nums) {\n  let cur = nums[0], best = nums[0];\n  for (let i = 1; i < nums.length; i++) { cur = Math.max(nums[i], cur + nums[i]); best = Math.max(best, cur); }\n  return best;\n}`,
  py: `def max_sub_array(nums):\n    cur = best = nums[0]\n    for x in nums[1:]:\n        cur = max(x, cur + x)\n        best = max(best, cur)\n    return best`,
  complexity: "O(n) time, O(1) space", explanation: "Kadane: the best subarray ending here is either this element alone or this element plus the best ending at the previous one.",
});
add({
  id: "rotate-array", title: "Rotate Array", difficulty: "MEDIUM", topic: "Arrays & Hashing", skills: ["Algorithms"],
  fn: "rotate", params: ["nums", "k"],
  statement: "Return a new array equal to `nums` rotated to the right by `k` steps. For example `[1,2,3,4,5]` rotated by 2 is `[4,5,1,2,3]`.",
  constraints: ["0 <= nums.length <= 10^5", "0 <= k <= 10^9"],
  hints: ["Rotating by the length changes nothing: use k modulo the length.", "The last k elements move to the front."],
  tests: [[[1, 2, 3, 4, 5, 6, 7], 3], [[-1, -100, 3, 99], 2], [[1], 5], [[], 3], [[1, 2], 0], [[1, 2, 3], 3], [[1, 2, 3], 1000000000], [ints(50, 0, 99), 17]],
  js: `function rotate(nums, k) {\n  const n = nums.length;\n  if (n === 0) return [];\n  const s = k % n;\n  return s === 0 ? [...nums] : [...nums.slice(n - s), ...nums.slice(0, n - s)];\n}`,
  py: `def rotate(nums, k):\n    n = len(nums)\n    if n == 0:\n        return []\n    s = k % n\n    return nums[n - s:] + nums[:n - s] if s else nums[:]`,
  complexity: "O(n) time, O(n) space", explanation: "Reduce k modulo n; the last k elements become the front of the result.",
});

// ------------------------------------------------------------------ HARD
add({
  id: "trapping-rain-water", title: "Trapping Rain Water", difficulty: "HARD", topic: "Two Pointers", skills: ["Algorithms", "Problem Solving"],
  fn: "trap", params: ["height"],
  statement: "`height[i]` is the height of a bar of width 1. After raining, how many units of water are trapped between the bars?",
  constraints: ["0 <= height.length <= 2 * 10^4", "0 <= height[i] <= 10^5"],
  hints: ["Water above a bar is min(tallest to the left, tallest to the right) minus its height.", "Two pointers with running left and right maxima avoid extra arrays."],
  tests: [[[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], [[4, 2, 0, 3, 2, 5]], [[]], [[3]], [[1, 2, 3]], [[3, 0, 3]], [[5, 4, 1, 2]], [ints(300, 0, 40)]],
  js: `function trap(height) {\n  let l = 0, r = height.length - 1, lm = 0, rm = 0, water = 0;\n  while (l < r) {\n    if (height[l] < height[r]) { lm = Math.max(lm, height[l]); water += lm - height[l]; l++; }\n    else { rm = Math.max(rm, height[r]); water += rm - height[r]; r--; }\n  }\n  return water;\n}`,
  py: `def trap(height):\n    l, r = 0, len(height) - 1\n    lm = rm = water = 0\n    while l < r:\n        if height[l] < height[r]:\n            lm = max(lm, height[l])\n            water += lm - height[l]\n            l += 1\n        else:\n            rm = max(rm, height[r])\n            water += rm - height[r]\n            r -= 1\n    return water`,
  complexity: "O(n) time, O(1) space", explanation: "The shorter side bounds the water. Move that pointer inwards, adding what its running maximum exceeds the bar by.",
});
add({
  id: "edit-distance", title: "Edit Distance", difficulty: "HARD", topic: "Dynamic Programming", skills: ["Algorithms", "Problem Solving"],
  fn: "min_distance", params: ["word1", "word2"],
  statement: "Return the minimum number of single-character operations (insert, delete, replace) needed to turn `word1` into `word2`.",
  constraints: ["0 <= word1.length, word2.length <= 500", "Lowercase English letters"],
  hints: ["Let dp[i][j] be the distance between the first i letters of word1 and the first j of word2.", "If the letters match, copy dp[i-1][j-1]; otherwise 1 + the best of the three neighbours."],
  tests: [["horse", "ros"], ["intention", "execution"], ["", ""], ["", "abc"], ["abc", ""], ["same", "same"], ["kitten", "sitting"], [word(60, "abc"), word(55, "abc")]],
  js: `function min_distance(a, b) {\n  const n = a.length, m = b.length;\n  let prev = Array.from({ length: m + 1 }, (_, j) => j);\n  for (let i = 1; i <= n; i++) {\n    const cur = [i];\n    for (let j = 1; j <= m; j++)\n      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);\n    prev = cur;\n  }\n  return prev[m];\n}`,
  py: `def min_distance(a, b):\n    n, m = len(a), len(b)\n    prev = list(range(m + 1))\n    for i in range(1, n + 1):\n        cur = [i] + [0] * m\n        for j in range(1, m + 1):\n            if a[i - 1] == b[j - 1]:\n                cur[j] = prev[j - 1]\n            else:\n                cur[j] = 1 + min(prev[j - 1], prev[j], cur[j - 1])\n        prev = cur\n    return prev[m]`,
  complexity: "O(n * m) time, O(m) space", explanation: "Classic 2D DP, keeping only the previous row. Replace, delete and insert correspond to the diagonal, upper and left neighbours.",
});

// ================================================================== build and verify
const canonical = (v, mode) => {
  const deep = (x) => (Array.isArray(x) ? x.map(deep) : x);
  if (mode === "unordered") return Array.isArray(v) ? [...v].sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1)) : v;
  if (mode === "unordered-deep") {
    const rec = (x) => (Array.isArray(x) ? x.map(rec).sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1)) : x);
    return rec(v);
  }
  return deep(v);
};
const same = (a, b, mode) => JSON.stringify(canonical(a, mode)) === JSON.stringify(canonical(b, mode));

const dir = mkdtempSync(join(tmpdir(), "pw-coding-"));
let failures = 0;
const publicOut = [], solutions = {};
const ids = new Set();
for (const p of P) {
  if (ids.has(p.id)) throw new Error("duplicate id " + p.id);
  ids.add(p.id);
  const compare = p.compare ?? "exact";
  const jsFn = new Function(`${p.js}\nreturn ${p.fn};`)();
  const tests = p.tests.map((args) => ({ args, expected: jsFn(...structuredClone(args)) }));
  if (tests.length < 6) { console.log(`FAIL ${p.id}: needs at least 6 tests`); failures++; }
  // independent Python check
  const runner = `import json,sys\n${p.py}\nd=json.load(sys.stdin)\nprint(json.dumps([${p.fn}(*a) for a in d]))\n`;
  const file = join(dir, `${p.id}.py`);
  writeFileSync(file, runner);
  const r = spawnSync("python", [file], { input: JSON.stringify(tests.map((t) => t.args)), encoding: "utf8" });
  if (r.status !== 0) { console.log(`FAIL ${p.id}: python error ${r.stderr.split("\n").slice(-3).join(" ")}`); failures++; continue; }
  const py = JSON.parse(r.stdout);
  tests.forEach((t, i) => { if (!same(py[i], t.expected, compare)) { console.log(`FAIL ${p.id} test ${i}: js=${JSON.stringify(t.expected).slice(0, 80)} py=${JSON.stringify(py[i]).slice(0, 80)}`); failures++; } });
  // sanity: a few distinct answers (a constant function should not pass everything)
  const distinct = new Set(tests.map((t) => JSON.stringify(canonical(t.expected, compare)))).size;
  if (distinct < 2) { console.log(`FAIL ${p.id}: only ${distinct} distinct expected outputs`); failures++; }
  const snake = p.params.join(", ");
  publicOut.push({
    id: p.id, title: p.title, difficulty: p.difficulty, topic: p.topic, skills: p.skills,
    fn: p.fn, params: p.params, compare, statement: p.statement, constraints: p.constraints, hints: p.hints,
    starter: { javascript: `function ${p.fn}(${snake}) {\n  // write your solution here\n}\n`, python: `def ${p.fn}(${snake}):\n    # write your solution here\n    pass\n` },
    tests,
  });
  solutions[p.id] = { javascript: p.js, python: p.py, complexity: p.complexity, explanation: p.explanation };
}
rmSync(dir, { recursive: true, force: true });
if (failures) { console.log(`\n${failures} problem(s) FAILED verification; nothing written`); process.exit(1); }
writeFileSync("packages/content/src/coding-problems.json", JSON.stringify(publicOut));
writeFileSync("packages/content/src/coding-solutions.json", JSON.stringify(solutions, null, 1));
const bytes = JSON.stringify(publicOut).length;
console.log(`OK: ${publicOut.length} problems, ${publicOut.reduce((s, p) => s + p.tests.length, 0)} tests verified by two independent implementations; coding-problems.json ${Math.round(bytes / 1024)} KB`);
