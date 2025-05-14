// Initialize debugger
document.addEventListener('DOMContentLoaded', function() {
  // Elements
  const tabButtons = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const refreshBtn = document.getElementById('refreshBtn');
  const clearBtn = document.getElementById('clearBtn');
  const enableLogsBtn = document.getElementById('enableLogsBtn');
  const loadDataBtn = document.getElementById('loadDataBtn');
  const exportDataBtn = document.getElementById('exportDataBtn');
  const testDashboardBtn = document.getElementById('testDashboardBtn');
  const testVideoDetectionBtn = document.getElementById('testVideoDetectionBtn');
  const testShortsDetectionBtn = document.getElementById('testShortsDetectionBtn');
  const testNavigationBtn = document.getElementById('testNavigationBtn');
  const fixDashboardBtn = document.getElementById('fixDashboardBtn');
  
  const logOutput = document.getElementById('logOutput');
  const dataOutput = document.getElementById('dataOutput');
  const testOutput = document.getElementById('testOutput');
  const loggingStatus = document.getElementById('loggingStatus');
  
  // Status elements
  const backgroundStatus = document.getElementById('backgroundStatus');
  const contentStatus = document.getElementById('contentStatus');
  const storageStatus = document.getElementById('storageStatus');
  const youtubeStatus = document.getElementById('youtubeStatus');
  
  // Data stats
  const dataTotalItems = document.getElementById('dataTotalItems');
  const dataNormalVideos = document.getElementById('dataNormalVideos');
  const dataShortsVideos = document.getElementById('dataShortsVideos');
  const dataUniqueChannels = document.getElementById('dataUniqueChannels');
  
  // Test results
  const testVideoResult = document.getElementById('testVideoResult');
  const testShortsResult = document.getElementById('testShortsResult');
  const testNavigationResult = document.getElementById('testNavigationResult');
  const dashboardFixResult = document.getElementById('dashboardFixResult');
  
  // Global state
  let verboseLogging = false;
  let extensionData = null;
  
  // Tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Deactivate all tabs
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Activate clicked tab
      button.classList.add('active');
      const tabName = button.getAttribute('data-tab');
      document.getElementById(`${tabName}-content`).classList.add('active');
    });
  });
  
  // Button actions
  refreshBtn.addEventListener('click', checkExtensionStatus);
  clearBtn.addEventListener('click', clearLogs);
  enableLogsBtn.addEventListener('click', toggleVerboseLogging);
  loadDataBtn.addEventListener('click', loadStoredData);
  exportDataBtn.addEventListener('click', exportStoredData);
  testDashboardBtn.addEventListener('click', testDashboard);
  testVideoDetectionBtn.addEventListener('click', testVideoDetection);
  testShortsDetectionBtn.addEventListener('click', testShortsDetection);
  testNavigationBtn.addEventListener('click', testNavigationDetection);
  fixDashboardBtn.addEventListener('click', fixDashboardAccess);
  
  // Initialize
  appendLog("Debug console started");
  checkExtensionStatus();
  
  // Function to append a log message
  function appendLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    let colorClass = '';
    
    switch(type) {
      case 'error':
        colorClass = 'style="color: #ff5555;"';
        break;
      case 'success':
        colorClass = 'style="color: #55ff55;"';
        break;
      case 'warning':
        colorClass = 'style="color: #ffff55;"';
        break;
      case 'debug':
        colorClass = 'style="color: #5555ff;"';
        break;
      default:
        colorClass = '';
    }
    
    logOutput.innerHTML += `<div ${colorClass}>[${timestamp}] ${message}</div>`;
    logOutput.scrollTop = logOutput.scrollHeight;
  }
  
  // Check extension status
  function checkExtensionStatus() {
    appendLog("Checking extension status...");
    
    // Check background script
    chrome.runtime.sendMessage({ action: 'ping' }, function(response) {
      if (chrome.runtime.lastError) {
        updateStatus(backgroundStatus, 'error', 'Not responding: ' + chrome.runtime.lastError.message);
        appendLog("Background script error: " + chrome.runtime.lastError.message, 'error');
      } else if (response && response.status === 'ok') {
        updateStatus(backgroundStatus, 'success', 'Running');
        appendLog("Background script is running", 'success');
      } else {
        updateStatus(backgroundStatus, 'warning', 'Unknown response');
        appendLog("Background script returned unknown response", 'warning');
      }
    });
    
    // Check content script by sending message to all tabs
    chrome.tabs.query({}, function(tabs) {
      let contentFound = false;
      
      for (const tab of tabs) {
        if (tab.url && tab.url.includes('youtube.com')) {
          chrome.tabs.sendMessage(tab.id, { action: 'pingContent' }, function(response) {
            if (chrome.runtime.lastError) {
              if (verboseLogging) {
                appendLog(`Content script not found in tab ${tab.id}: ${chrome.runtime.lastError.message}`, 'debug');
              }
            } else if (response && response.status === 'ok') {
              contentFound = true;
              updateStatus(contentStatus, 'success', 'Running on YouTube');
              appendLog(`Content script found in tab ${tab.id} (${tab.url})`, 'success');
              
              // Check YouTube detection
              chrome.tabs.sendMessage(tab.id, { action: 'checkYouTube' }, function(ytResponse) {
                if (chrome.runtime.lastError) {
                  updateStatus(youtubeStatus, 'error', 'Detection failed');
                  appendLog("YouTube detection failed: " + chrome.runtime.lastError.message, 'error');
                } else if (ytResponse) {
                  updateStatus(youtubeStatus, 'success', 'Working');
                  appendLog(`YouTube detected: ${ytResponse.pageType}`, 'success');
                } else {
                  updateStatus(youtubeStatus, 'warning', 'Unknown response');
                  appendLog("YouTube detection returned unknown response", 'warning');
                }
              });
            }
          });
        }
      }
      
      setTimeout(() => {
        if (!contentFound) {
          updateStatus(contentStatus, 'warning', 'Not running on any YouTube tab');
          appendLog("No active YouTube tabs found with content script running", 'warning');
        }
      }, 1000);
    });
    
    // Check storage access
    chrome.storage.local.get('videoHistory', function(data) {
      if (chrome.runtime.lastError) {
        updateStatus(storageStatus, 'error', 'Cannot access');
        appendLog("Storage access error: " + chrome.runtime.lastError.message, 'error');
      } else {
        updateStatus(storageStatus, 'success', 'Accessible');
        const historyCount = data.videoHistory ? data.videoHistory.length : 0;
        appendLog(`Storage access successful. Video history count: ${historyCount}`, 'success');
      }
    });
  }
  
  // Update status display
  function updateStatus(element, type, message) {
    const statusSpan = element.querySelector('span');
    statusSpan.className = type;
    statusSpan.textContent = message;
  }
  
  // Clear logs
  function clearLogs() {
    logOutput.innerHTML = '[Logs cleared]';
    appendLog("Logs cleared");
  }
  
  // Toggle verbose logging
  function toggleVerboseLogging() {
    verboseLogging = !verboseLogging;
    
    if (verboseLogging) {
      enableLogsBtn.textContent = 'Disable Verbose Logging';
      loggingStatus.textContent = '(Verbose logging enabled)';
    } else {
      enableLogsBtn.textContent = 'Enable Verbose Logging';
      loggingStatus.textContent = '(Standard logging enabled)';
    }
    
    // Send to background script
    chrome.runtime.sendMessage({ 
      action: 'setLoggingLevel', 
      level: verboseLogging ? 'verbose' : 'standard' 
    });
    
    // Send to content scripts
    chrome.tabs.query({}, function(tabs) {
      for (const tab of tabs) {
        if (tab.url && tab.url.includes('youtube.com')) {
          chrome.tabs.sendMessage(tab.id, { 
            action: 'setLoggingLevel', 
            level: verboseLogging ? 'verbose' : 'standard' 
          });
        }
      }
    });
    
    appendLog(`Verbose logging ${verboseLogging ? 'enabled' : 'disabled'}`);
  }
  
  // Load stored data
  function loadStoredData() {
    appendLog("Loading stored data...");
    
    chrome.storage.local.get('videoHistory', function(data) {
      if (chrome.runtime.lastError) {
        appendLog("Error loading data: " + chrome.runtime.lastError.message, 'error');
        return;
      }
      
      extensionData = data.videoHistory || [];
      
      // Display data
      dataOutput.innerHTML = JSON.stringify(extensionData, null, 2);
      
      // Update stats
      updateDataStats(extensionData);
      
      appendLog(`Loaded ${extensionData.length} video entries`, 'success');
    });
  }
  
  // Update data statistics
  function updateDataStats(data) {
    const normalVideos = data.filter(video => video.type === 'normal');
    const shortsVideos = data.filter(video => video.type === 'short');
    
    // Get unique channels
    const allChannels = data.map(video => {
      return video.type === 'normal' ? video.channel : video.creatorName;
    });
    const uniqueChannels = [...new Set(allChannels)];
    
    // Update display
    dataTotalItems.innerHTML = `Total Videos: <span class="success">${data.length}</span>`;
    dataNormalVideos.innerHTML = `Normal Videos: <span class="success">${normalVideos.length}</span>`;
    dataShortsVideos.innerHTML = `Shorts Videos: <span class="success">${shortsVideos.length}</span>`;
    dataUniqueChannels.innerHTML = `Unique Channels: <span class="success">${uniqueChannels.length}</span>`;
  }
  
  // Export stored data
  function exportStoredData() {
    if (!extensionData) {
      appendLog("No data loaded. Please load data first.", 'warning');
      return;
    }
    
    const jsonString = JSON.stringify(extensionData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'youtube_history_debug_' + new Date().toISOString().split('T')[0] + '.json';
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
    
    appendLog("Data exported to file", 'success');
  }
  
  // Test dashboard
  function testDashboard() {
    appendLog("Testing dashboard access...");
    
    try {
      const dashboardUrl = chrome.runtime.getURL('dashboard.html');
      
      appendLog(`Dashboard URL: ${dashboardUrl}`, 'debug');
      
      // Try to open dashboard in new tab
      chrome.tabs.create({ url: dashboardUrl }, function(tab) {
        if (chrome.runtime.lastError) {
          appendLog("Error opening dashboard: " + chrome.runtime.lastError.message, 'error');
        } else {
          appendLog(`Dashboard opened in tab ${tab.id}`, 'success');
        }
      });
    } catch (error) {
      appendLog("Error accessing dashboard: " + error.message, 'error');
    }
  }
  
  // Test video detection
  function testVideoDetection() {
    appendLog("Testing video detection...");
    testOutput.innerHTML = "";
    
    // Find YouTube tabs
    chrome.tabs.query({ url: "*://*.youtube.com/*" }, function(tabs) {
      if (tabs.length === 0) {
        appendLog("No YouTube tabs found. Please open YouTube to test.", 'warning');
        updateTestResult(testVideoResult, 'warning', 'No YouTube tabs');
        return;
      }
      
      // Check each tab
      let videoTabsFound = 0;
      
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { action: 'testVideoDetection' }, function(response) {
          if (chrome.runtime.lastError) {
            appendLog(`Error in tab ${tab.id}: ${chrome.runtime.lastError.message}`, 'error');
            return;
          }
          
          if (response) {
            videoTabsFound++;
            
            testOutput.innerHTML += `Tab ${tab.id} (${tab.url}):\n`;
            testOutput.innerHTML += `- Is video page: ${response.isVideoPage}\n`;
            
            if (response.isVideoPage) {
              testOutput.innerHTML += `- Video ID: ${response.videoId || 'Not detected'}\n`;
              testOutput.innerHTML += `- Title: ${response.title || 'Not detected'}\n`;
              testOutput.innerHTML += `- Channel: ${response.channel || 'Not detected'}\n\n`;
            } else {
              testOutput.innerHTML += `- Not a video page\n\n`;
            }
            
            appendLog(`Tested video detection on tab ${tab.id}`, 'success');
          }
        });
      }
      
      setTimeout(() => {
        if (videoTabsFound > 0) {
          updateTestResult(testVideoResult, 'success', 'Detection tested');
        } else {
          updateTestResult(testVideoResult, 'error', 'No response from tabs');
          appendLog("No response from any YouTube tabs", 'error');
        }
      }, 1000);
    });
  }
  
  // Test shorts detection
  function testShortsDetection() {
    appendLog("Testing shorts detection...");
    testOutput.innerHTML = "";
    
    // Find YouTube tabs
    chrome.tabs.query({ url: "*://*.youtube.com/*" }, function(tabs) {
      if (tabs.length === 0) {
        appendLog("No YouTube tabs found. Please open YouTube to test.", 'warning');
        updateTestResult(testShortsResult, 'warning', 'No YouTube tabs');
        return;
      }
      
      // Check each tab
      let shortsTabsFound = 0;
      
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { action: 'testShortsDetection' }, function(response) {
          if (chrome.runtime.lastError) {
            appendLog(`Error in tab ${tab.id}: ${chrome.runtime.lastError.message}`, 'error');
            return;
          }
          
          if (response) {
            shortsTabsFound++;
            
            testOutput.innerHTML += `Tab ${tab.id} (${tab.url}):\n`;
            testOutput.innerHTML += `- Is shorts page: ${response.isShortsPage}\n`;
            
            if (response.isShortsPage) {
              testOutput.innerHTML += `- Shorts ID: ${response.shortsId || 'Not detected'}\n`;
              testOutput.innerHTML += `- Creator: ${response.creator || 'Not detected'}\n`;
              testOutput.innerHTML += `- All creators found: ${JSON.stringify(response.allCreators || [])}\n\n`;
            } else {
              testOutput.innerHTML += `- Not a shorts page\n\n`;
            }
            
            appendLog(`Tested shorts detection on tab ${tab.id}`, 'success');
          }
        });
      }
      
      setTimeout(() => {
        if (shortsTabsFound > 0) {
          updateTestResult(testShortsResult, 'success', 'Detection tested');
        } else {
          updateTestResult(testShortsResult, 'error', 'No response from tabs');
          appendLog("No response from any YouTube tabs", 'error');
        }
      }, 1000);
    });
  }
  
  // Test navigation detection
  function testNavigationDetection() {
    appendLog("Testing navigation detection...");
    testOutput.innerHTML = "";
    
    // Set up navigation monitoring on YouTube tabs
    chrome.tabs.query({ url: "*://*.youtube.com/*" }, function(tabs) {
      if (tabs.length === 0) {
        appendLog("No YouTube tabs found. Please open YouTube to test.", 'warning');
        updateTestResult(testNavigationResult, 'warning', 'No YouTube tabs');
        return;
      }
      
      let navTabsFound = 0;
      
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { action: 'testNavigationDetection' }, function(response) {
          if (chrome.runtime.lastError) {
            appendLog(`Error in tab ${tab.id}: ${chrome.runtime.lastError.message}`, 'error');
            return;
          }
          
          if (response) {
            navTabsFound++;
            
            testOutput.innerHTML += `Tab ${tab.id} (${tab.url}):\n`;
            testOutput.innerHTML += `- Current URL: ${response.currentUrl}\n`;
            testOutput.innerHTML += `- Monitoring: ${response.isMonitoring}\n`;
            testOutput.innerHTML += `- Test nav initialized: ${response.testInitialized}\n\n`;
            
            appendLog(`Navigation monitoring set up on tab ${tab.id}`, 'success');
            
            // Tell user what to do next
            testOutput.innerHTML += `INSTRUCTIONS: Now navigate to different YouTube videos or shorts in this tab.\n`;
            testOutput.innerHTML += `You should see detection messages appear below as you navigate.\n\n`;
            
            // Now navigation events should be logged to test output as they happen
          }
        });
      }
      
      setTimeout(() => {
        if (navTabsFound > 0) {
          updateTestResult(testNavigationResult, 'success', 'Monitoring active');
        } else {
          updateTestResult(testNavigationResult, 'error', 'No response from tabs');
          appendLog("No response from any YouTube tabs", 'error');
        }
      }, 1000);
    });
  }
  
  // Fix dashboard access
  function fixDashboardAccess() {
    appendLog("Attempting to fix dashboard access...");
    
    chrome.runtime.sendMessage({ action: 'fixDashboardAccess' }, function(response) {
      if (chrome.runtime.lastError) {
        appendLog("Error fixing dashboard: " + chrome.runtime.lastError.message, 'error');
        updateTestResult(dashboardFixResult, 'error', 'Fix failed');
        return;
      }
      
      if (response && response.status === 'success') {
        appendLog("Dashboard access fix applied: " + response.message, 'success');
        updateTestResult(dashboardFixResult, 'success', 'Fixed');
      } else {
        appendLog("Dashboard fix returned unknown response", 'warning');
        updateTestResult(dashboardFixResult, 'warning', 'Unknown result');
      }
    });
  }
  
  // Update test result
  function updateTestResult(element, type, message) {
    const statusSpan = element.querySelector('span');
    statusSpan.className = type;
    statusSpan.textContent = message;
  }
  
  // Listen for messages from extension
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === 'debugLog') {
      appendLog(message.message, message.type || 'info');
      sendResponse({ received: true });
      return true;
    }
    
    if (message.action === 'navDetectionResult') {
      if (testOutput) {
        testOutput.innerHTML += `NAVIGATION DETECTED: ${message.url}\n`;
        testOutput.innerHTML += `- Type: ${message.pageType}\n`;
        if (message.videoId) testOutput.innerHTML += `- Video ID: ${message.videoId}\n`;
        if (message.title) testOutput.innerHTML += `- Title: ${message.title}\n`;
        if (message.channel) testOutput.innerHTML += `- Channel: ${message.channel}\n`;
        if (message.shortsId) testOutput.innerHTML += `- Shorts ID: ${message.shortsId}\n`;
        if (message.creator) testOutput.innerHTML += `- Creator: ${message.creator}\n`;
        testOutput.innerHTML += `\n`;
        
        testOutput.scrollTop = testOutput.scrollHeight;
      }
      
      sendResponse({ received: true });
      return true;
    }
  });
});