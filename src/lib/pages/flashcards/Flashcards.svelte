<script lang="ts">
  import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
  } from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import {
    Collapsible as CollapsibleRoot,
    CollapsibleTrigger,
    CollapsibleContent,
  } from "$lib/components/ui/collapsible";
  import {
    buildDeck,
    dueQueue,
    gradeCard,
    loadState,
    saveState,
    stats as deckStats,
    categorize,
    type CardItem as FCItem,
    type DeckState,
    type Grade,
    type ScheduledCard,
  } from "./flashcardScheduler";
  import { loadCards } from "./flashcardsStore";
  import { removeCard } from "./flashcardsStore";
  import * as Table from "$lib/components/ui/table/index.js";
  import { onMount, onDestroy } from "svelte";
  import { Trash2 } from "@lucide/svelte";

  let collapsibleOpen = $state(false);

  // Load cards from localStorage
  const initialCards: FCItem[] = loadCards();
  let deck = $state<DeckState>(buildDeck(initialCards, loadState()));
  let queue = $state<ScheduledCard[]>([]);
  let current = $state<ScheduledCard | undefined>(undefined);
  let showBack = $state(false);
  let s = $derived(deckStats(deck));
  let cats = $derived(categorize(deck));
  let pieEl: HTMLCanvasElement | null = null;
  let pie: any = null;

  function refresh() {
    queue = dueQueue(deck);
    current = queue[0];
  }

  function deleteCard(id: string) {
    if (removeCard(id)) {
      // Reload cards and rebuild deck
      const updatedCards = loadCards();
      deck = buildDeck(updatedCards, loadState());
      deck = { ...deck };
      refresh();
    }
  }

  function flip() {
    if (!current) return;
    showBack = !showBack;
  }

  function grade(quality: Grade) {
    if (!current) return;
    const { next } = gradeCard(current, quality);
    deck.cards = deck.cards.map((c) =>
      c.id === current!.id ? { ...c, ...next } : c,
    );
    deck = { ...deck };
    saveState(deck);
    showBack = false;
    refresh();
    // Force chart re-render after grading
    if (pie && pieEl) {
      pie.destroy();
      import("chart.js/auto").then((mod) => {
        const Chart = mod.default;
        pie = new Chart(pieEl, {
          type: "pie",
          data: {
            labels: ["未学習", "学習中", "習得中", "習得済み"],
            datasets: [
              {
                data: [
                  cats["not-learned"],
                  cats.learning,
                  cats.developed,
                  cats.mastered,
                ],
                backgroundColor: colors,
              },
            ],
          },
          options: {
            plugins: {
              legend: { display: false },
              tooltip: { enabled: true },
            },
          },
        });
      });
    }
  }

  refresh();

  let pieData = $derived([
    cats["not-learned"],
    cats.learning,
    cats.developed,
    cats.mastered,
  ]);

  const colors = [
    "rgb(156,163,175)", // gray-400
    "rgb(59,130,246)", // blue-500
    "rgb(245,158,11)", // amber-500
    "rgb(16,185,129)", // emerald-500
  ];

  onMount(async () => {
    if (!pieEl) return;
    const mod = await import("chart.js/auto");
    const Chart = mod.default;
    pie = new Chart(pieEl, {
      type: "pie",
      data: {
        labels: ["未学習", "学習中", "習得中", "習得済み"],
        datasets: [
          {
            data: pieData,
            backgroundColor: colors,
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: { enabled: true },
        },
      },
    });
  });

  $effect(() => {
    if (pie && pieData) {
      pie.data.datasets[0].data = pieData;
      pie.update();
    }
  });

  onDestroy(() => {
    pie?.destroy();
  });
</script>

<section class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
  <h2
    class="pl-2 text-xl font-semibold text-neutral-700 dark:text-neutral-300 col-span-full"
  >
    単語カード
  </h2>

  <!-- Study Overview - 1/3 on md -->
  <Card class="md:col-span-1">
    <CardHeader>
      <CardTitle>学習状況</CardTitle>
    </CardHeader>
    <CardContent class="text-sm text-muted-foreground">
      <div class="space-y-4">
        <div>
          <span>復習予定: {queue.length}</span>
          <span class="mx-2">•</span>
          <span>合計: {s.total}</span>
          <span class="mx-2">•</span>
          <span>新規: {s.new}</span>
        </div>
        <div class="flex flex-col items-center gap-4">
          <div class="size-28">
            <canvas bind:this={pieEl} aria-label="進捗円グラフ"></canvas>
          </div>
          <div class="grid grid-cols-1 gap-2 text-foreground text-xs">
            <div class="flex items-center gap-2">
              <span
                class="inline-block size-3 rounded-full"
                style="background: rgb(156,163,175)"
              ></span>
              未学習: {cats["not-learned"]}
            </div>
            <div class="flex items-center gap-2">
              <span
                class="inline-block size-3 rounded-full"
                style="background: rgb(59,130,246)"
              ></span>
              学習中: {cats.learning}
            </div>
            <div class="flex items-center gap-2">
              <span
                class="inline-block size-3 rounded-full"
                style="background: rgb(245,158,11)"
              ></span>
              習得中: {cats.developed}
            </div>
            <div class="flex items-center gap-2">
              <span
                class="inline-block size-3 rounded-full"
                style="background: rgb(16,185,129)"
              ></span>
              習得済み: {cats.mastered}
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>

  <!-- Flashcard - 2/3 on md -->
  <Card class="md:col-span-2">
    <CardHeader>
      <CardTitle>単語カード</CardTitle>
    </CardHeader>
    <CardContent>
      <Button
        class="border rounded-xl p-8 text-center min-h-40 w-full flex items-center justify-center text-xl mt-2 select-none cursor-pointer"
        variant="outline"
        onclick={flip}
        on:keydown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            flip();
          }
        }}
        aria-label="単語カード"
        type="button"
      >
        {#if current}
          <div
            class="w-full max-h-32 overflow-auto break-words whitespace-normal"
          >
            {#if showBack}
              {current.back}
            {:else}
              {current.front}
            {/if}
          </div>
        {:else if s.total === 0}
          カードがありません。
        {:else}
          今日の分は完了しました。🎉
        {/if}
      </Button>

      <div class="mt-4 flex flex-wrap items-center gap-2 justify-center">
        <Button
          variant="outline"
          class="border p-2"
          onclick={() => grade(1)}
          aria-label="もう一度 (1)">もう一度</Button
        >
        <Button
          variant="outline"
          class="border p-2"
          onclick={() => grade(3)}
          aria-label="難しい (3)">難しい</Button
        >
        <Button
          variant="outline"
          class="border p-2"
          onclick={() => grade(4)}
          aria-label="良い (4)">良い</Button
        >
        <Button
          variant="outline"
          class="border p-2"
          onclick={() => grade(5)}
          aria-label="簡単 (5)">簡単</Button
        >
      </div>
    </CardContent>
  </Card>

  <!-- All Words - Full width -->
  <Card class="md:col-span-3">
    <CollapsibleRoot bind:open={collapsibleOpen}>
      <CardHeader>
        <div class="flex items-center justify-between">
          <CardTitle>すべての単語</CardTitle>
          <CollapsibleTrigger class="underline text-sm">
            {#if collapsibleOpen}
              隠す
            {:else}
              表示
            {/if}
          </CollapsibleTrigger>
        </div>
      </CardHeader>
      <CollapsibleContent>
        <CardContent>
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>単語</Table.Head>
                <Table.Head>意味</Table.Head>
                <Table.Head class="w-4">削除</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#if deck.cards.length === 0}
                <Table.Row>
                  <Table.Cell colspan="3" class="text-muted-foreground">
                    まだ単語が保存されていません。
                  </Table.Cell>
                </Table.Row>
              {:else}
                {#each deck.cards as c}
                  <Table.Row>
                    <Table.Cell class="font-medium">{c.front}</Table.Cell>
                    <Table.Cell class="max-w-xs">
                      <span class="block truncate" title={c.back || "—"}>
                        {c.back || "—"}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onclick={() => deleteCard(c.id)}
                        aria-label={`${c.front}を削除`}
                        class="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 class="h-4 w-4" />
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                {/each}
              {/if}
            </Table.Body>
          </Table.Root>
        </CardContent>
      </CollapsibleContent>
    </CollapsibleRoot>
  </Card>
</section>
