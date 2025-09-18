<script lang="ts">
  import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
  } from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";

  type CardItem = { front: string; back: string };
  let deck: CardItem[] = [
    { front: "ubiquitous", back: "present, appearing, or found everywhere" },
    { front: "laconic", back: "using very few words" },
    { front: "aplomb", back: "self-confidence or assurance" },
  ];
  let index = 0;
  let showBack = false;

  function flip() {
    showBack = !showBack;
  }
  function grade(_quality: 1 | 2 | 3 | 4 | 5) {
    // Placeholder: rotate the deck
    index = (index + 1) % deck.length;
    showBack = false;
  }
</script>

<section class="max-w-3xl mx-auto">
  <Card>
    <CardHeader>
      <CardTitle>Flashcards</CardTitle>
    </CardHeader>
    <CardContent>
      <div
        class="border rounded-xl p-8 text-center min-h-40 flex items-center justify-center text-xl"
      >
        {#if deck.length}
          {#if showBack}
            {deck[index].back}
          {:else}
            {deck[index].front}
          {/if}
        {:else}
          No cards.
        {/if}
      </div>
      <div class="mt-4 flex items-center gap-3 justify-center">
        <Button variant="secondary" onclick={flip}>Flip</Button>
        <Button variant="ghost" onclick={() => grade(1)}>Again</Button>
        <Button variant="outline" onclick={() => grade(3)}>Hard</Button>
        <Button onclick={() => grade(4)}>Good</Button>
        <Button variant="secondary" onclick={() => grade(5)}>Easy</Button>
      </div>
    </CardContent>
  </Card>
</section>
