// Get references to all UI elements
const loginView = document.getElementById("loginView");
const initView = document.getElementById("initView");
const mainView = document.getElementById("mainView");
const settingsView = document.getElementById("settingsView");

// Login view elements
const loginBtn = document.getElementById("loginBtn");
const loginStatus = document.getElementById("loginStatus");

// Init view elements
const initMessage = document.getElementById("initMessage");
const initStatus = document.getElementById("initStatus");

// Main view elements
const userEmail = document.getElementById("userEmail");
const openSheetBtn = document.getElementById("openSheetBtn");
const settingsBtn = document.getElementById("settingsBtn");
const statusInput = document.getElementById("statusInput");
const remarksInput = document.getElementById("remarksInput");
const starredInput = document.getElementById("starredInput");
const updateSheetBtn = document.getElementById("updateSheetBtn");
const statusDiv = document.getElementById("status");

// Settings view elements
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const settingsUserEmail = document.getElementById("settingsUserEmail");
const sheetName = document.getElementById("sheetName");
const logoutBtn = document.getElementById("logoutBtn");
const createNewSheetBtn = document.getElementById("createNewSheetBtn");
const settingsStatus = document.getElementById("settingsStatus");

// --- View Management ---
function showView(viewToShow) {
  [loginView, initView, mainView, settingsView].forEach((view) => {
    view.classList.add("hidden");
  });
  viewToShow.classList.remove("hidden");
}

function showLoginView() {
  showView(loginView);
}

function showInitView() {
  showView(initView);
}

function showMainView() {
  showView(mainView);
}

function showSettingsView() {
  showView(settingsView);
}

// --- Authentication Flow ---
async function checkAuthenticationState() {
  try {
    const stored = await chrome.storage.local.get([
      "userEmail",
      "spreadsheetId",
    ]);

    if (!stored.userEmail) {
      showLoginView();
      return;
    }

    if (!stored.spreadsheetId) {
      showInitView();
      await initializeSheet();
      return;
    }

    // User is authenticated and has a sheet
    await loadMainView(stored);
  } catch (error) {
    console.error("Error checking auth state:", error);
    showLoginView();
  }
}

async function loadMainView(stored) {
  userEmail.textContent = stored.userEmail;
  settingsUserEmail.textContent = stored.userEmail;

  // Get sheet name for display
  try {
    const response = await chrome.runtime.sendMessage({
      action: "getSheetUrl",
    });

    if (response.success) {
      sheetName.textContent = "Page Info Tracker";
    }
  } catch (error) {
    console.error("Error getting sheet info:", error);
  }

  showMainView();
}

async function initializeSheet() {
  initMessage.textContent = "Setting up your workspace...";
  initStatus.textContent = "";
  initStatus.style.color = "";

  try {
    console.log("Starting sheet initialization from popup...");

    const response = await chrome.runtime.sendMessage({
      action: "initializeSheet",
    });

    console.log("Sheet initialization response:", response);

    if (response.success) {
      if (response.created) {
        initMessage.textContent = "Created new sheet successfully!";
        initStatus.textContent = "Your workspace is ready!";
        initStatus.style.color = "green";
      } else {
        initMessage.textContent = "Found existing sheet!";
        initStatus.textContent = "Connected to your workspace";
        initStatus.style.color = "green";
      }

      setTimeout(async () => {
        const stored = await chrome.storage.local.get([
          "userEmail",
          "spreadsheetId",
        ]);
        console.log("Loading main view with:", stored);
        await loadMainView(stored);
      }, 1500);
    } else {
      throw new Error(response.error || "Unknown initialization error");
    }
  } catch (error) {
    console.error("Sheet initialization error in popup:", error);

    initMessage.textContent = "Setup failed";
    initStatus.textContent = `Error: ${error.message}`;
    initStatus.style.color = "red";

    // Add retry button
    const retryBtn = document.createElement("button");
    retryBtn.textContent = "Retry Setup";
    retryBtn.className =
      "mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm";
    retryBtn.onclick = () => {
      retryBtn.remove();
      initializeSheet();
    };

    initView.appendChild(retryBtn);

    // Also offer option to go back to login
    setTimeout(() => {
      const backBtn = document.createElement("button");
      backBtn.textContent = "Back to Login";
      backBtn.className =
        "mt-2 ml-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm";
      backBtn.onclick = () => {
        // Clear any stored data and go back to login
        chrome.storage.local.clear().then(() => {
          showLoginView();
        });
      };

      if (!document.querySelector(".mt-2.ml-2")) {
        initView.appendChild(backBtn);
      }
    }, 2000);
  }
}

// --- Event Listeners ---

// Login button
loginBtn.addEventListener("click", async () => {
  loginBtn.disabled = true;
  loginBtn.innerHTML = `
    <div class="spinner"></div>
    Signing in...
  `;
  loginStatus.textContent = "Authenticating...";

  try {
    const response = await chrome.runtime.sendMessage({
      action: "authenticate",
    });

    if (response.success) {
      loginStatus.textContent = "Signed in successfully!";
      loginStatus.style.color = "green";

      setTimeout(() => {
        showInitView();
        initializeSheet();
      }, 1000);
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error("Login error:", error);
    loginStatus.textContent = `Error: ${error.message}`;
    loginStatus.style.color = "red";

    loginBtn.disabled = false;
    loginBtn.innerHTML = `
      <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24">
        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Sign in with Google
    `;
  }
});

// Settings navigation
settingsBtn.addEventListener("click", showSettingsView);
closeSettingsBtn.addEventListener("click", showMainView);

// Open sheet in new tab
openSheetBtn.addEventListener("click", async () => {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "getSheetUrl",
    });

    if (response.success) {
      chrome.tabs.create({ url: response.url });
    } else {
      statusDiv.textContent = "Could not open sheet";
      statusDiv.style.color = "red";
    }
  } catch (error) {
    console.error("Error opening sheet:", error);
    statusDiv.textContent = "Error opening sheet";
    statusDiv.style.color = "red";
  }
});

// Update sheet button
updateSheetBtn.addEventListener("click", async () => {
  updateSheetBtn.disabled = true;
  updateSheetBtn.textContent = "Updating...";
  statusDiv.textContent = "Processing...";
  statusDiv.style.color = "";

  try {
    const response = await chrome.runtime.sendMessage({
      action: "updateSheet",
      status: statusInput.value,
      remarks: remarksInput.value,
      starred: starredInput.checked,
    });

    if (response.success) {
      statusDiv.textContent = "Sheet updated successfully!";
      statusDiv.style.color = "green";

      // Clear inputs
      statusInput.value = "";
      remarksInput.value = "";
      starredInput.checked = false;

      setTimeout(() => window.close(), 1500);
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error("Update error:", error);
    statusDiv.textContent = error.message || "An error occurred";
    statusDiv.style.color = "red";
  } finally {
    updateSheetBtn.disabled = false;
    updateSheetBtn.textContent = "Update Sheet";
  }
});

// Logout button
logoutBtn.addEventListener("click", async () => {
  if (
    confirm(
      "Are you sure you want to sign out? You'll need to sign in again to use the extension."
    )
  ) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "logout",
      });

      if (response.success) {
        settingsStatus.textContent = "Signed out successfully";
        settingsStatus.style.color = "green";

        setTimeout(() => {
          showLoginView();
          settingsStatus.textContent = "";
        }, 1000);
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error("Logout error:", error);
      settingsStatus.textContent = `Error: ${error.message}`;
      settingsStatus.style.color = "red";
    }
  }
});

// Create new sheet button
createNewSheetBtn.addEventListener("click", async () => {
  if (
    confirm(
      "This will create a new sheet and switch to using it. Your current sheet will remain unchanged. Continue?"
    )
  ) {
    createNewSheetBtn.disabled = true;
    createNewSheetBtn.textContent = "Creating...";
    settingsStatus.textContent = "Creating new sheet...";
    settingsStatus.style.color = "";

    try {
      const response = await chrome.runtime.sendMessage({
        action: "createNewSheet",
      });

      if (response.success) {
        settingsStatus.textContent = "New sheet created successfully!";
        settingsStatus.style.color = "green";

        setTimeout(() => {
          showMainView();
          settingsStatus.textContent = "";
        }, 1500);
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error("Create sheet error:", error);
      settingsStatus.textContent = `Error: ${error.message}`;
      settingsStatus.style.color = "red";
    } finally {
      createNewSheetBtn.disabled = false;
      createNewSheetBtn.textContent = "Create New Sheet";
    }
  }
});

// --- Initialize on popup open ---
document.addEventListener("DOMContentLoaded", () => {
  checkAuthenticationState();
});

// Add this to your popup.js temporarily for debugging
// You can remove it once the issue is resolved

// Add debug logging to the authentication process
async function debugAuthentication() {
  console.log("=== DEBUG: Starting authentication check ===");
  
  try {
    // Check what's stored
    const stored = await chrome.storage.local.get(null);
    console.log("=== DEBUG: Stored data ===", stored);
    
    // Check if we can get a token
    console.log("=== DEBUG: Testing token retrieval ===");
    const response = await chrome.runtime.sendMessage({
      action: "authenticate"
    });
    console.log("=== DEBUG: Auth response ===", response);
    
    // Test sheet creation directly
    console.log("=== DEBUG: Testing sheet creation ===");
    const sheetResponse = await chrome.runtime.sendMessage({
      action: "initializeSheet"
    });
    console.log("=== DEBUG: Sheet response ===", sheetResponse);
    
  } catch (error) {
    console.error("=== DEBUG: Error during testing ===", error);
  }
}

// Add a debug button to your popup (add this to the login view in popup.html)
/*
<button id="debugBtn" style="margin-top: 10px; padding: 8px; background: orange; color: white; border: none; border-radius: 4px;">
  Debug Info
</button>
*/

// Then add this event listener in popup.js
// document.getElementById("debugBtn")?.addEventListener("click", debugAuthentication);

// Also add this to check the manifest and permissions
function checkManifestPermissions() {
  console.log("=== DEBUG: Checking permissions ===");
  
  // Check if we have the required permissions
  chrome.permissions.getAll((permissions) => {
    console.log("=== DEBUG: Current permissions ===", permissions);
  });
  
  // Check OAuth config
  const manifest = chrome.runtime.getManifest();
  console.log("=== DEBUG: OAuth config ===", manifest.oauth2);
  console.log("=== DEBUG: Permissions ===", manifest.permissions);
}