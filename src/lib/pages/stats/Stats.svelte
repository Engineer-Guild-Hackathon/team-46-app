<script lang="ts">
  import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
  } from "$lib/components/ui/card";
  import { BarChart } from "$lib/components/ui/chart";
  import { user } from "$lib/stores/user";
  import { derived } from "svelte/store";
  import { Flame, Settings } from "@lucide/svelte";
  import GoalModal from "$lib/components/GoalModal.svelte";
  // Collapsible available if needed in future

  // Use reusable reading stats util
  import { loadStats, saveStats, WEEK_LABELS } from "./readingStats";

  // Simple derived rating: demo placeholder until backed by real data
  // Rating scale: 0..5 (half-steps supported); persisted elsewhere in future
  const _rating = derived(user, ($u) => {
    const len = $u.username?.length ?? 0;
    return Math.max(0, Math.min(5, len % 6));
  });

  // Labels and reactive datasets from persisted stats
  const labels = WEEK_LABELS;

  // Reactive state for stats
  let stats = $state(loadStats());
  $effect(() => saveStats(stats));

  // Reactive derived metrics (Svelte 5 runes)
  // Clone to avoid passing a $state-backed array to Chart.js (which mutates it)
  const weeklyData = $derived([...stats.daily]);
  const datasets = $derived([
    {
      label: "読んだ単語数",
      data: [...weeklyData],
      backgroundColor: "rgba(44, 24, 16, 0.6)",
      borderColor: "#2C1810",
      borderWidth: 1,
    },
  ]);
  const totalThisWeek = $derived(weeklyData.reduce((a, b) => a + b, 0));
  const avgDaily = $derived(Math.round(totalThisWeek / 7));
  const currentStreak = $derived(stats.currentStreak);
  const longestStreak = $derived(stats.longestStreak);

  // Weekly goal management with localStorage
  const WEEKLY_GOAL_KEY = "reading-weekly-goal";
  const DEFAULT_WEEKLY_GOAL = 1000;

  let weeklyGoal = $state(
    (() => {
      if (typeof localStorage === "undefined") return DEFAULT_WEEKLY_GOAL;
      try {
        const stored = localStorage.getItem(WEEKLY_GOAL_KEY);
        return stored ? parseInt(stored, 10) : DEFAULT_WEEKLY_GOAL;
      } catch {
        return DEFAULT_WEEKLY_GOAL;
      }
    })(),
  );

  function saveWeeklyGoal(goal: number) {
    weeklyGoal = goal;
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(WEEKLY_GOAL_KEY, goal.toString());
      } catch {
        // ignore storage errors
      }
    }
  }

  // Modal state for goal settings
  let showGoalModal = $state(false);

  function openGoalModal() {
    showGoalModal = true;
  }

  function handleGoalSave(newGoal: number) {
    saveWeeklyGoal(newGoal);
    showGoalModal = false;
  }

  function handleGoalCancel() {
    showGoalModal = false;
  }

  const progressPct = $derived(
    Math.max(0, Math.min(100, Math.round((totalThisWeek / weeklyGoal) * 100))),
  );

  // Simple GitHub-style intensity buckets for this week only
  // 0: none, 1: low, 2: mid, 3: high, 4: very high
  const _buckets = $derived(
    weeklyData.map((v) =>
      v <= 0 ? 0 : v < 50 ? 1 : v < 150 ? 2 : v < 300 ? 3 : 4,
    ),
  );

  // Derive a simple 0..5 weekly rating from progress percentage
  const _weeklyRating = $derived(
    Math.max(0, Math.min(5, Math.round(progressPct / 20))),
  );
</script>

<section class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
  <h2
    class="pl-2 text-xl font-semibold text-neutral-700 dark:text-neutral-300 col-span-full"
  >
    読書統計
  </h2>
  <Card>
    <CardHeader>
      <CardTitle>連続記録</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="flex items-center gap-3">
        <Flame class="size-6 text-orange-500" aria-hidden="true" />
        <div>
          <div class="text-2xl font-semibold" aria-label="current streak">
            {currentStreak} 日
          </div>
          <div class="text-xs text-neutral-600 dark:text-neutral-400">
            連続読書日数
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
  <Card class="md:col-span-2">
    <CardHeader>
      <div class="flex items-center justify-between">
        <CardTitle>週間目標</CardTitle>
        <button
          onclick={openGoalModal}
          class="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label="週間目標を編集"
        >
          <Settings class="size-4 text-neutral-500" />
        </button>
      </div>
    </CardHeader>
    <CardContent>
      <div class="text-sm mb-2">
        {totalThisWeek} / {weeklyGoal} 単語
      </div>
      <div
        class="w-full h-3 rounded bg-neutral-200 dark:bg-neutral-800 overflow-hidden"
      >
        <div
          class="h-3 bg-emerald-500 transition-[width] duration-300"
          style={`width: ${progressPct}%`}
          aria-label="週間目標の進捗"
        ></div>
      </div>
      <div class="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
        {progressPct}% 達成
      </div>
    </CardContent>
  </Card>

  <div class="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
    <Card class="md:col-span-2">
      <CardHeader>
        <CardTitle>週間読書量</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="flex justify-center items-center">
          <BarChart {labels} {datasets} class="max-w-full" />
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <CardTitle>まとめ</CardTitle>
      </CardHeader>
      <CardContent>
        <ul class="text-sm space-y-2">
          <li>今週の合計単語数: <strong>{totalThisWeek}</strong></li>
          <li>日平均: <strong>{avgDaily}</strong></li>
          <li>
            最長連続記録: <strong>{longestStreak} 日</strong>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</section>

<GoalModal
  isOpen={showGoalModal}
  currentGoal={weeklyGoal}
  onSave={handleGoalSave}
  onCancel={handleGoalCancel}
/>
