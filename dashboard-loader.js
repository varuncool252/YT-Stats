// Dashboard loader script
document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const timeRangeSelect = document.getElementById('timeRange');
  const backBtn = document.getElementById('backBtn');
  const exportBtn = document.getElementById('exportBtn');
  const statusMessage = document.getElementById('statusMessage');
  
  // Stats elements
  const totalVideosElement = document.getElementById('totalVideos');
  const normalVideosElement = document.getElementById('normalVideos');
  const shortsVideosElement = document.getElementById('shortsVideos');
  const uniqueChannelsElement = document.getElementById('uniqueChannels');
  
  // Show status message
  statusMessage.textContent = "Loading watch history data...";
  
  // Load and display data
  chrome.storage.local.get('videoHistory', function(data) {
    const history = data.videoHistory || [];
    
    if (history.length === 0) {
      statusMessage.textContent = "No watch history found. Start watching YouTube videos to collect data.";
    } else {
      statusMessage.textContent = `Loaded ${history.length} videos from your watch history.`;
      
      // Count normal videos and shorts
      const normalVideos = history.filter(video => video.type === 'normal');
      const shortsVideos = history.filter(video => video.type === 'short');
      
      // Get unique channels (only normal videos have channel info)
      const channelSet = new Set();
      normalVideos.forEach(video => {
        if (video.channel) {
          channelSet.add(video.channel);
        }
      });
      
      // Update stats display
      totalVideosElement.textContent = history.length;
      normalVideosElement.textContent = normalVideos.length;
      shortsVideosElement.textContent = shortsVideos.length;
      uniqueChannelsElement.textContent = channelSet.size;
    }
  });
  
  // Event listeners
  backBtn.addEventListener('click', function() {
    window.close();
  });
  
  exportBtn.addEventListener('click', function() {
    chrome.storage.local.get('videoHistory', function(data) {
      if (!data.videoHistory || !data.videoHistory.length) {
        alert('No watch history to export.');
        return;
      }
      
      // Create and download JSON file
      const jsonString = JSON.stringify(data.videoHistory, null, 2);
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
  });
  
  timeRangeSelect.addEventListener('change', function() {
    statusMessage.textContent = "Filtering data...";
    
    chrome.storage.local.get('videoHistory', function(data) {
      const history = data.videoHistory || [];
      const selectedRange = timeRangeSelect.value;
      
      let filteredHistory;
      if (selectedRange === 'all') {
        filteredHistory = history;
      } else {
        const now = new Date();
        const cutoffDate = new Date(now.getTime() - (parseInt(selectedRange) * 24 * 60 * 60 * 1000));
        
        filteredHistory = history.filter(video => {
          const watchDate = new Date(video.watchedAt);
          return watchDate >= cutoffDate;
        });
      }
      
      // Count normal videos and shorts
      const normalVideos = filteredHistory.filter(video => video.type === 'normal');
      const shortsVideos = filteredHistory.filter(video => video.type === 'short');
      
      // Get unique channels (only normal videos have channel info)
      const channelSet = new Set();
      normalVideos.forEach(video => {
        if (video.channel) {
          channelSet.add(video.channel);
        }
      });
      
      // Update stats display
      totalVideosElement.textContent = filteredHistory.length;
      normalVideosElement.textContent = normalVideos.length;
      shortsVideosElement.textContent = shortsVideos.length;
      uniqueChannelsElement.textContent = channelSet.size;
      
      statusMessage.textContent = `Showing ${filteredHistory.length} videos from your watch history.`;
    });
  });
});