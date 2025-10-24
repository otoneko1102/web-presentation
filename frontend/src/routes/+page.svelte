<script>
  import { goto } from "$app/navigation";
  import { PUBLIC_BACKEND_URL } from "$env/static/public";

  let isLoading = false;
  let error = "";
  let selectedFile = null;

  async function handleSubmit(event) {
    if (!selectedFile) {
      error = "ファイルが選択されていません。";
      return;
    }

    isLoading = true;
    error = "";
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${PUBLIC_BACKEND_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        goto(`/host/${data.presentation_id}?key=${data.hostKey}`);
      } else {
        error = data.error || "アップロードに失敗しました。";
      }
    } catch (e) {
      error = "サーバーとの通信に失敗しました。";
    } finally {
      isLoading = false;
    }
  }

  function handleFileSelect(event) {
    selectedFile = event.target.files[0];
    error = "";
  }
</script>

<div class="page-container">
  <div class="upload-card">
    <h1>Webプレゼン</h1>
    <form on:submit|preventDefault={handleSubmit}>
      <div class="file-input-wrapper">
        <label for="file-upload" class="file-input-label">
          PDFファイルを選択
        </label>
        <input
          id="file-upload"
          type="file"
          name="file"
          accept=".pdf"
          on:change={handleFileSelect}
          required
        />
        <p class="file-name">
          {selectedFile ? selectedFile.name : "ファイルを選択してください"}
        </p>
      </div>
      <button
        type="submit"
        class="submit-btn"
        disabled={isLoading || !selectedFile}
      >
        {#if isLoading}
          <div class="spinner"></div>
          <span>ロード中...</span>
        {:else}
          <span>プレゼンを開始</span>
        {/if}
      </button>
    </form>
    <div class="error-message">
      {#if error}
        <p>{error}</p>
      {/if}
    </div>
  </div>
</div>

<style>
  :root {
    margin: 0;
    padding: 0;
  }
  :global(html),
  :global(body) {
    margin: 0;
    padding: 0;
  }
  .page-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background-color: #2c3e50;
    font-family: sans-serif;
    padding: 2rem;
    margin: 0;
  }
  .upload-card {
    background-color: #34495e;
    color: #ecf0f1;
    padding: 2.5rem 3rem;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    text-align: center;
    max-width: 500px;
    width: 100%;
  }
  h1 {
    margin-top: 0;
    margin-bottom: 2rem;
    font-weight: 300;
  }
  .file-input-wrapper {
    margin-bottom: 2rem;
  }
  .file-input-label {
    background-color: #3498db;
    color: white;
    padding: 1rem 2rem;
    border-radius: 5px;
    cursor: pointer;
    display: inline-block;
    transition: background-color 0.2s;
  }
  .file-input-label:hover {
    background-color: #2980b9;
  }
  input[type="file"] {
    display: none;
  }
  .file-name {
    margin-top: 1rem;
    color: #bdc3c7;
    min-height: 1.2em;
  }
  .submit-btn {
    width: 100%;
    background: #27ae60;
    color: white;
    border: none;
    padding: 1rem;
    border-radius: 5px;
    font-size: 1.2rem;
    cursor: pointer;
    transition: background-color 0.2s;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
  }
  .submit-btn:hover {
    background: #229954;
  }
  .submit-btn:disabled {
    background: #555;
    cursor: not-allowed;
  }
  .error-message {
    color: #e74c3c;
    margin-top: 1.5rem;
    min-height: 1.2em;
  }
  .spinner {
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: #fff;
    width: 20px;
    height: 20px;
    animation: spin 1s ease-in-out infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
