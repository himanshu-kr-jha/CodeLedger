// This script runs in the context of the active web page.

function scrapePageInfo() {
  // For a "Question Name", `h1` is a good first guess.
  // This can be customized for specific sites (e.g., '.question-title')
  const titleElement = document.querySelector("#problem-statement h3");
  const questionName = titleElement.innerText.trim();

  // The URL of the page.
  const url = window.location.href;

  // The current date and time.
  const timestamp = new Date().toLocaleString();

  return {
    questionName,
    url,
    timestamp,
  };
}

// Send the scraped data back to the script that executed this.
scrapePageInfo();
