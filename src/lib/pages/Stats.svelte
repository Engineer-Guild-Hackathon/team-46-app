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
  import { Flame } from "@lucide/svelte";
  // Collapsible available if needed in future

  // Use reusable reading stats util
  import {
    loadStats,
    saveStats,
    WEEK_LABELS,
  } from "./readingStats";

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
      label: "Words Read",
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
</script>

<section class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
  <h2 class="pl-2 text-xl font-semibold text-neutral-700 dark:text-neutral-300">
    Your Reading Stats
  </h2>
  <Card>
    <CardHeader>
      <CardTitle>Daily Streak</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="flex items-center gap-3">
        <Flame class="size-6 text-orange-500" aria-hidden="true" />
        <div>
          <div class="text-2xl font-semibold" aria-label="current streak">
            {currentStreak} day{currentStreak === 1 ? "" : "s"}
          </div>
          <div class="text-xs text-neutral-600 dark:text-neutral-400">
            Consecutive reading days
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
  <Card class="md:col-span-2">
    <CardHeader>
      <CardTitle>Weekly Reading</CardTitle>
    </CardHeader>
    <CardContent>
      <BarChart {labels} {datasets} />
    </CardContent>
  </Card>

  <Card>
    <CardHeader>
      <CardTitle>Summary</CardTitle>
    </CardHeader>
    <CardContent>
      <ul class="text-sm space-y-2">
        <li>Total Words This Week: <strong>{totalThisWeek}</strong></li>
        <li>Avg. Daily: <strong>{avgDaily}</strong></li>
        <li>
          Longest Streak: <strong
            >{longestStreak} day{longestStreak === 1 ? "" : "s"}</strong
          >
        </li>
      </ul>
    </CardContent>
  </Card>
  <div class="h-12"></div>
</section>
