<script lang="ts">
export let post: { title: string; excerpt: string };
</script>


<article>
<h2>{post.title}</h2>
<p>{post.excerpt}</p>
</article>


<style>
article {
padding: 1rem 0;
border-bottom: 1px solid #eee;
}
h2 {
margin: 0 0 0.25rem 0;
}
</style>