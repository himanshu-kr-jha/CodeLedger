
function scrapePageInfo() {
  let questionName = "";

  // Try multiple selectors for different sites
  const selectors = [
    "#problem-statement h3", // Original selector
    "h1", // Most common page title
    ".question-title", // Common class for question titles
    "[data-cy='question-title']", // Cypress test attribute
    ".problem-title", // Another common pattern
    "title", // Fallback to page title
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      if (selector === "title") {
        questionName = element.textContent.trim();
      } else {
        questionName = element.textContent.trim();
      }
      break;
    }
  }

  // If no title found, use page title as fallback
  if (!questionName) {
    questionName = document.title || "Untitled Page";
  }

  // Clean up the question name (remove extra whitespace, limit length)
  questionName = questionName.replace(/\s+/g, " ").trim();
  if (questionName.length > 100) {
    questionName = questionName.substring(0, 100) + "...";
  }

  // The URL of the page
  const url = window.location.href;

  // The current date and time
  const timestamp = new Date().toLocaleString();

  return {
    questionName,
    url,
    timestamp,
  };
}

// Send the scraped data back to the script that executed this
scrapePageInfo();
