// Initialize dashboard
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
  
  // Tables
  const topVideosTable = document.getElementById('topVideosTable').querySelector('tbody');
  const recentActivityTable = document.getElementById('recentActivityTable').querySelector('tbody');
  
  // Chart contexts
  const activityChartCtx = document.getElementById('activityChart').getContext('2d');
  const typeDistributionChartCtx = document.getElementById('typeDistributionChart').getContext('2d');
  const topChannelsChartCtx = document.getElementById('topChannelsChart').getContext('2d');
  const watchingTimeChartCtx = document.getElementById('watchingTimeChart').getContext('2d');
  
  // Chart instances
  let activityChart, typeDistributionChart, topChannelsChart, watchingTimeChart;
  
  // Load and display data
  loadAndDisplayData();
  
  // Event listeners
  timeRangeSelect.addEventListener('change', loadAndDisplayData);
  backBtn.addEventListener('click', function() {
    window.close();
  });
  exportBtn.addEventListener('click', exportFullData);
  
  // Main function to load and display all data
  function loadAndDisplayData() {
    // Get the selected time range
    const selectedRange = timeRangeSelect.value;
    
    chrome.storage.local.get('videoHistory', function(data) {
      const history = data.videoHistory || [];
      
      // Filter history based on selected time range
      const filteredHistory = filterHistoryByTimeRange(history, selectedRange);
      
      // Update summary statistics
      updateSummaryStats(filteredHistory);
      
      // Update charts
      updateCharts(filteredHistory);
      
      // Update tables
      updateTables(filteredHistory);
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
    
    // Get unique channels
    const allChannels = history.map(video => {
      return video.type === 'normal' ? video.channel : video.creatorName;
    });
    const uniqueChannels = [...new Set(allChannels)];
    
    // Update DOM
    totalVideosElement.textContent = history.length;
    normalVideosElement.textContent = normalVideos.length;
    shortsVideosElement.textContent = shortsVideos.length;
    uniqueChannelsElement.textContent = uniqueChannels.length;
  }
  
  // Update all charts
  function updateCharts(history) {
    updateActivityChart(history);
    updateTypeDistributionChart(history);
    updateTopChannelsChart(history);
    updateWatchingTimeChart(history);
  }
  
  // Update activity chart (videos per day)
  function updateActivityChart(history) {
    // Group videos by date
    const dateMap = {};
    
    history.forEach(video => {
      const date = new Date(video.watchedAt).toLocaleDateString();
      if (!dateMap[date]) {
        dateMap[date] = 0;
      }
      dateMap[date]++;
    });
    
    // Sort dates
    const sortedDates = Object.keys(dateMap).sort((a, b) => {
      return new Date(a) - new Date(b);
    });
    
    // Create chart data
    const chartData = {
      labels: sortedDates,
      datasets: [{
        label: 'Videos Watched',
        data: sortedDates.map(date => dateMap[date]),
        backgroundColor: 'rgba(204, 0, 0, 0.2)',
        borderColor: 'rgba(204, 0, 0, 1)',
        borderWidth: 1,
        tension: 0.4
      }]
    };
    
    // Create or update chart
    if (activityChart) {
      activityChart.data = chartData;
      activityChart.update();
    } else {
      activityChart = new Chart(activityChartCtx, {
        type: 'line',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Number of Videos'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Date'
              }
            }
          }
        }
      });
    }
  }
  
  // Update type distribution chart (normal vs shorts)
  function updateTypeDistributionChart(history) {
    const normalCount = history.filter(video => video.type === 'normal').length;
    const shortsCount = history.filter(video => video.type === 'short').length;
    
    const chartData = {
      labels: ['Normal Videos', 'Shorts'],
      datasets: [{
        data: [normalCount, shortsCount],
        backgroundColor: ['rgba(54, 162, 235, 0.7)', 'rgba(255, 99, 132, 0.7)'],
        borderColor: ['rgba(54, 162, 235, 1)', 'rgba(255, 99, 132, 1)'],
        borderWidth: 1
      }]
    };
    
    if (typeDistributionChart) {
      typeDistributionChart.data = chartData;
      typeDistributionChart.update();
    } else {
      typeDistributionChart = new Chart(typeDistributionChartCtx, {
        type: 'doughnut',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right'
            }
          }
        }
      });
    }
  }
  
  // Update top channels chart
  function updateTopChannelsChart(history) {
    // Count videos by channel
    const channelMap = {};
    
    history.forEach(video => {
      const channelName = video.type === 'normal' ? video.channel : video.creatorName;
      if (!channelMap[channelName]) {
        channelMap[channelName] = 0;
      }
      channelMap[channelName]++;
    });
    
    // Sort channels by count and get top 10
    const topChannels = Object.keys(channelMap)
      .map(channel => ({ name: channel, count: channelMap[channel] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    const chartData = {
      labels: topChannels.map(channel => channel.name),
      datasets: [{
        label: 'Videos Watched',
        data: topChannels.map(channel => channel.count),
        backgroundColor: 'rgba(75, 192, 192, 0.7)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }]
    };
    
    if (topChannelsChart) {
      topChannelsChart.data = chartData;
      topChannelsChart.update();
    } else {
      topChannelsChart = new Chart(topChannelsChartCtx, {
        type: 'bar',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Number of Videos'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Channel'
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    }
  }
  
  // Update watching time chart (by hour of day)
  function updateWatchingTimeChart(history) {
    // Initialize hours array (0-23)
    const hours = Array(24).fill(0);
    
    // Count videos by hour
    history.forEach(video => {
      const hour = new Date(video.watchedAt).getHours();
      hours[hour]++;
    });
    
    // Labels for hours (12AM, 1AM, etc.)
    const hourLabels = hours.map((_, index) => {
      if (index === 0) return '12AM';
      if (index < 12) return `${index}AM`;
      if (index === 12) return '12PM';
      return `${index - 12}PM`;
    });
    
    const chartData = {
      labels: hourLabels,
      datasets: [{
        label: 'Videos Watched',
        data: hours,
        backgroundColor: 'rgba(153, 102, 255, 0.7)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1
      }]
    };
    
    if (watchingTimeChart) {
      watchingTimeChart.data = chartData;
      watchingTimeChart.update();
    } else {
      watchingTimeChart = new Chart(watchingTimeChartCtx, {
        type: 'bar',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Number of Videos'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Hour of Day'
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    }
  }
  
  // Update tables
  function updateTables(history) {
    updateTopVideosTable(history);
    updateRecentActivityTable(history);
  }
  
  // Update top videos table
  function updateTopVideosTable(history) {
    // Only include normal videos (with views)
    const normalVideos = history.filter(video => video.type === 'normal');
    
    // Group videos by ID and count total views
    const videoMap = {};
    normalVideos.forEach(video => {
      if (!videoMap[video.videoId]) {
        videoMap[video.videoId] = {
          title: video.title,
          channel: video.channel,
          views: video.views || 1,
          lastWatched: new Date(video.watchedAt)
        };
      } else {
        // Update views
        videoMap[video.videoId].views = video.views || videoMap[video.videoId].views + 1;
        
        // Update last watched date if newer
        const lastWatched = new Date(video.watchedAt);
        if (lastWatched > videoMap[video.videoId].lastWatched) {
          videoMap[video.videoId].lastWatched = lastWatched;
        }
      }
    });
    
    // Sort videos by views (descending)
    const sortedVideos = Object.keys(videoMap)
      .map(videoId => ({ videoId, ...videoMap[videoId] }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 15); // Top 15 videos
    
    // Clear existing table rows
    topVideosTable.innerHTML = '';
    
    // Add sorted videos to table
    sortedVideos.forEach(video => {
      const row = document.createElement('tr');
      
      // Format the date
      const formattedDate = video.lastWatched.toLocaleDateString() + ' ' + 
                           video.lastWatched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      row.innerHTML = `
        <td>${video.title}</td>
        <td>${video.channel}</td>
        <td>${video.views}</td>
        <td>${formattedDate}</td>
      `;
      
      topVideosTable.appendChild(row);
    });
    
    // If no videos found
    if (sortedVideos.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="4" class="no-data">No videos found in the selected time range</td>';
      topVideosTable.appendChild(row);
    }
  }
  
  // Update recent activity table
  function updateRecentActivityTable(history) {
    // Sort videos by date (most recent first)
    const sortedVideos = [...history].sort((a, b) => {
      return new Date(b.watchedAt) - new Date(a.watchedAt);
    }).slice(0, 20); // Most recent 20 videos
    
    // Clear existing table rows
    recentActivityTable.innerHTML = '';
    
    // Add sorted videos to table
    sortedVideos.forEach(video => {
      const row = document.createElement('tr');
      
      // Format the date
      const watchDate = new Date(video.watchedAt);
      const formattedDate = watchDate.toLocaleDateString() + ' ' + 
                           watchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Format title/creator based on video type
      const titleOrCreator = video.type === 'normal' ? video.title : video.creatorName;
      
      row.innerHTML = `
        <td>${titleOrCreator}</td>
        <td>${video.type === 'normal' ? 'Video' : 'Short'}</td>
        <td>${formattedDate}</td>
      `;
      
      recentActivityTable.appendChild(row);
    });
    
    // If no videos found
    if (sortedVideos.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="3" class="no-data">No recent activity in the selected time range</td>';
      recentActivityTable.appendChild(row);
    }
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