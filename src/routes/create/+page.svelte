<script lang="ts">
  import Editor from '$lib/components/Editor.svelte';

  let title = '';
  let md = `# Hello

Type *markdown* here.
- lists
- **bold**
- \`code\`
`;

  function publish() {
    console.log({ title, body: md });
  }
</script>


<section class="create">
  <header class="create-header">
    <input
      class="title"
      type="text"
      placeholder="Title"
      bind:value={title}
    />
    <button class="publish" type="button" on:click={publish}>Publish</button>
  </header>

  <Editor bind:value={md} on:change={(e) => (md = e.detail.value)} />
</section>

<style>
  .create {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.5rem 2rem 7rem;
    min-height: calc(100vh - 6.5rem);
    background: linear-gradient(180deg, #fbfbfb 0%, #f7f7f7 100%);
  }
  .create-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    position: sticky;
    top: 0;
    z-index: 2;
    background: linear-gradient(
      180deg,
      rgba(251, 251, 251, 0.98) 0%,
      rgba(251, 251, 251, 0.9) 80%,
      rgba(251, 251, 251, 0) 100%
    );
    padding: 0.5rem 0 1rem;
  }
  .title {
    flex: 1;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 12px;
    padding: 0.7rem 0.9rem;
    font-size: 1.4rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    background: #ffffff;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
  }
  .title::placeholder {
    color: rgba(0, 0, 0, 0.35);
  }
  .publish {
    border: 0;
    padding: 0.65rem 1.15rem;
    border-radius: 999px;
    font-weight: 600;
    font-size: 0.8rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #f6f6f6;
    background: #0d0d0d;
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
    cursor: pointer;
  }
  .publish:active {
    transform: translateY(1px);
  }
</style>
