<script>
  import { page } from "$app/stores";
  import { onMount, onDestroy } from "svelte";
  import { socket } from "$lib/socket";
  import { PUBLIC_BACKEND_URL } from "$env/static/public";

  const presentationId = $page.params.id;
  const pdfUrl = `${PUBLIC_BACKEND_URL}/public/presentations/${presentationId}.pdf?t=${Date.now()}`;

  let mainElement;
  let canvasElement;
  let pdfDoc = null;
  let currentPage = 1;
  let isTerminated = false;
  let isLoading = true;
  let isFullscreen = false;

  function handleFullscreenChange() {
    isFullscreen = !!document.fullscreenElement;
  }

  onMount(() => {
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;

    if (!socket.connected) {
      socket.connect();
    }

    socket.on("connect", () => {
      socket.emit("join", { room: presentationId, isHost: false });
    });

    socket.on("update_page", (data) => {
      if (!pdfDoc) {
        loadPdfAndRender(data.page);
      } else if (data.page !== currentPage) {
        currentPage = data.page;
        renderPage(currentPage);
      }
    });

    socket.on("presentation_terminated", () => {
      isLoading = false;
      isTerminated = true;
    });
  });

  onDestroy(() => {
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
  });

  function loadPdfAndRender(pageNum) {
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    loadingTask.promise
      .then((pdf) => {
        pdfDoc = pdf;
        currentPage = pageNum;
        renderPage(currentPage);
        isLoading = false;
      })
      .catch((err) => {
        console.error("PDFの読み込みに失敗:", err);
        isTerminated = true;
        isLoading = false;
      });
  }

  async function renderPage(num) {
    if (!pdfDoc) return;
    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: 1.5 });
    const context = canvasElement.getContext("2d");
    canvasElement.height = viewport.height;
    canvasElement.width = viewport.width;
    await page.render({ canvasContext: context, viewport: viewport }).promise;
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      mainElement?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }
</script>

<main bind:this={mainElement}>
  {#if isTerminated}
    <div class="message-container">
      <h2>プレゼンは終了しました</h2>
      <p>ご参加いただきありがとうございました。</p>
    </div>
  {:else if isLoading}
    <div class="message-container">
      <p>接続中...</p>
    </div>
  {:else}
    <canvas bind:this={canvasElement}></canvas>
    <button
      class="fullscreen-btn"
      on:click={toggleFullscreen}
      title="全画面表示切り替え"
    >
      {#if isFullscreen}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><path
            d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"
          /></svg
        >
      {:else}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><path
            d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
          /></svg
        >
      {/if}
    </button>
  {/if}
</main>

<style>
  main {
    position: relative;
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #333;
    overflow: hidden;
    color: white;
    font-family: sans-serif;
  }
  canvas {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
  }
  .message-container {
    text-align: center;
    padding: 2rem;
    background-color: rgba(0, 0, 0, 0.5);
    border-radius: 10px;
    margin: 0;
  }
  .fullscreen-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background-color: rgba(0, 0, 0, 0.5);
    border: none;
    color: white;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    opacity: 0.3;
    transition: opacity 0.3s;
  }
  main:hover .fullscreen-btn {
    opacity: 1;
  }
</style>
