import { createRoot } from "react-dom/client";
import { Brand, Icon } from "./ui/Icon";
import "./ui/styles.css";
function Popup() {
  const open = (route: string) => {
    const url = chrome.runtime.getURL(`app.html#${route}`);
    void chrome.tabs.create({ url });
  };
  return (
    <main className="popup">
      <header>
        <Brand />
        <button
          className="icon-button"
          title="Settings"
          aria-label="Settings"
          onClick={() => open("settings")}
        >
          <Icon name="settings" />
        </button>
      </header>
      <span className="eyebrow">Before you share</span>
      <h1>
        A quick check.
        <br />A clearer boundary.
      </h1>
      <p>Choose your identity and check content in your private workspace.</p>
      <div className="popup-actions">
        <button className="filled" onClick={() => open("image")}>
          <Icon name="image" />
          Check image
          <Icon name="arrow" />
        </button>
        <button className="tonal" onClick={() => open("text")}>
          <Icon name="text" />
          Check text
          <Icon name="arrow" />
        </button>
      </div>
      <div className="popup-local">
        <Icon name="lock" size={17} />
        <span>Checked locally. Never uploaded.</span>
      </div>
      <footer>
        <button className="text-button" onClick={() => open("overview")}>
          Open workspace
          <Icon name="arrow" size={18} />
        </button>
        <span>{version}</span>
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Popup />);
import { version } from "./version";
