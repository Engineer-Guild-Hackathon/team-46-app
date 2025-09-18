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
  import * as Table from "$lib/components/ui/table/index.js";
  import { onMount, onDestroy } from "svelte";
  import Chart from "chart.js/auto";

  let collapsibleOpen = $state(false);

  // Load cards from localStorage
  const initialCards: FCItem[] = loadCards();
  let deck: DeckState = buildDeck(initialCards, loadState());
  let queue = $state<ScheduledCard[]>([]);
  let current = $state<ScheduledCard | undefined>(undefined);
  let showBack = $state(false);
  let s = $state(deckStats(deck));
  let cats = $state(categorize(deck));
  let pieEl: HTMLCanvasElement | null = null;
  let pie: Chart | null = null;

  function refresh() {
    queue = dueQueue(deck);
    current = queue[0];
    s = deckStats(deck);
    cats = categorize(deck);
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
    saveState(deck);
    showBack = false;
    refresh();
  }

  refresh();

  function pieData() {
    return [cats["not-learned"], cats.learning, cats.developed, cats.mastered];
  }

  const colors = [
    "rgb(156,163,175)", // gray-400
    "rgb(59,130,246)", // blue-500
    "rgb(245,158,11)", // amber-500
    "rgb(16,185,129)", // emerald-500
  ];

  onMount(() => {
    if (!pieEl) return;
    pie = new Chart(pieEl, {
      type: "pie",
      data: {
        labels: ["Not learned", "Learning", "Developed", "Mastered"],
        datasets: [
          {
            data: pieData(),
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
    if (pie) {
      pie.data.datasets[0].data = pieData();
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
    Word Flashcards
  </h2>

  <!-- Study Overview - 1/3 on md -->
  <Card class="md:col-span-1">
    <CardHeader>
      <CardTitle>Study overview</CardTitle>
    </CardHeader>
    <CardContent class="text-sm text-muted-foreground">
      <div class="space-y-4">
        <div>
          <span>Due: {queue.length}</span>
          <span class="mx-2">•</span>
          <span>Total: {s.total}</span>
          <span class="mx-2">•</span>
          <span>New: {s.new}</span>
        </div>
        <div class="flex flex-col items-center gap-4">
          <div class="size-28">
            <canvas bind:this={pieEl} aria-label="Progress pie chart"></canvas>
          </div>
          <div class="grid grid-cols-1 gap-2 text-foreground text-xs">
            <div class="flex items-center gap-2">
              <span
                class="inline-block size-3 rounded-full"
                style="background: rgb(156,163,175)"
              ></span>
              Not learned: {cats["not-learned"]}
            </div>
            <div class="flex items-center gap-2">
              <span
                class="inline-block size-3 rounded-full"
                style="background: rgb(59,130,246)"
              ></span>
              Learning: {cats.learning}
            </div>
            <div class="flex items-center gap-2">
              <span
                class="inline-block size-3 rounded-full"
                style="background: rgb(245,158,11)"
              ></span>
              Developed: {cats.developed}
            </div>
            <div class="flex items-center gap-2">
              <span
                class="inline-block size-3 rounded-full"
                style="background: rgb(16,185,129)"
              ></span>
              Mastered: {cats.mastered}
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>

  <!-- Flashcard - 2/3 on md -->
  <Card class="md:col-span-2">
    <CardHeader>
      <CardTitle>Flashcards</CardTitle>
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
        aria-label="Flashcard"
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
          No cards.
        {:else if s.total === 0}
          No cards.
        {:else}
          All done for now. 🎉
        {/if}
      </Button>

      <div class="mt-4 flex flex-wrap items-center gap-3 justify-center">
        <Button
          variant="outline"
          class="border"
          onclick={() => grade(1)}
          aria-label="Again (1)">Again</Button
        >
        <Button
          variant="outline"
          class="border"
          onclick={() => grade(3)}
          aria-label="Hard (3)">Hard</Button
        >
        <Button
          variant="outline"
          class="border"
          onclick={() => grade(4)}
          aria-label="Good (4)">Good</Button
        >
        <Button
          variant="outline"
          class="border"
          onclick={() => grade(5)}
          aria-label="Easy (5)">Easy</Button
        >
      </div>
    </CardContent>
  </Card>

  <!-- All Words - Full width -->
  <Card class="md:col-span-3">
    <CollapsibleRoot bind:open={collapsibleOpen}>
      <CardHeader>
        <div class="flex items-center justify-between">
          <CardTitle>All words</CardTitle>
          <CollapsibleTrigger class="underline text-sm">
            {#if collapsibleOpen}
              Hide
            {:else}
              Show
            {/if}
          </CollapsibleTrigger>
        </div>
      </CardHeader>
      <CollapsibleContent>
        <CardContent>
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>Word</Table.Head>
                <Table.Head>Definition</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#if deck.cards.length === 0}
                <Table.Row>
                  <Table.Cell colspan="2" class="text-muted-foreground">
                    No cards saved yet.
                  </Table.Cell>
                </Table.Row>
              {:else}
                {#each deck.cards as c}
                  <Table.Row>
                    <Table.Cell class="font-medium">{c.front}</Table.Cell>
                    <Table.Cell>{c.back || "—"}</Table.Cell>
                  </Table.Row>
                {/each}
              {/if}
            </Table.Body>
          </Table.Root>
        </CardContent>
      </CollapsibleContent>
    </CollapsibleRoot>
  </Card>
  <div class="h-12"></div>
</section>
