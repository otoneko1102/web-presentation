<script>
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { socket } from "$lib/socket";
  import { PUBLIC_BACKEND_URL } from "$env/static/public";

  const presentationId = $page.params.id;
  // キャッシュを無効化
  const pdfUrl = `${PUBLIC_BACKEND_URL}/public/presentations/${presentationId}.pdf?t=${Date.now()}`;

  let canvasElement;
  let pdfDoc = null;
  let currentPage = 1;
  let isTerminated = false;
  let isLoading = true;

  onMount(() => {
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

  // PDFを読み込み・ページを描画
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
</script>

<main>
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
  {/if}
</main>

<style>
  main {
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
  }
</style>
