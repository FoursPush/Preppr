export interface LeetCodeExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface LeetCodeProblem {
  id: string;
  number?: number;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard" | string;
  category: string;
  acceptance?: string;
  description: string;
  examples: LeetCodeExample[];
  constraints?: string[];
  starterCode: Record<string, string>;
  hints?: string[];
}

export function isTechRole(roleName?: string, category?: string): boolean {
  if (!roleName && !category) return false;
  const combined = `${roleName || ""} ${category || ""}`.toLowerCase();
  const techKeywords = [
    "tech",
    "software",
    "engineer",
    "developer",
    "backend",
    "frontend",
    "fullstack",
    "full stack",
    "systems",
    "architect",
    "data scientist",
    "data engineer",
    "ml",
    "ai",
    "devops",
    "cloud",
    "programmer",
    "coder",
  ];
  return techKeywords.some((keyword) => combined.includes(keyword));
}

export const LEETCODE_PROBLEMS: LeetCodeProblem[] = [
  // Easy
  {
    id: "two-sum",
    number: 1,
    title: "Two Sum",
    difficulty: "Easy",
    category: "Arrays & Hashing",
    acceptance: "52.8%",
    description:
      "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.",
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "[0,1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1].",
      },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
    ],
    starterCode: {
      python:
        "class Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n        # Write your code here\n        pass\n",
      javascript:
        "/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nvar twoSum = function(nums, target) {\n    // Write your code here\n};\n",
      typescript:
        "function twoSum(nums: number[], target: number): number[] {\n    // Write your code here\n    return [];\n}\n",
      java: "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your code here\n        return new int[]{};\n    }\n}\n",
      cpp: "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Write your code here\n        return {};\n    }\n};\n",
      go: "func twoSum(nums []int, target int) []int {\n    // Write your code here\n    return nil\n}\n",
    },
    hints: [
      "Can you do this in a single pass?",
      "Think about storing seen elements and their indices in a Hash Map.",
    ],
  },
  {
    id: "valid-parentheses",
    number: 20,
    title: "Valid Parentheses",
    difficulty: "Easy",
    category: "Stack",
    acceptance: "40.3%",
    description:
      "Given a string `s` containing just the characters `'('`, `')'`, `'{'`, `'}'`, `'['` and `']'`, determine if the input string is valid.\n\nOpen brackets must be closed by the same type of brackets and in the correct order.",
    examples: [
      { input: 's = "()[]{}"', output: "true" },
      { input: 's = "(]"', output: "false" },
    ],
    constraints: [
      "1 <= s.length <= 10^4",
      "s consists of parentheses only '()[]{}'.",
    ],
    starterCode: {
      python:
        "class Solution:\n    def isValid(self, s: str) -> bool:\n        # Write your code here\n        pass\n",
      javascript:
        "/**\n * @param {string} s\n * @return {boolean}\n */\nvar isValid = function(s) {\n    // Write your code here\n};\n",
      typescript:
        "function isValid(s: string): boolean {\n    // Write your code here\n    return false;\n}\n",
      java: "class Solution {\n    public boolean isValid(String s) {\n        // Write your code here\n        return false;\n    }\n}\n",
      cpp: "class Solution {\npublic:\n    bool isValid(string s) {\n        // Write your code here\n        return false;\n    }\n};\n",
      go: "func isValid(s string) bool {\n    // Write your code here\n    return false\n}\n",
    },
    hints: [
      "Use a stack to track matching open brackets.",
      "Ensure the stack is empty at completion.",
    ],
  },
  {
    id: "best-time-stock",
    number: 121,
    title: "Best Time to Buy and Sell Stock",
    difficulty: "Easy",
    category: "Arrays & Hashing",
    acceptance: "54.1%",
    description:
      "You are given an array `prices` where `prices[i]` is the price of a given stock on the `i`th day.\n\nYou want to maximize your profit by choosing a single day to buy and a future day to sell.\n\nReturn the maximum profit you can achieve. If you cannot achieve any profit, return 0.",
    examples: [
      {
        input: "prices = [7,1,5,3,6,4]",
        output: "5",
        explanation:
          "Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6-1 = 5.",
      },
      {
        input: "prices = [7,6,4,3,1]",
        output: "0",
        explanation: "In this case, no transactions are done and the max profit = 0.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^4"],
    starterCode: {
      python:
        "class Solution:\n    def maxProfit(self, prices: list[int]) -> int:\n        # Write your code here\n        pass\n",
      javascript:
        "/**\n * @param {number[]} prices\n * @return {number}\n */\nvar maxProfit = function(prices) {\n    // Write your code here\n};\n",
      typescript:
        "function maxProfit(prices: number[]): number {\n    // Write your code here\n    return 0;\n}\n",
      java: "class Solution {\n    public int maxProfit(int[] prices) {\n        // Write your code here\n        return 0;\n    }\n}\n",
      cpp: "class Solution {\npublic:\n    int maxProfit(vector<int>& prices) {\n        // Write your code here\n        return 0;\n    }\n};\n",
      go: "func maxProfit(prices []int) int {\n    // Write your code here\n    return 0\n}\n",
    },
    hints: [
      "Track the minimum price seen so far in a single pass.",
      "Calculate current price minus min price.",
    ],
  },

  // Medium
  {
    id: "longest-substring",
    number: 3,
    title: "Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    category: "Sliding Window",
    acceptance: "34.5%",
    description:
      "Given a string `s`, find the length of the longest substring without repeating characters.",
    examples: [
      {
        input: 's = "abcabcbb"',
        output: "3",
        explanation: 'The answer is "abc", with the length of 3.',
      },
      {
        input: 's = "bbbbb"',
        output: "1",
        explanation: 'The answer is "b", with length 1.',
      },
      {
        input: 's = "pwwkew"',
        output: "3",
        explanation: 'The answer is "wke", with length 3.',
      },
    ],
    constraints: [
      "0 <= s.length <= 5 * 10^4",
      "s consists of English letters, digits, symbols and spaces.",
    ],
    starterCode: {
      python:
        "class Solution:\n    def lengthOfLongestSubstring(self, s: str) -> int:\n        # Write your code here\n        pass\n",
      javascript:
        "/**\n * @param {string} s\n * @return {number}\n */\nvar lengthOfLongestSubstring = function(s) {\n    // Write your code here\n};\n",
      typescript:
        "function lengthOfLongestSubstring(s: string): number {\n    // Write your code here\n    return 0;\n}\n",
      java: "class Solution {\n    public int lengthOfLongestSubstring(String s) {\n        // Write your code here\n        return 0;\n    }\n}\n",
      cpp: "class Solution {\npublic:\n    int lengthOfLongestSubstring(string s) {\n        // Write your code here\n        return 0;\n    }\n};\n",
      go: "func lengthOfLongestSubstring(s string) int {\n    // Write your code here\n    return 0\n}\n",
    },
    hints: [
      "Sliding window with two pointers [left, right].",
      "Store the latest index of each character to skip duplicate regions.",
    ],
  },
  {
    id: "coin-change",
    number: 322,
    title: "Coin Change",
    difficulty: "Medium",
    category: "Dynamic Programming",
    acceptance: "43.2%",
    description:
      "You are given an integer array `coins` representing coins of different denominations and an integer `amount` representing a total amount of money.\n\nReturn the fewest number of coins that you need to make up that amount. If that amount cannot be made up, return -1.",
    examples: [
      { input: "coins = [1,2,5], amount = 11", output: "3", explanation: "11 = 5 + 5 + 1" },
      { input: "coins = [2], amount = 3", output: "-1" },
      { input: "coins = [1], amount = 0", output: "0" },
    ],
    constraints: [
      "1 <= coins.length <= 12",
      "1 <= coins[i] <= 2^31 - 1",
      "0 <= amount <= 10^4",
    ],
    starterCode: {
      python:
        "class Solution:\n    def coinChange(self, coins: list[int], amount: int) -> int:\n        # Write your code here\n        pass\n",
      javascript:
        "/**\n * @param {number[]} coins\n * @param {number} amount\n * @return {number}\n */\nvar coinChange = function(coins, amount) {\n    // Write your code here\n};\n",
      typescript:
        "function coinChange(coins: number[], amount: number): number {\n    // Write your code here\n    return -1;\n}\n",
      java: "class Solution {\n    public int coinChange(int[] coins, int amount) {\n        // Write your code here\n        return -1;\n    }\n}\n",
      cpp: "class Solution {\npublic:\n    int coinChange(vector<int>& coins, int amount) {\n        // Write your code here\n        return -1;\n    }\n};\n",
      go: "func coinChange(coins []int, amount int) int {\n    // Write your code here\n    return -1\n}\n",
    },
    hints: [
      "Bottom-up dynamic programming: dp[i] = min coins to make amount i.",
      "dp[i] = min(dp[i - c] + 1) for each coin c.",
    ],
  },
  {
    id: "product-except-self",
    number: 238,
    title: "Product of Array Except Self",
    difficulty: "Medium",
    category: "Arrays & Hashing",
    acceptance: "65.4%",
    description:
      "Given an integer array `nums`, return an array `answer` such that `answer[i]` is equal to the product of all the elements of `nums` except `nums[i]`.\n\nThe algorithm must run in O(n) time and without using the division operation.",
    examples: [
      { input: "nums = [1,2,3,4]", output: "[24,12,8,6]" },
      { input: "nums = [-1,1,0,-3,3]", output: "[0,0,9,0,0]" },
    ],
    constraints: ["2 <= nums.length <= 10^5", "-30 <= nums[i] <= 30"],
    starterCode: {
      python:
        "class Solution:\n    def productExceptSelf(self, nums: list[int]) -> list[int]:\n        # Write your code here\n        pass\n",
      javascript:
        "/**\n * @param {number[]} nums\n * @return {number[]}\n */\nvar productExceptSelf = function(nums) {\n    // Write your code here\n};\n",
      typescript:
        "function productExceptSelf(nums: number[]): number[] {\n    // Write your code here\n    return [];\n}\n",
      java: "class Solution {\n    public int[] productExceptSelf(int[] nums) {\n        // Write your code here\n        return new int[]{};\n    }\n}\n",
      cpp: "class Solution {\npublic:\n    vector<int> productExceptSelf(vector<int>& nums) {\n        // Write your code here\n        return {};\n    }\n};\n",
      go: "func productExceptSelf(nums []int) []int {\n    // Write your code here\n    return nil\n}\n",
    },
    hints: [
      "Use prefix products in a forward pass and postfix products in a backward pass.",
      "Can be done in O(1) auxiliary space using output array.",
    ],
  },

  // Hard
  {
    id: "trapping-rain-water",
    number: 42,
    title: "Trapping Rain Water",
    difficulty: "Hard",
    category: "Two Pointers",
    acceptance: "60.2%",
    description:
      "Given `n` non-negative integers representing an elevation map where the width of each bar is `1`, compute how much water it can trap after raining.",
    examples: [
      {
        input: "height = [0,1,0,2,1,0,1,3,2,1,2,1]",
        output: "6",
        explanation: "The elevation map traps 6 units of rain water.",
      },
      { input: "height = [4,2,0,3,2,5]", output: "9" },
    ],
    constraints: [
      "n == height.length",
      "1 <= n <= 2 * 10^4",
      "0 <= height[i] <= 10^5",
    ],
    starterCode: {
      python:
        "class Solution:\n    def trap(self, height: list[int]) -> int:\n        # Write your code here\n        pass\n",
      javascript:
        "/**\n * @param {number[]} height\n * @return {number}\n */\nvar trap = function(height) {\n    // Write your code here\n};\n",
      typescript:
        "function trap(height: number[]): number {\n    // Write your code here\n    return 0;\n}\n",
      java: "class Solution {\n    public int trap(int[] height) {\n        // Write your code here\n        return 0;\n    }\n}\n",
      cpp: "class Solution {\npublic:\n    int trap(vector<int>& height) {\n        // Write your code here\n        return 0;\n    }\n};\n",
      go: "func trap(height []int) int {\n    // Write your code here\n    return 0\n}\n",
    },
    hints: [
      "Use Two Pointers: water trapped depends on the bottleneck (min(leftMax, rightMax)).",
      "Advance the pointer with the smaller max.",
    ],
  },
  {
    id: "merge-k-sorted-lists",
    number: 23,
    title: "Merge k Sorted Lists",
    difficulty: "Hard",
    category: "Heap & Divide and Conquer",
    acceptance: "51.2%",
    description:
      "You are given an array of `k` linked-lists `lists`, each linked-list is sorted in ascending order.\n\nMerge all the linked-lists into one sorted linked-list and return it.",
    examples: [
      {
        input: "lists = [[1,4,5],[1,3,4],[2,6]]",
        output: "[1,1,2,3,4,4,5,6]",
      },
      { input: "lists = []", output: "[]" },
      { input: "lists = [[]]", output: "[]" },
    ],
    constraints: [
      "k == lists.length",
      "0 <= k <= 10^4",
      "0 <= lists[i].length <= 500",
      "-10^4 <= lists[i][j] <= 10^4",
    ],
    starterCode: {
      python:
        "# Definition for singly-linked list.\n# class ListNode:\n#     def __init__(self, val=0, next=None):\n#         self.val = val\n#         self.next = next\nclass Solution:\n    def mergeKLists(self, lists: list) -> list:\n        # Write your code here\n        pass\n",
      javascript:
        "/**\n * @param {ListNode[]} lists\n * @return {ListNode}\n */\nvar mergeKLists = function(lists) {\n    // Write your code here\n    return null;\n};\n",
      typescript:
        "function mergeKLists(lists: Array<any | null>): any | null {\n    // Write your code here\n    return null;\n}\n",
      java: "class Solution {\n    public ListNode mergeKLists(ListNode[] lists) {\n        // Write your code here\n        return null;\n    }\n}\n",
      cpp: "class Solution {\npublic:\n    ListNode* mergeKLists(vector<ListNode*>& lists) {\n        // Write your code here\n        return nullptr;\n    }\n};\n",
      go: "func mergeKLists(lists []*ListNode) *ListNode {\n    // Write your code here\n    return nil\n}\n",
    },
    hints: [
      "Use a Min-Heap (Priority Queue) of size k to extract the minimum element in O(log k).",
      "Total time complexity will be O(N log k) where N is total nodes.",
    ],
  },
];

