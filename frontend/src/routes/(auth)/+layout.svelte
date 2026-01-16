<script lang="ts">
  import '../../app.css';

  let { children }: { children: any } = $props();
</script>

<svelte:head>
  <title>Healthify</title>
  <meta name="description" content="Personal health tracker" />
</svelte:head>

{@render children()}
