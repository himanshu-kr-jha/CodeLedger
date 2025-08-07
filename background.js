// Listens for the message from popup.js to start the process.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateSheet") {
    handleUpdate(request, sendResponse);
    return true; // Indicates an asynchronous response.
  }
});

/**
 * Main function to orchestrate the sheet update.
 * @param {object} request - The full request object from popup.js.
 * @param {function} sendResponse - Callback to send a response to the popup.
 */
async function handleUpdate(request, sendResponse) {
  try {
    const token = await getAuthToken();
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

    const spreadsheetId = extractSheetId(request.sheetUrl);
    if (!spreadsheetId) throw new Error("Invalid Google Sheet URL.");

    // --- NEW LOGIC STARTS HERE ---

    // 1. Find if the question already exists in the sheet.
    const existingRowInfo = await findQuestionRow(
      token,
      spreadsheetId,
      pageData.questionName
    );

    const combinedData = {
      ...pageData, // contains questionName, url
      status: request.status,
      remarks: request.remarks,
      starred: request.starred,
    };

    if (existingRowInfo) {
      // 2a. If it exists, UPDATE the row.
      await updateExistingRow(
        token,
        spreadsheetId,
        existingRowInfo,
        combinedData
      );
    } else {
      // 2b. If it doesn't exist, APPEND a new row.
      await appendNewRow(token, spreadsheetId, combinedData);
    }

    sendResponse({ success: true });
  } catch (error) {
    console.error("Error updating sheet:", error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Fetches the sheet data and finds the row number of a matching question.
 * @param {string} token - The OAuth token.
 * @param {string} spreadsheetId - The ID of the spreadsheet.
 * @param {string} questionName - The question name to search for.
 * @returns {Promise<object|null>} An object with { rowIndex, oldRemarks } or null if not found.
 */
async function findQuestionRow(token, spreadsheetId, questionName) {
  // Fetch a broad range of data. We assume the Question Name is in column B (index 1).
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

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Check if the question name in column B matches.
    if (row[1] && row[1].trim() === questionName.trim()) {
      return {
        rowIndex: i + 1, // Sheets are 1-indexed
        oldRemarks: row[4] || "", // Remarks are in column E (index 4)
      };
    }
  }
  return null; // Not found
}

/**
 * Updates an existing row in the sheet.
 * @param {string} token - The OAuth token.
 * @param {string} spreadsheetId - The ID of the spreadsheet.
 * @param {object} existingRowInfo - The object from findQuestionRow.
 * @param {object} data - The new data to update with.
 */
async function updateExistingRow(token, spreadsheetId, existingRowInfo, data) {
  const { rowIndex, oldRemarks } = existingRowInfo;

  // Append new remarks to old remarks with a timestamp.
  const newRemarks = data.remarks
    ? `${oldRemarks}\n[${new Date().toLocaleString()}] ${data.remarks}`.trim()
    : oldRemarks;

  // We are updating Status (D), Remarks (E), and Starred (F).
  const range = `Sheet1!D${rowIndex}:F${rowIndex}`;
  const valueInputOption = "USER_ENTERED";

  const values = [[data.status, newRemarks, data.starred ? "Yes" : "No"]];

  const body = { values: values };

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=${valueInputOption}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Google Sheets API Update Error: ${errorData.error.message}`
    );
  }
}

/**
 * Appends a new row to the sheet (original functionality).
 * @param {string} token - The OAuth token.
 * @param {string} spreadsheetId - The ID of the spreadsheet.
 * @param {object} data - The combined data object.
 */
async function appendNewRow(token, spreadsheetId, data) {
  const range = "Sheet1!A1";
  const valueInputOption = "USER_ENTERED";
  const insertDataOption = "INSERT_ROWS";

  const values = [
    [
      "", // A. Sno (Leave blank for sheet formula)
      data.questionName, // B. Question Name
      data.url, // C. Link
      data.status, // D. Status
      data.remarks, // E. Remarks
      data.starred ? "Yes" : "No", // F. Starred
    ],
  ];

  const body = { values: values };

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=${valueInputOption}&insertDataOption=${insertDataOption}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Google Sheets API Append Error: ${errorData.error.message}`
    );
  }
}

// --- Helper Functions (Unchanged) ---
function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

function extractSheetId(url) {
  const match = url.match(/\/d\/(.*?)\//);
  return match ? match[1] : null;
}
