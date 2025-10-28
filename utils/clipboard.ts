// clipboard.ts
export const copyToClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
    alert("✅ Code copied to clipboard! Share it with the other device.");
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
      alert("✅ Code copied to clipboard!");
    } catch (e) {
      alert("❌ Failed to copy. Please copy manually.");
    }
    document.body.removeChild(textArea);
  }
};
