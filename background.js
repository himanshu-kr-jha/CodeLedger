// Constants
const SHEET_NAME = "Page Info Tracker";

// Message handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "authenticate") {
    handleAuthentication(sendResponse);
    return true;
  } else if (request.action === "initializeSheet") {
    handleSheetInitialization(sendResponse);
    return true;
  } else if (request.action === "updateSheet") {
    handleUpdate(request, sendResponse);
    return true;
  } else if (request.action === "createNewSheet") {
    handleCreateNewSheet(sendResponse);
    return true;
  } else if (request.action === "logout") {
    handleLogout(sendResponse);
    return true;
  } else if (request.action === "getSheetUrl") {
    handleGetSheetUrl(sendResponse);
    return true;
  }
});

/**
 * Handles user authentication
 */
async function handleAuthentication(sendResponse) {
  try {
    const token = await getAuthToken();
    const userInfo = await getUserInfo(token);

    await chrome.storage.local.set({
      userEmail: userInfo.email,
      authToken: token,
    });

    sendResponse({ success: true, userInfo });
  } catch (error) {
    console.error("Authentication error:", error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handles sheet initialization (find existing or create new)
 */
async function handleSheetInitialization(sendResponse) {
  try {
    console.log("Starting sheet initialization...");

    // Get fresh token
    const token = await getAuthToken();
    console.log("Got auth token:", token ? "✓" : "✗");

    let spreadsheetId = await getStoredSpreadsheetId();
    console.log("Stored spreadsheet ID:", spreadsheetId || "none");

    if (spreadsheetId) {
      // Verify the sheet still exists
      try {
        console.log("Verifying existing sheet...");
        await verifySheetExists(token, spreadsheetId);
        console.log("Existing sheet verified successfully");
        sendResponse({ success: true, spreadsheetId, created: false });
        return;
      } catch (error) {
        console.log("Stored sheet verification failed:", error.message);
        spreadsheetId = null;
        // Clear invalid stored ID
        await chrome.storage.local.remove(["spreadsheetId"]);
      }
    }

    // Look for existing sheet by name (skip this step for now to avoid complexity)
    console.log("Skipping sheet search, creating new sheet directly...");

    // Create new sheet
    console.log("Creating new spreadsheet...");
    const newSheet = await createSpreadsheet(token, SHEET_NAME);
    console.log("New sheet created:", newSheet.spreadsheetId);

    await storeSpreadsheetId(newSheet.spreadsheetId);
    console.log("Spreadsheet ID stored");

    await setupSheetHeaders(token, newSheet.spreadsheetId);
    console.log("Headers setup complete");

    sendResponse({
      success: true,
      spreadsheetId: newSheet.spreadsheetId,
      created: true,
    });
  } catch (error) {
    console.error("Sheet initialization error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    // Provide more specific error messages
    let errorMessage = error.message;
    if (error.message.includes("invalid_grant")) {
      errorMessage =
        "Authentication expired. Please try signing out and signing in again.";
    } else if (error.message.includes("insufficient permissions")) {
      errorMessage = "Insufficient permissions. Please check the OAuth setup.";
    } else if (error.message.includes("quotaExceeded")) {
      errorMessage = "Google API quota exceeded. Please try again later.";
    }

    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Handles creating a new sheet manually
 */
async function handleCreateNewSheet(sendResponse) {
  try {
    const token = await getAuthToken();
    const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const sheetName = `${SHEET_NAME} - ${timestamp}`;

    const newSheet = await createSpreadsheet(token, sheetName);
    await storeSpreadsheetId(newSheet.spreadsheetId);
    await setupSheetHeaders(token, newSheet.spreadsheetId);

    sendResponse({ success: true, spreadsheetId: newSheet.spreadsheetId });
  } catch (error) {
    console.error("Create new sheet error:", error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handles user logout
 */
async function handleLogout(sendResponse) {
  try {
    // Clear cached auth token
    const token = await chrome.storage.local.get(["authToken"]);
    if (token.authToken) {
      chrome.identity.removeCachedAuthToken({ token: token.authToken });
    }

    // Clear all stored data
    await chrome.storage.local.clear();

    sendResponse({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handles getting sheet URL
 */
async function handleGetSheetUrl(sendResponse) {
  try {
    const spreadsheetId = await getStoredSpreadsheetId();
    if (spreadsheetId) {
      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
      sendResponse({ success: true, url });
    } else {
      sendResponse({ success: false, error: "No sheet found" });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Main function to orchestrate the sheet update
 */
async function handleUpdate(request, sendResponse) {
  try {
    const token = await getAuthToken();
    const spreadsheetId = await getStoredSpreadsheetId();

    if (!spreadsheetId) {
      throw new Error("No spreadsheet found. Please reinitialize.");
    }

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) throw new Error("Could not find active tab.");

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    const pageData = injectionResults[0].result;
    if (!pageData) throw new Error("Could not scrape data from the page.");

    // Find if the question already exists in the sheet
    const existingRowInfo = await findQuestionRow(
      token,
      spreadsheetId,
      pageData.questionName
    );

    const combinedData = {
      ...pageData,
      status: request.status,
      remarks: request.remarks,
      starred: request.starred,
    };

    if (existingRowInfo) {
      await updateExistingRow(
        token,
        spreadsheetId,
        existingRowInfo,
        combinedData
      );
    } else {
      await appendNewRow(token, spreadsheetId, combinedData);
    }

    sendResponse({ success: true });
  } catch (error) {
    console.error("Error updating sheet:", error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Gets user info from Google API
 */
async function getUserInfo(token) {
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get user info");
  }

  return await response.json();
}

/**
 * Finds a sheet by name using Drive API
 */
async function findSheetByName(token, name) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(
      name
    )}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to search for existing sheets");
  }

  const data = await response.json();
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

/**
 * Verifies that a sheet still exists and is accessible
 */
async function verifySheetExists(token, spreadsheetId) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error("Sheet no longer exists or is not accessible");
  }

  return await response.json();
}

/**
 * Creates a new spreadsheet with better error handling
 */
async function createSpreadsheet(token, title) {
  console.log(`Creating spreadsheet with title: "${title}"`);

  const requestBody = {
    properties: {
      title: title,
      locale: "en_US",
      timeZone: "GMT",
    },
    sheets: [
      {
        properties: {
          title: "Sheet1",
          gridProperties: {
            rowCount: 1000,
            columnCount: 10,
          },
        },
      },
    ],
  };

  console.log("Request body:", JSON.stringify(requestBody, null, 2));

  const response = await fetch(
    "https://sheets.googleapis.com/v4/spreadsheets",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    }
  );

  console.log("Create spreadsheet response status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Create spreadsheet error response:", errorText);

    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch (e) {
      throw new Error(
        `Failed to create spreadsheet: ${response.status} ${response.statusText}`
      );
    }

    throw new Error(
      `Failed to create spreadsheet: ${errorData.error?.message || errorText}`
    );
  }

  const result = await response.json();
  console.log("Spreadsheet created successfully:", result.spreadsheetId);
  return result;
}

/**
 * Sets up the headers for the spreadsheet
 */
async function setupSheetHeaders(token, spreadsheetId) {
  const range = "Sheet1!A1:F1";
  const headers = [
    "Sno",
    "Question Name",
    "Link",
    "Status",
    "Remarks",
    "Starred",
  ];

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [headers],
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to setup headers: ${errorData.error.message}`);
  }

  // Format the header row
  await formatHeaderRow(token, spreadsheetId);
}

/**
 * Formats the header row to make it bold
 */
async function formatHeaderRow(token, spreadsheetId) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 6,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: {
                    bold: true,
                  },
                },
              },
              fields: "userEnteredFormat.textFormat.bold",
            },
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    console.warn("Failed to format header row, but continuing...");
  }
}

/**
 * Storage helpers
 */
async function storeSpreadsheetId(spreadsheetId) {
  await chrome.storage.local.set({ spreadsheetId });
}

async function getStoredSpreadsheetId() {
  const result = await chrome.storage.local.get(["spreadsheetId"]);
  return result.spreadsheetId;
}

/**
 * Finds if a question already exists in the sheet
 */
async function findQuestionRow(token, spreadsheetId, questionName) {
  const range = "Sheet1!A:F";
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok)
    throw new Error("Failed to fetch sheet data for checking duplicates.");

  const data = await response.json();
  const rows = data.values || [];

  for (let i = 1; i < rows.length; i++) {
    // Start from 1 to skip header
    const row = rows[i];
    if (row[1] && row[1].trim() === questionName.trim()) {
      return {
        rowIndex: i + 1,
        oldRemarks: row[4] || "",
      };
    }
  }
  return null;
}

/**
 * Updates an existing row in the sheet
 */
async function updateExistingRow(token, spreadsheetId, existingRowInfo, data) {
  const { rowIndex, oldRemarks } = existingRowInfo;

  const newRemarks = data.remarks
    ? `${oldRemarks}\n[${new Date().toLocaleString()}] ${data.remarks}`.trim()
    : oldRemarks;

  const range = `Sheet1!D${rowIndex}:F${rowIndex}`;
  const valueInputOption = "USER_ENTERED";

  const values = [[data.status, newRemarks, data.starred ? "Yes" : "No"]];

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=${valueInputOption}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Failed to update existing row: ${errorData.error.message}`
    );
  }
}

/**
 * Appends a new row to the sheet
 */
async function appendNewRow(token, spreadsheetId, data) {
  const range = "Sheet1!A1";
  const valueInputOption = "USER_ENTERED";
  const insertDataOption = "INSERT_ROWS";

  const values = [
    [
      "", // Sno (Leave blank for manual numbering or formula)
      data.questionName,
      data.url,
      data.status,
      data.remarks,
      data.starred ? "Yes" : "No",
    ],
  ];

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=${valueInputOption}&insertDataOption=${insertDataOption}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to append new row: ${errorData.error.message}`);
  }
}

/**
 * Gets authentication token with retry logic
 */
async function getAuthToken(forceRefresh = false) {
  return new Promise((resolve, reject) => {
    const options = { interactive: true };

    if (forceRefresh) {
      // First clear cached token if forcing refresh
      chrome.identity.getAuthToken({ interactive: false }, (cachedToken) => {
        if (cachedToken) {
          chrome.identity.removeCachedAuthToken({ token: cachedToken }, () => {
            // Now get fresh token
            chrome.identity.getAuthToken(options, (token) => {
              if (chrome.runtime.lastError) {
                console.error("Auth token error:", chrome.runtime.lastError);
                reject(new Error(chrome.runtime.lastError.message));
              } else if (!token) {
                reject(new Error("No token received"));
              } else {
                console.log("Fresh token obtained");
                resolve(token);
              }
            });
          });
        } else {
          // No cached token, just get new one
          chrome.identity.getAuthToken(options, (token) => {
            if (chrome.runtime.lastError) {
              console.error("Auth token error:", chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message));
            } else if (!token) {
              reject(new Error("No token received"));
            } else {
              console.log("New token obtained");
              resolve(token);
            }
          });
        }
      });
    } else {
      chrome.identity.getAuthToken(options, (token) => {
        if (chrome.runtime.lastError) {
          console.error("Auth token error:", chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!token) {
          reject(new Error("No token received"));
        } else {
          console.log("Token obtained");
          resolve(token);
        }
      });
    }
  });
}
