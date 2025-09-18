<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { cn } from "$lib/utils";

  export let className: string | undefined = undefined;
  export let labels: string[] = [];
  export let datasets: Array<{
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
    tension?: number;
  }> = [];
  export let options: any = {};

  let canvas: HTMLCanvasElement | null = null;
  let chart: any;

  onMount(async () => {
    const mod = await import("chart.js/auto");
    const Chart = mod.default;
    chart = new Chart(canvas!, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
        ...options,
      },
    });
  });

  onDestroy(() => chart?.destroy?.());
</script>

<div class={cn("w-full h-56", className)}>
  <canvas bind:this={canvas} aria-label="line chart"></canvas>
</div>
