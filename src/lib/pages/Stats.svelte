<script lang="ts">
  import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
  } from "$lib/components/ui/card";
  import { BarChart, LineChart } from "$lib/components/ui/chart";
  import { user } from "$lib/stores/user";
  import { derived } from "svelte/store";
  import { Flame } from "@lucide/svelte";
  import * as Collapsible from "$lib/components/ui/collapsible/index.js";
  let ratingOpen = false;

  // Simple derived rating: demo placeholder until backed by real data
  // Rating scale: 0..5 (half-steps supported); persisted elsewhere in future
  const rating = derived(user, ($u) => {
    // naive deterministic demo rating based on username length
    const len = $u.username?.length ?? 0;
    return Math.max(0, Math.min(5, len % 6));
  });

  // Demo stats
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const datasets = [
    {
      label: "Words Read",
      data: [500, 800, 650, 900, 1200, 300, 0],
      backgroundColor: "rgba(44, 24, 16, 0.6)",
      borderColor: "#2C1810",
      borderWidth: 1,
    },
  ];

  // Compute current daily streak from weekly data (consecutive non-zero from end)
  const weeklyData = datasets[0].data;
  function calcCurrentStreak(data: number[]): number {
    let s = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i] > 0) s++;
      else break;
    }
    return s;
  }
  const currentStreak = calcCurrentStreak(weeklyData);
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
        <li>Total Words This Week: <strong>4,350</strong></li>
        <li>Avg. Daily: <strong>621</strong></li>
        <li>Longest Streak: <strong>6 days</strong></li>
      </ul>
    </CardContent>
  </Card>
  <div class="h-12"></div>
</section>
