<script lang="ts">
  import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
  } from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Flame, BookOpen, Brain, Clock } from "@lucide/svelte";
  import type { SessionStats } from "$lib/pages/book/sessionStats";
  import { formatDuration } from "$lib/pages/book/sessionStats";
  import { loadStats } from "$lib/pages/stats/readingStats";

  let {
    isOpen = false,
    sessionData = null,
    onClose = () => {},
    onGoToFlashcards = () => {},
  }: {
    isOpen?: boolean;
    sessionData?: SessionStats | null;
    onClose?: () => void;
    onGoToFlashcards?: () => void;
  } = $props();

  // Get current reading streak from stats
  const stats = loadStats();
  const currentStreak = stats.currentStreak;

  function handleClose() {
    onClose();
  }

  function handleGoToFlashcards() {
    onGoToFlashcards();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
    }
  }

  // Format the session time
  const sessionTime = $derived(
    sessionData ? formatDuration(Date.now() - sessionData.startTime) : "0s",
  );
</script>

{#if isOpen && sessionData}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    role="dialog"
    aria-modal="true"
    aria-labelledby="session-modal-title"
    tabindex="-1"
    onclick={handleClose}
    onkeydown={handleKeydown}
  >
    <Card class="w-96 max-w-[90vw]" onclick={(e) => e.stopPropagation()}>
      <CardHeader class="text-center">
        <CardTitle id="session-modal-title" class="text-xl font-bold">
          📚 読書セッション完了！
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div class="space-y-6">
          <!-- Stats Grid -->
          <div class="grid grid-cols-2 gap-4">
            <!-- Current Streak -->
            <div
              class="flex items-center space-x-2 p-3 bg-orange-50 rounded-lg"
            >
              <Flame class="w-5 h-5 text-orange-500" />
              <div>
                <div class="text-sm text-gray-600">連続記録</div>
                <div class="font-bold text-orange-600">
                  {currentStreak} 日
                </div>
              </div>
            </div>

            <!-- Session Time -->
            <div class="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
              <Clock class="w-5 h-5 text-blue-500" />
              <div>
                <div class="text-sm text-gray-600">読書時間</div>
                <div class="font-bold text-blue-600">{sessionTime}</div>
              </div>
            </div>

            <!-- Words Read -->
            <div class="flex items-center space-x-2 p-3 bg-green-50 rounded-lg">
              <BookOpen class="w-5 h-5 text-green-500" />
              <div>
                <div class="text-sm text-gray-600">読んだ単語数</div>
                <div class="font-bold text-green-600">
                  {sessionData.wordsRead.toLocaleString()}
                </div>
              </div>
            </div>

            <!-- Words Learned -->
            <div
              class="flex items-center space-x-2 p-3 bg-purple-50 rounded-lg"
            >
              <Brain class="w-5 h-5 text-purple-500" />
              <div>
                <div class="text-sm text-gray-600">覚えた単語数</div>
                <div class="font-bold text-purple-600">
                  {sessionData.wordsLearned}
                </div>
              </div>
            </div>
          </div>

          <!-- Encouragement Message -->
          <div class="text-center text-gray-600 text-sm">
            {#if sessionData.wordsRead > 1000}
              🎉 素晴らしい進歩です！良い読書習慣が身についています。
            {:else if sessionData.wordsRead > 500}
              👏 よくできました！この調子で続けていきましょう。
            {:else if sessionData.wordsRead > 100}
              ✨ お疲れ様でした！少しずつでも着実に進歩しています。
            {:else}
              🌱 読書は積み重ねが大切です。がんばって続けましょう！
            {/if}
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-2">
            <Button variant="outline" onclick={handleClose} class="flex-1">
              閉じる
            </Button>
            {#if sessionData.wordsLearned > 0}
              <Button
                onclick={handleGoToFlashcards}
                class="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
              >
                単語カードを復習 ({sessionData.wordsLearned})
              </Button>
            {:else}
              <Button
                onclick={handleGoToFlashcards}
                class="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
              >
                単語カードを見る
              </Button>
            {/if}
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
{/if}
