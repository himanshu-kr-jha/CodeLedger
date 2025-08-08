# CodeLedger: Track Your Coding Problems in Google Sheets

**CodeLedger** is a Chrome extension that lets you log coding problems you solve — directly into a **Google Sheet**.
Capture the problem’s title, URL, status, and remarks with a single click, and build a personal log of your progress.

---

## 🚀 Features

* **One-Click Logging** – Save problem details without leaving the page.
* **Google Sheets Integration** – Auto-creates and manages a *Page Info Tracker* sheet in your Google Drive.
* **Progress Tracking** – Mark problems as `Completed`, `Pending`, or `Attempted`.
* **Notes & Solutions** – Add remarks, solution ideas, or complexity analysis.
* **Star Important Problems** – Flag problems for easy revisiting.
* **Smart Updates** – No duplicates — existing entries are updated automatically.

---

## ⚙️ How It Works

1. **Authentication**

   * On first use, sign in via Google’s secure OAuth2 system.
2. **Sheet Initialization**

   * A Google Sheet named **Page Info Tracker** is created in your Drive with the required columns.
3. **Scraping Problem Info**

   * A content script extracts the problem title from the active page.
4. **Updating Your Log**

   * The background script sends the title, URL, status, remarks, and starred flag to your sheet.

---

## 📥 Installation

1. Download the extension files.
2. Open **Google Chrome** and go to:

   ```plaintext
   chrome://extensions
   ```
3. Enable **Developer mode** (top-right corner).
4. Click **Load unpacked** and select the extension folder.
5. The **CodeLedger** icon will appear in your Chrome toolbar.

---

## 📂 Project Structure

| File / Folder   | Description                                                            |
| --------------- | ---------------------------------------------------------------------- |
| `manifest.json` | Configures the extension, permissions, and features.                   |
| `popup.html`    | Extension popup UI layout.                                             |
| `popup.js`      | Handles popup interactions.                                            |
| `background.js` | Service worker for authentication, Google Sheets API calls, and logic. |
| `content.js`    | Injected script to extract problem titles from pages.                  |
| `images/`       | Icons for the extension.                                               |

---

## 🖱 Usage

1. Navigate to a coding problem page.
2. Click the **CodeLedger** icon in your Chrome toolbar.
3. If prompted, sign in with Google.
4. In the popup:

   * Set **Status** (`Completed`, `Pending`, `Attempted`).
   * Add **Remarks** (e.g., *"Solved using a hash map"*).
   * Toggle **Starred** for important problems.
5. Click **Update Sheet** to save.
6. Use the **open sheet** icon to view logs or the **settings** icon to manage account/sheet.

---

## 🤝 Contributing

Contributions are welcome!
Fork this repo, make your changes, and submit a pull request with a clear description of your improvements.

