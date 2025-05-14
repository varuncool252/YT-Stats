// Global state
let verboseLogging = false;

// Initialize video history if it doesn't exist
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('videoHistory', (data) => {
    if (!data.videoHistory) {
      chrome.storage.local.set({ videoHistory: [] });
      console.log('[YT History] Extension installed, initialized video history');
    }
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Track video
  if (message.action === 'trackVideo') {
    saveVideoToHistory(message.videoData);
    sendResponse({ status: 'success' });
    return true;
  }
  
  // Ping (for debugging)
  if (message.action === 'ping') {
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
  
  // Fix dashboard access
  if (message.action === 'fixDashboardAccess') {
    // Force reload web accessible resources
    chrome.runtime.getURL('dashboard.html');
    debugLog('Attempting to fix dashboard access');
    sendResponse({ 
      status: 'success', 
      message: 'Force-reloaded web accessible resources'
    });
    return true;
  }
  
  return true; // Required for async sendResponse
});

// Save video data to history
function saveVideoToHistory(videoData) {
  chrome.storage.local.get('videoHistory', (data) => {
    let videoHistory = data.videoHistory || [];
    
    // Check if it's a normal video that's already in history
    if (videoData.type === 'normal') {
      const existingIndex = videoHistory.findIndex(
        video => video.videoId === videoData.videoId && video.type === 'normal'
      );
      
      if (existingIndex >= 0) {
        // Increment view count for existing video
        videoHistory[existingIndex].views += 1;
        videoHistory[existingIndex].watchedAt = new Date().toISOString();
        
        debugLog(`Updated existing video: ${videoData.title} (${videoData.videoId}) - Views: ${videoHistory[existingIndex].views}`);
      } else {
        // Add new video
        videoHistory.push({
          ...videoData,
          watchedAt: new Date().toISOString()
        });
        
        debugLog(`Added new video: ${videoData.title} (${videoData.videoId})`);
      }
    } else {
      // For shorts, always add a new entry
      videoHistory.push({
        ...videoData,
        watchedAt: new Date().toISOString()
      });
      
      debugLog(`Added new short: ${videoData.creatorName} (${videoData.videoId})`);
    }
    
    chrome.storage.local.set({ videoHistory });
  });
}

// Debug logging function
function debugLog(message, type = 'info') {
  if (!verboseLogging && type === 'debug') {
    return; // Skip debug messages unless verbose logging is enabled
  }
  
  console.log(`[YT History] ${message}`);
  
  // In the background script, we don't need to send messages to ourselves
  // This prevents "Could not establish connection" errors
}