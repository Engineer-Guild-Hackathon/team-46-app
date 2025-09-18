<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { cn } from "$lib/utils";

  export let className: string | undefined = undefined;
  export let labels: string[] = [];
  export let datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    barThickness?: number | "flex";
  }> = [];
  export let options: any = {};

  let canvas: HTMLCanvasElement | null = null;
  let chart: any;
  let container: HTMLDivElement | null = null;
  let resizeObserver: ResizeObserver | null = null;

  onMount(async () => {
    const mod = await import("chart.js/auto");
    const Chart = mod.default;
    chart = new Chart(canvas!, {
      type: "bar",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true } },
        scales: { y: { beginAtZero: true } },
        ...options,
      },
    });

    // Set up ResizeObserver to handle container resize
    if (container && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        if (chart) {
          chart.resize();
        }
      });
      resizeObserver.observe(container);
    }

    // Fallback: listen to window resize
    const handleResize = () => {
      if (chart) {
        chart.resize();
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  });

  onDestroy(() => {
    resizeObserver?.disconnect?.();
    chart?.destroy?.();
  });
</script>

<div bind:this={container} class={cn("items-center w-full", className)}>
  <canvas bind:this={canvas} aria-label="bar chart"></canvas>
</div>
