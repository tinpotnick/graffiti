<script lang="ts">
import FeedItem from '$lib/components/FeedItem.svelte';


// placeholder data
const posts = [
{ id: 1, title: 'First post', excerpt: 'Decentralised nonsense begins.' },
{ id: 2, title: 'Second post', excerpt: 'Still immutable. Still here.' }
];
</script>


<section>
{#each posts as post}
<FeedItem {post} />
{/each}
</section>