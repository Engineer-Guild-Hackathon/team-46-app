<script lang="ts">
  import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
  import { Button } from "./ui/button";

  interface Props {
    isOpen?: boolean;
    currentGoal?: number;
    onSave?: (goal: number) => void;
    onCancel?: () => void;
  }

  let {
    isOpen = false,
    currentGoal = 1000,
    onSave = () => {},
    onCancel = () => {},
  }: Props = $props();

  let tempGoal = $state(currentGoal);
  let inputElement = $state<HTMLInputElement>();

  const presetGoals = [1000, 5000, 10000];

  // Update tempGoal when currentGoal changes
  $effect(() => {
    if (isOpen) {
      tempGoal = currentGoal;
      // Auto-select text after a brief delay to ensure DOM is ready
      setTimeout(() => {
        if (inputElement) {
          inputElement.select();
          inputElement.focus();
        }
      }, 50);
    }
  });

  function handleSave() {
    if (tempGoal > 0) {
      onSave(tempGoal);
    }
  }

  function handleCancel() {
    tempGoal = currentGoal;
    onCancel();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    // Remove any non-numeric characters
    const value = target.value.replace(/[^0-9]/g, "");
    target.value = value;
    tempGoal = parseInt(value) || 0;
  }

  function selectPreset(goal: number) {
    tempGoal = goal;
    if (inputElement) {
      inputElement.value = goal.toString();
    }
  }
</script>

{#if isOpen}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    role="dialog"
    aria-modal="true"
    aria-labelledby="goal-modal-title"
    tabindex="-1"
    onclick={handleCancel}
    onkeydown={handleKeydown}
  >
    <Card class="w-80 max-w-[90vw]" onclick={(e) => e.stopPropagation()}>
      <CardHeader>
        <CardTitle id="goal-modal-title">Set Weekly Goal</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          <div>
            <label for="goal-input" class="block text-sm font-medium mb-2">
              Words per week:
            </label>
            <input
              bind:this={inputElement}
              id="goal-input"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              value={tempGoal}
              oninput={handleInput}
              onkeydown={handleKeydown}
              class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2"
              placeholder="Enter your weekly goal"
              autocomplete="off"
            />
          </div>

          <div>
            <div class="text-sm font-medium mb-2">Quick presets:</div>
            <div class="flex gap-2">
              {#each presetGoals as preset}
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => selectPreset(preset)}
                  class="flex-1"
                >
                  {preset.toLocaleString()}
                </Button>
              {/each}
            </div>
          </div>

          <div class="flex gap-2">
            <Button variant="outline" onclick={handleCancel} class="flex-1">
              Cancel
            </Button>
            <Button onclick={handleSave} class="flex-1 text-secondary"
              >Save</Button
            >
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
{/if}
