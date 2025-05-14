// Simple dashboard.js for use with Chrome extension CSP
document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const timeRangeSelect = document.getElementById('timeRange');
  const backBtn = document.getElementById('backBtn');
  const exportBtn = document.getElementById('exportBtn');
  
  // Stats elements
  const totalVideosElement = document.getElementById('totalVideos');
  const normalVideosElement = document.getElementById('normalVideos');
  const shortsVideosElement = document.getElementById('shortsVideos');
  const uniqueChannelsElement = document.getElementById('uniqueChannels');
  
  // Load and display data
  loadAndDisplayData();
  
  // Event listeners
  timeRangeSelect.addEventListener('change', loadAndDisplayData);
  backBtn.addEventListener('click', function() {
    window.close();
  });
  exportBtn.addEventListener('click', exportFullData);
  
  // Function to load and display data
  function loadAndDisplayData() {
    chrome.storage.local.get('videoHistory', function(data) {
      const history = data.videoHistory || [];
      
      // Filter history based on selected time range
      const filteredHistory = filterHistoryByTimeRange(history, timeRangeSelect.value);
      
      // Update summary stats
      updateSummaryStats(filteredHistory);
    });
  }
  
  // Filter history by time range
  function filterHistoryByTimeRange(history, range) {
    if (range === 'all') {
      return history;
    }
    
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (parseInt(range) * 24 * 60 * 60 * 1000));
    
    return history.filter(video => {
      const watchDate = new Date(video.watchedAt);
      return watchDate >= cutoffDate;
    });
  }
  
  // Update summary statistics
  function updateSummaryStats(history) {
    const normalVideos = history.filter(video => video.type === 'normal');
    const shortsVideos = history.filter(video => video.type === 'short');
    
    // Get unique channels (only normal videos have channel info)
    const channelSet = new Set();
    normalVideos.forEach(video => {
      if (video.channel) {
        channelSet.add(video.channel);
      }
    });
    
    totalVideosElement.textContent = history.length;
    normalVideosElement.textContent = normalVideos.length;
    shortsVideosElement.textContent = shortsVideos.length;
    uniqueChannelsElement.textContent = channelSet.size;
  }
  
  // Export full data function
  function exportFullData() {
    chrome.storage.local.get('videoHistory', function(data) {
      if (!data.videoHistory || !data.videoHistory.length) {
        alert('No watch history to export.');
        return;
      }
      
      // Get the selected time range
      const selectedRange = timeRangeSelect.value;
      
      // Filter history based on selected time range
      const historyToExport = filterHistoryByTimeRange(data.videoHistory, selectedRange);
      
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
});