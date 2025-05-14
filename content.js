// Variables to keep track of current page and videos
let currentUrl = '';
let isTracking = false;
let checkInterval = null;
let currentVideoData = null;
let verboseLogging = false;
let testNavDetectionActive = false;

// Main initialization function
function initialize() {
  currentUrl = window.location.href;
  
  debugLog(`Initializing content script for ${currentUrl}`, 'debug');
  
  // Clear any existing interval
  if (checkInterval) {
    clearInterval(checkInterval);
    debugLog('Cleared existing check interval', 'debug');
  }
  
  // Reset tracking flags
  isTracking = false;
  currentVideoData = null;
  
  // Start checking for video changes
  checkInterval = setInterval(checkForVideoChanges, 1000);
  debugLog('Started video change detection interval', 'debug');
  
  // Perform initial check right away
  checkForVideoChanges();
}

// Function to check if the video has changed or if we've navigated to a new page
function checkForVideoChanges() {
  const url = window.location.href;
  
  // Check for history state changes even if URL hasn't changed
  const videoId = isYouTubeVideoPage(url) ? getVideoIdFromUrl(url) : 
                  isYouTubeShortsPage(url) ? getShortsIdFromUrl(url) : null;
  
  // For video pages, check if the video ID matches our current data
  const videoChanged = currentVideoData && 
                      videoId && 
                      currentVideoData.videoId !== videoId;
  
  // Skip if we're still on the same URL/video and already tracking 
  if (url === currentUrl && isTracking && !videoChanged) {
    return;
  }
  
  // Update tracking if URL has changed
  if (url !== currentUrl || videoChanged) {
    debugLog(`URL or video changed: ${currentUrl} → ${url}${videoChanged ? ' (video ID changed)' : ''}`, 'info');
    
    // If test navigation detection is active, report the change
    if (testNavDetectionActive) {
      reportNavigationForTest(url);
    }
    
    currentUrl = url;
    isTracking = false;
    currentVideoData = null;
  }
  
  // Check if we're on a video page
  if (isYouTubeVideoPage(url)) {
    // Regular video
    processRegularVideo();
  } else if (isYouTubeShortsPage(url)) {
    // Shorts video
    processShorts();
  }
}

// Report navigation change for test
function reportNavigationForTest(url) {
  let pageType = 'unknown';
  let data = { url };
  
  if (isYouTubeVideoPage(url)) {
    pageType = 'video';
    const videoId = getVideoIdFromUrl(url);
    data.videoId = videoId;
    
    // Try to get title and channel
    const titleElement = findVideoTitleElement();
    const channelElement = findChannelElement();
    
    if (titleElement) data.title = titleElement.textContent.trim();
    if (channelElement) data.channel = channelElement.textContent.trim();
  } else if (isYouTubeShortsPage(url)) {
    pageType = 'shorts';
    const shortsId = getShortsIdFromUrl(url);
    data.shortsId = shortsId;
    
    // Try to get creator
    const creatorInfo = findShortsCreator();
    if (creatorInfo && creatorInfo.element) {
      data.creator = creatorInfo.element.textContent.trim();
    }
  }
  
  data.pageType = pageType;
  
  chrome.runtime.sendMessage({
    action: 'navDetectionResult',
    ...data
  });
}

// Find video title element using multiple selectors
function findVideoTitleElement() {
  // Try different selectors for title
  const selectors = [
    'h1.ytd-watch-metadata',
    'h1.title.ytd-video-primary-info-renderer',
    '#above-the-fold #title h1',
    'h1'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      if (verboseLogging) {
        debugLog(`Found title element with selector: ${selector}`, 'debug');
      }
      return element;
    }
  }
  
  return null;
}

// Find channel element using multiple selectors
function findChannelElement() {
  // Try different selectors for channel
  const selectors = [
    'ytd-channel-name a',
    '#owner-text a',
    '#channel-name a',
    'a.yt-simple-endpoint.style-scope.yt-formatted-string',
    '#upload-info .ytd-channel-name'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      if (verboseLogging) {
        debugLog(`Found channel element with selector: ${selector}`, 'debug');
      }
      return element;
    }
  }
  
  return null;
}

// Process a regular YouTube video page
function processRegularVideo() {
  if (isTracking) return;
  
  // Extract video ID from URL
  const videoId = getVideoIdFromUrl(window.location.href);
  if (!videoId) {
    debugLog('Could not extract video ID from URL', 'warning');
    return;
  }
  
  // Wait for video title to load
  const titleElement = findVideoTitleElement();
  const channelElement = findChannelElement();
  
  if (!titleElement || !channelElement) {
    // Elements not loaded yet, will try again next interval
    if (verboseLogging) {
      debugLog('Video metadata not fully loaded yet, waiting...', 'debug');
    }
    return;
  }
  
  const title = titleElement.textContent.trim();
  const channel = channelElement.textContent.trim();
  
  if (!title || !channel) {
    debugLog('Title or channel name is empty', 'warning');
    return;
  }
  
  debugLog(`Tracking video: "${title}" by ${channel} (ID: ${videoId})`, 'info');
  
  // Create video data object for normal videos
  currentVideoData = {
    title: title,
    channel: channel,
    videoId: videoId,
    type: 'normal',
    views: 1
  };
  
  // Send to background script
  chrome.runtime.sendMessage({
    action: 'trackVideo',
    videoData: currentVideoData
  }, (response) => {
    if (chrome.runtime.lastError) {
      debugLog('Error sending video data to background: ' + chrome.runtime.lastError.message, 'error');
    } else if (response && response.status === 'success') {
      debugLog('Video successfully tracked', 'success');
    }
  });
  
  isTracking = true;
}

// Find shorts creator element
function findShortsCreator() {
  // List of selectors to try for finding the creator name
  const selectors = [
    // Primary selectors
    'ytd-shorts ytd-channel-name a',
    'span.yt-core-attributed-string a.yt-core-attributed-string__link--call-to-action.yt-core-attributed-string__link',
    'a.ytd-reel-player-header-renderer',
    '#shorts-creator',
    // Secondary class-based selectors
    '.shorts-video-metadata-header-text',
    '.reel-player-header-renderer',
    '.reel-player-header',
    '.short-metadata-text-container'
  ];
  
  // Try each selector
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent && element.textContent.trim()) {
      if (verboseLogging) {
        debugLog(`Found creator element with selector: ${selector}`, 'debug');
      }
      return { element, selector };
    }
  }
  
  // If no selector works, try to find any element with @ in its text content
  const allElements = document.querySelectorAll('a');
  const creatorElements = [];
  
  for (const el of allElements) {
    if (el.textContent && el.textContent.trim().startsWith('@')) {
      creatorElements.push(el);
    }
  }
  
  if (creatorElements.length > 0) {
    if (verboseLogging) {
      debugLog(`Found ${creatorElements.length} potential creator elements by @ prefix`, 'debug');
    }
    return { element: creatorElements[0], selector: "generic-@-search" };
  }
  
  // If still not found, look for any element containing "channel"
  const channelElements = document.querySelectorAll('[id*="channel"], [class*="channel"]');
  if (channelElements.length > 0) {
    for (const el of channelElements) {
      if (el.textContent && el.textContent.trim()) {
        return { element: el, selector: "channel-contains-search" };
      }
    }
  }
  
  return null;
}

// Process a YouTube Shorts page
function processShorts() {
  if (isTracking) return;
  
  // Extract video ID from URL
  const videoId = getShortsIdFromUrl(window.location.href);
  if (!videoId) {
    debugLog('Could not extract shorts ID from URL', 'warning');
    return;
  }
  
  // For Shorts, find the creator name
  const creatorInfo = findShortsCreator();
  
  if (!creatorInfo || !creatorInfo.element) {
    // Elements not loaded yet, will try again next interval
    if (verboseLogging) {
      debugLog('Shorts creator element not loaded yet, waiting...', 'debug');
    }
    return;
  }
  
  let creatorName = creatorInfo.element.textContent.trim();
  
  // Make sure creator name has the @ prefix
  if (creatorName && !creatorName.startsWith('@')) {
    creatorName = '@' + creatorName;
  }
  
  if (!creatorName) {
    debugLog('Creator name is empty', 'warning');
    return;
  }
  
  debugLog(`Tracking short from ${creatorName} (ID: ${videoId})`, 'info');
  
  // Create video data object for shorts
  currentVideoData = {
    creatorName: creatorName,
    type: 'short',
    videoId: videoId
  };
  
  // Send to background script
  chrome.runtime.sendMessage({
    action: 'trackVideo',
    videoData: currentVideoData
  }, (response) => {
    if (chrome.runtime.lastError) {
      debugLog('Error sending shorts data to background: ' + chrome.runtime.lastError.message, 'error');
    } else if (response && response.status === 'success') {
      debugLog('Short successfully tracked', 'success');
    }
  });
  
  isTracking = true;
}

// Function to check if URL is a YouTube video page
function isYouTubeVideoPage(url) {
  return url.includes('youtube.com/watch') && url.includes('v=');
}

// Function to check if URL is a YouTube Shorts page
function isYouTubeShortsPage(url) {
  return url.includes('youtube.com/shorts/');
}

// Function to extract video ID from URL
function getVideoIdFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('v');
  } catch (e) {
    debugLog('Error parsing URL: ' + e.message, 'error');
    return null;
  }
}

// Function to extract shorts ID from URL
function getShortsIdFromUrl(url) {
  const regex = /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Setup a more robust way to detect navigation changes
function setupNavigationDetection() {
  // Method 1: History state changes
  const originalPushState = history.pushState;
  history.pushState = function() {
    originalPushState.apply(this, arguments);
    debugLog('History pushState detected', 'debug');
    setTimeout(checkForVideoChanges, 500);
  };
  
  const originalReplaceState = history.replaceState;
  history.replaceState = function() {
    originalReplaceState.apply(this, arguments);
    debugLog('History replaceState detected', 'debug');
    setTimeout(checkForVideoChanges, 500);
  };
  
  // Method 2: Mutation observer - look for specific elements that appear during navigation
  const navObserver = new MutationObserver(function(mutations) {
    let shouldCheck = false;
    
    // Check for relevant mutations that may indicate a navigation
    for (const mutation of mutations) {
      // Look for added nodes that might indicate a page transition
      if (mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Look for key YouTube elements that appear during navigation
            if (
              node.id === 'content' || 
              node.id === 'page-manager' ||
              node.id === 'primary' ||
              node.tagName === 'YTD-WATCH-FLEXY' ||
              node.tagName === 'YTD-SHORTS'
            ) {
              shouldCheck = true;
              break;
            }
          }
        }
      }
      
      // Also check for URL changes
      if (window.location.href !== currentUrl) {
        shouldCheck = true;
        break;
      }
      
      if (shouldCheck) break;
    }
    
    if (shouldCheck) {
      debugLog('Significant DOM change detected, checking for navigation', 'debug');
      setTimeout(checkForVideoChanges, 500);
    }
  });
  
  // Observe the entire document, focusing on child list and subtree changes
  navObserver.observe(document.documentElement, { 
    childList: true, 
    subtree: true,
    attributes: false,
    characterData: false
  });
  
  debugLog('Advanced navigation detection set up', 'debug');
}

// Debug logging function
function debugLog(message, type = 'info') {
  if (!verboseLogging && type === 'debug') {
    return; // Skip debug messages unless verbose logging is enabled
  }
  
  console.log(`[YT History] ${message}`);
  
  // Send to debug console if it exists
  try {
    chrome.runtime.sendMessage({
      action: 'debugLog',
      message: message,
      type: type
    });
  } catch (error) {
    // Debug console not open, ignore
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Basic page info
  if (message.action === 'getPageInfo') {
    sendResponse({
      url: window.location.href,
      isVideo: isYouTubeVideoPage(window.location.href),
      isShorts: isYouTubeShortsPage(window.location.href)
    });
    return true;
  }
  
  // Ping for debug console
  if (message.action === 'pingContent') {
    debugLog('Received ping from debug console');
    sendResponse({ status: 'ok' });
    return true;
  }
  
  // Set logging level
  if (message.action === 'setLoggingLevel') {
    verboseLogging = message.level === 'verbose';
    debugLog(`Logging level set to ${message.level}`);
    return true;
  }
  
  // Check YouTube detection
  if (message.action === 'checkYouTube') {
    const url = window.location.href;
    let pageType = 'unknown';
    
    if (isYouTubeVideoPage(url)) {
      pageType = 'video';
    } else if (isYouTubeShortsPage(url)) {
      pageType = 'shorts';
    } else if (url.includes('youtube.com')) {
      pageType = 'youtube-other';
    }
    
    debugLog(`YouTube check: ${pageType}`);
    sendResponse({ pageType });
    return true;
  }
  
  // Test video detection
  if (message.action === 'testVideoDetection') {
    const url = window.location.href;
    const isVideoPage = isYouTubeVideoPage(url);
    
    let response = { isVideoPage };
    
    if (isVideoPage) {
      const videoId = getVideoIdFromUrl(url);
      const titleElement = findVideoTitleElement();
      const channelElement = findChannelElement();
      
      response.videoId = videoId;
      response.title = titleElement ? titleElement.textContent.trim() : null;
      response.channel = channelElement ? channelElement.textContent.trim() : null;
      
      debugLog(`Video detection test: Found video ${videoId}`, 'debug');
    } else {
      debugLog('Video detection test: Not a video page', 'debug');
    }
    
    sendResponse(response);
    return true;
  }
  
  // Test shorts detection
  if (message.action === 'testShortsDetection') {
    const url = window.location.href;
    const isShortsPage = isYouTubeShortsPage(url);
    
    let response = { isShortsPage };
    
    if (isShortsPage) {
      const shortsId = getShortsIdFromUrl(url);
      const creatorInfo = findShortsCreator();
      
      response.shortsId = shortsId;
      
      if (creatorInfo && creatorInfo.element) {
        let creatorName = creatorInfo.element.textContent.trim();
        if (creatorName && !creatorName.startsWith('@')) {
          creatorName = '@' + creatorName;
        }
        response.creator = creatorName;
      }
      
      // Find all potential creator elements for debugging
      const allElements = document.querySelectorAll('a');
      const allCreators = [];
      
      for (const el of allElements) {
        if (el.textContent && el.textContent.trim()) {
          allCreators.push({
            text: el.textContent.trim(),
            classes: el.className,
            id: el.id
          });
        }
      }
      
      response.allCreators = allCreators.slice(0, 10); // Limit to first 10 for brevity
      
      debugLog(`Shorts detection test: Found shorts ${shortsId}`, 'debug');
    } else {
      debugLog('Shorts detection test: Not a shorts page', 'debug');
    }
    
    sendResponse(response);
    return true;
  }
  
  // Test navigation detection
  if (message.action === 'testNavigationDetection') {
    testNavDetectionActive = true;
    
    // Report current status
    sendResponse({
      currentUrl: window.location.href,
      isMonitoring: !!checkInterval,
      testInitialized: true
    });
    
    debugLog('Navigation detection test started - watching for page changes', 'info');
    
    // Report initial page
    reportNavigationForTest(window.location.href);
    
    return true;
  }
  
  return true;
});

// Setup more robust navigation detection
setupNavigationDetection();

// Initialize when the script loads
initialize();