export function TitleBar() {
  return (
    <div className="titlebar">
      <button onClick={() => window.electronAPI.minimizeWindow()}>—</button>
      <button onClick={() => window.electronAPI.maximizeWindow()}>□</button>
      <button onClick={() => window.electronAPI.closeWindow()}>✕</button>
    </div>
  );
}
