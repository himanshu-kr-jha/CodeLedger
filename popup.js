// Get references to all UI elements
const mainView = document.getElementById("mainView");
const settingsView = document.getElementById("settingsView");
const settingsBtn = document.getElementById("settingsBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");

const sheetUrlInput = document.getElementById("sheetUrl");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const settingsStatus = document.getElementById("settingsStatus");

const statusInput = document.getElementById("statusInput");
const remarksInput = document.getElementById("remarksInput");
const starredInput = document.getElementById("starredInput");
const updateSheetBtn = document.getElementById("updateSheetBtn");
const statusDiv = document.getElementById("status");

// --- View Switching Logic ---
const showMainView = () => {
  settingsView.classList.add("hidden");
  mainView.classList.remove("hidden");
};

const showSettingsView = () => {
  mainView.classList.add("hidden");
  settingsView.classList.remove("hidden");
};

settingsBtn.addEventListener("click", showSettingsView);
closeSettingsBtn.addEventListener("click", showMainView);

// --- Main Logic ---

// On popup open, check if a URL is saved and show the correct view
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["sheetUrl"], (result) => {
    if (result.sheetUrl) {
      sheetUrlInput.value = result.sheetUrl;
      showMainView();
    } else {
      // If no URL is saved, force the settings view
      showSettingsView();
      closeSettingsBtn.classList.add("hidden"); // Hide close button on first run
    }
  });
});

// Save the sheet URL from the settings view
saveSettingsBtn.addEventListener("click", () => {
  const url = sheetUrlInput.value;
  if (!url || !url.includes("docs.google.com/spreadsheets")) {
    settingsStatus.textContent = "Please enter a valid Google Sheet URL.";
    settingsStatus.style.color = "red";
    return;
  }
  chrome.storage.local.set({ sheetUrl: url }, () => {
    settingsStatus.textContent = "URL Saved!";
    settingsStatus.style.color = "green";
    closeSettingsBtn.classList.remove("hidden");
    setTimeout(() => {
      settingsStatus.textContent = "";
      showMainView();
    }, 1000);
  });
});

// Send all data to the background script to update the sheet
updateSheetBtn.addEventListener("click", () => {
  // Disable button and show status
  updateSheetBtn.disabled = true;
  updateSheetBtn.textContent = "Updating...";
  statusDiv.textContent = "Processing...";

  // Get the saved sheet URL from storage
  chrome.storage.local.get(["sheetUrl"], (result) => {
    if (!result.sheetUrl) {
      statusDiv.textContent = "No Sheet URL saved. Go to settings.";
      statusDiv.style.color = "red";
      updateSheetBtn.disabled = false;
      updateSheetBtn.textContent = "Update Sheet";
      return;
    }

    // Send all data to the background script
    chrome.runtime.sendMessage(
      {
        action: "updateSheet",
        sheetUrl: result.sheetUrl,
        status: statusInput.value,
        remarks: remarksInput.value,
        starred: starredInput.checked,
      },
      (response) => {
        if (response && response.success) {
          statusDiv.textContent = "Sheet updated successfully!";
          statusDiv.style.color = "green";
          // Clear inputs and close
          statusInput.value = "";
          remarksInput.value = "";
          starredInput.checked = false;
          setTimeout(() => window.close(), 1500);
        } else {
          statusDiv.textContent =
            response.error || "An unknown error occurred.";
          statusDiv.style.color = "red";
        }
        // Re-enable button
        updateSheetBtn.disabled = false;
        updateSheetBtn.textContent = "Update Sheet";
      }
    );
  });
});
