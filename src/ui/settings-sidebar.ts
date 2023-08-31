export function setupSettingsSidebar() {
  const settingsSidebar = document.getElementById("settings-sidebar");

  const toggleButton = document.getElementById("toggle-settings");
  if (!settingsSidebar || !toggleButton) throw new Error("Missing elements");

  if (localStorage.getItem("settingsSidebarState") === "show") {
    settingsSidebar.classList.add("show");
    toggleButton.classList.add("open");
  }

  toggleButton.addEventListener("click", function () {
    settingsSidebar.classList.toggle("show");
    toggleButton.classList.toggle("open");

    // Store the new state in localStorage
    if (settingsSidebar.classList.contains("show")) {
      localStorage.setItem("settingsSidebarState", "show");
    } else {
      localStorage.setItem("settingsSidebarState", "hide");
    }
  });
}
