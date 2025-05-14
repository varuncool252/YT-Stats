document.addEventListener('DOMContentLoaded', function() {
  // Main popup elements
  const exportBtn = document.getElementById('exportBtn');
  const clearBtn = document.getElementById('clearBtn');
  const toggleDashboardBtn = document.getElementById('toggleDashboardBtn');
  const debugLink = document.getElementById('debugLink');
  const timePeriod = document.getElementById('timePeriod');
  const normalCount = document.getElementById('normalCount');
  const shortsCount = document.getElementById('shortsCount');
  const totalCount = document.getElementById('totalCount');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  
  // Dashboard elements
  const backToPopupBtn = document.getElementById('backToPopupBtn');
  const dashExportBtn = document.getElementById('dashExportBtn');
  const dashTimeRange = document.getElementById('dashTimeRange');
  const dashTotalVideos = document.getElementById('dashTotalVideos');
  const dashNormalVideos = document.getElementById('dashNormalVideos');
  const dashShortsVideos = document.getElementById('dashShortsVideos');
  const dashUniqueChannels = document.getElementById('dashUniqueChannels');
  
  // Main containers
  const mainPopup = document.getElementById('main-popup');
  const dashboard = document.getElementById('dashboard');
  
  // Load and display stats
  updateStats();
  
  // Check tracker status
  checkTrackerStatus();
  
  // Toggle dashboard view
  toggleDashboardBtn.addEventListener('click', function() {
    mainPopup.style.display = 'none';
    dashboard.style.display = 'block';
    updateDashboardStats();
  });
  
  // Back to main popup
  backToPopupBtn.addEventListener('click', function() {
    dashboard.style.display = 'none';
    mainPopup.style.display = 'block';
  });
  
  // Export data as JSON from main popup
  exportBtn.addEventListener('click', function() {
    exportData(timePeriod.value);
  });
  
  // Export data from dashboard
  dashExportBtn.addEventListener('click', function() {
    exportData(dashTimeRange.value);
  });
  
  // Dashboard time range change
  dashTimeRange.addEventListener('change', function() {
    updateDashboardStats();
  });
  
  // Export data as JSON
  function exportData(selectedPeriod) {
    chrome.storage.local.get('videoHistory', function(data) {
      if (!data.videoHistory || !data.videoHistory.length) {
        alert('No watch history to export.');
        return;
      }
      
      let historyToExport = data.videoHistory;
      
      // Filter based on selected time period
      if (selectedPeriod !== 'all') {
        const now = new Date();
        let cutoffDate;
        
        if (selectedPeriod === 'day') {
          cutoffDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        } else if (selectedPeriod === 'week') {
          cutoffDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        } else if (selectedPeriod === 'month') {
          cutoffDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        } else {
          // Numeric period (for dashboard)
          cutoffDate = new Date(now.getTime() - (parseInt(selectedPeriod) * 24 * 60 * 60 * 1000));
        }
        
        historyToExport = historyToExport.filter(video => {
          const watchDate = new Date(video.watchedAt);
          return watchDate >= cutoffDate;
        });
      }
      
      if (historyToExport.length === 0) {
        alert('No videos in the selected time period.');
        return;
      }
      
      // Create and download JSON file
      const jsonString = JSON.stringify(historyToExport, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'youtube_history_' + new Date().toISOString().split('T')[0] + '.json';
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    });
  }
  
  // Clear history
  clearBtn.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear your watch history? This cannot be undone.')) {
      chrome.storage.local.set({ videoHistory: [] }, function() {
        updateStats();
        updateDashboardStats();
        alert('Watch history cleared.');
      });
    }
  });
  
  // Open debug console
  debugLink.addEventListener('click', function(e) {
    e.preventDefault();
    chrome.tabs.create({
      url: chrome.runtime.getURL('debug.html')
    });
  });
  
  // Check if the tracker is active on any YouTube tabs
  function checkTrackerStatus() {
    chrome.tabs.query({ url: "*://*.youtube.com/*" }, function(tabs) {
      if (tabs.length === 0) {
        // No YouTube tabs open
        setTrackerStatus(false, 'No YouTube tabs open');
        return;
      }
      
      // Try to ping any of the tabs
      let pingAttempts = 0;
      let pingSucceeded = false;
      
      for (const tab of tabs) {
        pingAttempts++;
        chrome.tabs.sendMessage(tab.id, { action: 'pingContent' }, function(response) {
          if (chrome.runtime.lastError) {
            // Ignore errors - might happen if content script isn't loaded yet
            return;
          }
          
          if (response && response.status === 'ok') {
            pingSucceeded = true;
            setTrackerStatus(true, 'Tracker active');
          }
          
          // Last attempt and still no success?
          if (pingAttempts === tabs.length && !pingSucceeded) {
            setTrackerStatus(false, 'Tracker inactive on YouTube tabs');
          }
        });
      }
    });
  }
  
  // Set the tracker status indicator
  function setTrackerStatus(isActive, message) {
    if (isActive) {
      statusDot.className = 'status-dot status-active';
    } else {
      statusDot.className = 'status-dot status-inactive';
    }
    
    statusText.textContent = message;
  }
  
  // Update statistics display for main popup
  function updateStats() {
    chrome.storage.local.get('videoHistory', function(data) {
      const history = data.videoHistory || [];
      
      const normalVideos = history.filter(video => video.type === 'normal');
      const shortsVideos = history.filter(video => video.type === 'short');
      
      normalCount.textContent = normalVideos.length;
      shortsCount.textContent = shortsVideos.length;
      totalCount.textContent = history.length;
    });
  }
  
  // Update dashboard statistics
  function updateDashboardStats() {
    chrome.storage.local.get('videoHistory', function(data) {
      const history = data.videoHistory || [];
      let filteredHistory = history;
      
      // Filter based on dashboard time range
      const selectedRange = dashTimeRange.value;
      if (selectedRange !== 'all') {
        const now = new Date();
        const cutoffDate = new Date(now.getTime() - (parseInt(selectedRange) * 24 * 60 * 60 * 1000));
        
        filteredHistory = history.filter(video => {
          const watchDate = new Date(video.watchedAt);
          return watchDate >= cutoffDate;
        });
      }
      
      // Count videos by type
      const normalVideos = filteredHistory.filter(video => video.type === 'normal');
      const shortsVideos = filteredHistory.filter(video => video.type === 'short');
      
      // Get unique channels (only normal videos have channel info)
      const channelSet = new Set();
      normalVideos.forEach(video => {
        if (video.channel) {
          channelSet.add(video.channel);
        }
      });
      
      // Calculate total watch time (estimated)
      let totalWatchTimeMinutes = 0;
      
      // Estimate normal video watch time (assuming average 8 minutes per normal video)
      // Multiply by views count to account for rewatches
      normalVideos.forEach(video => {
        const viewCount = video.viewsCount || 1;
        totalWatchTimeMinutes += viewCount * 8;
      });
      
      // Estimate shorts watch time (average 30 seconds per short)
      totalWatchTimeMinutes += shortsVideos.length * 0.5;
      
      // Format watch time (convert to hours if > 60 minutes)
      let watchTimeDisplay;
      if (totalWatchTimeMinutes >= 60) {
        const hours = Math.floor(totalWatchTimeMinutes / 60);
        const minutes = Math.round(totalWatchTimeMinutes % 60);
        watchTimeDisplay = `${hours} hr ${minutes} min`;
      } else {
        watchTimeDisplay = `${Math.round(totalWatchTimeMinutes)} min`;
      }
      
      // Update dashboard stats
      dashTotalVideos.textContent = filteredHistory.length;
      dashNormalVideos.textContent = normalVideos.length;
      dashShortsVideos.textContent = shortsVideos.length;
      dashUniqueChannels.textContent = channelSet.size;
      dashWatchTime.textContent = watchTimeDisplay;
    });
  }
  
  // Update stats periodically
  setInterval(updateStats, 5000);
  setInterval(checkTrackerStatus, 10000);
});