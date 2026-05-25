import { FileUp } from "lucide-react";

export function DropZone({ onFile, disabled }) {
  function handleDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <label
      className="dropZone"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept=".txt,.md,.pdf,.png,.jpg,.jpeg,.webp"
        disabled={disabled}
        onChange={(event) => event.target.files?.[0] && onFile(event.target.files[0])}
      />
      <FileUp size={28} />
      <span>Drop a TXT, PDF, image, or screenshot</span>
    </label>
  );
}
