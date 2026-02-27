<script lang="ts">

  /**
   * Note to me: use marked and dompurify to create a reading pane
   *
   */

  import { onMount, onDestroy, createEventDispatcher } from "svelte";

  export let value: string = "";
  export let readOnly: boolean = false;

  const dispatch = createEventDispatcher<{ change: { value: string } }>();

  let host: HTMLDivElement | null = null;
  let crepe: any = null;

  // We only treat `value` as the INITIAL value (controlled syncing is possible, but it’s extra plumbing).
  onMount(async () => {
    if (!host) return;

    const [{ Crepe }, { listener, listenerCtx }] = await Promise.all([
      import("@milkdown/crepe"),
      import("@milkdown/plugin-listener"),
    ]);

    crepe = new Crepe({
      root: host,
      defaultValue: value,
      // Crepe supports config options; keep it minimal.
    });

    // Listen for markdown updates and bubble them up to Svelte.
    crepe.editor
      .config((ctx: any) => {
        ctx.get(listenerCtx).markdownUpdated((_ctx: any, markdown: string) => {
          value = markdown;
          dispatch("change", { value: markdown });
        });
      })
      .use(listener);

    if (readOnly) {
      // For full readonly control you can configure editorViewOptionsCtx,
      // but keeping this minimal. If you need true readonly, I’ll give you that snippet.
    }

    await crepe.create();
  });

  onDestroy(async () => {
    try {
      await crepe?.destroy?.();
    } catch {
      // swallow: unmount shouldn’t explode the app because an editor had feelings
    }
    crepe = null;
  });
</script>

<div class="milkdown-host" bind:this={host} />

<style>
  .milkdown-host {
    border: 1px solid rgba(127, 127, 127, 0.35);
    border-radius: 10px;
    overflow: hidden;
    min-height: 280px;
  }
</style>
