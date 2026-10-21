import { Settings } from "./views/Settings";
import { Toast } from "./views/Toast";

export default function App() {
  const isToast = window.location.hash.includes("toast");
  return isToast ? <Toast /> : <Settings />;
}
