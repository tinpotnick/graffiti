<script lang="ts">
  import TopNav from '$lib/components/TopNav.svelte';

  import "@milkdown/crepe/theme/common/style.css";
  import "@milkdown/crepe/theme/frame.css";

</script>


<TopNav />


<main class="container">
<slot />
</main>

<style>
.container {
max-width: 720px;
margin: 0 auto;
padding: 1rem;
padding-bottom: 6.5rem;
}
</style>
