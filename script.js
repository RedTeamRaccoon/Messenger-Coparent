document.getElementById('fileInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = JSON.parse(e.target.result);
        populateParticipants(data);
    };
    reader.readAsText(file);
});

function populateParticipants(data) {
    const participantsRolesDiv = document.getElementById('participantsRoles');
    participantsRolesDiv.innerHTML = '';

    data.participants.forEach(participant => {
        const roleDiv = document.createElement('div');
        roleDiv.className = 'participant-role';

        const label = document.createElement('label');
        label.textContent = `Select role for ${participant.name}:`;

        const select = document.createElement('select');
        select.innerHTML = `
            <option value="child">Child</option>
            <option value="adult">Adult</option>
        `;
        select.setAttribute('data-participant', participant.name);

        roleDiv.appendChild(label);
        roleDiv.appendChild(select);
        participantsRolesDiv.appendChild(roleDiv);
    });
}

document.getElementById('processButton').addEventListener('click', function() {
    const timezone = document.getElementById('timezoneSelect').value;
    const startDate = new Date(document.getElementById('startDate').value);
    const endDate = new Date(document.getElementById('endDate').value);
    
    const callsPerWeek = parseInt(document.getElementById('callsPerWeek').value);
    const durationPerCall = parseInt(document.getElementById('durationPerCall').value) * 60; // Convert minutes to seconds

    const participantsRoles = {};
    document.querySelectorAll('#participantsRoles select').forEach(select => {
        participantsRoles[select.getAttribute('data-participant')] = select.value;
    });

    showLoadingIndicator(); // Show loading indicator before processing

    setTimeout(() => { // Simulate a delay for the loading indicator to be visible
        processData(participantsRoles, timezone, startDate, endDate, callsPerWeek, durationPerCall);
    }, 100); // Small timeout to ensure loading indicator is visible
});

function processData(participantsRoles, timezone, startDate, endDate, callsPerWeek, durationPerCall) {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files[0]) {
        alert('Please upload a JSON file.');
        hideLoadingIndicator(); // Hide loading indicator on error
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            const callRecords = data.messages.filter(message => message.call_duration && 
                new Date(message.timestamp_ms) >= startDate &&
                new Date(message.timestamp_ms) <= endDate
            );

            analyzeCalls(callRecords, participantsRoles, timezone, callsPerWeek, durationPerCall);
        } catch (error) {
            console.error("Error processing the data: ", error);
            alert("An error occurred while processing the data. Please try again.");
        } finally {
            hideLoadingIndicator(); // Hide loading indicator after processing
        }
    };
    reader.readAsText(fileInput.files[0]);
}

function analyzeCalls(callRecords, participantsRoles, timezone, callsPerWeek, durationPerCall) {
    // Store all call data for CSV export
    const allCallData = [];
    
    // Identify child and adult participants
    const childParticipants = Object.keys(participantsRoles).filter(name => participantsRoles[name] === 'child');
    const adultParticipants = Object.keys(participantsRoles).filter(name => participantsRoles[name] === 'adult');
    
    const dailyData = {};
    const summaryData = {
        totalCalls: 0,
        totalDuration: 0,
        daysBelowMin: 0,
        daysAboveMin: 0,
        missedWeeks: 0,
        compliantWeeks: 0
    };

        // Process each call record
    callRecords.forEach(call => {
        // The timestamp_ms in the JSON represents when the call ended
        const endTime = new Date(call.timestamp_ms);
        
        // Calculate the start time by subtracting the call duration from the end time
        const startTime = new Date(call.timestamp_ms - (call.call_duration * 1000));
        
        const dateString = startTime.toLocaleDateString('en-US', { timeZone: timezone });
        const startTimeString = startTime.toLocaleTimeString('en-US', { timeZone: timezone });
        const endTimeString = endTime.toLocaleTimeString('en-US', { timeZone: timezone });
        
        // Determine who initiated the call
        const initiator = call.sender_name;
        const initiatorRole = participantsRoles[initiator] || 'unknown';
        
        // Calculate call duration properly
        const durationInSeconds = call.call_duration;
        
        // Store call data for CSV export
        allCallData.push({
            date: dateString,
            startTime: startTimeString,
            endTime: endTimeString,
            initiator: initiator,
            initiatorRole: initiatorRole,
            durationSeconds: durationInSeconds,
            durationFormatted: formatDuration(durationInSeconds)
        });

        // Aggregate daily data
        if (!dailyData[dateString]) {
            dailyData[dateString] = { 
                totalDuration: 0, 
                calls: 0,
                callDetails: []
            };
        }

        dailyData[dateString].totalDuration += durationInSeconds;
        dailyData[dateString].calls += 1;
        dailyData[dateString].callDetails.push({
            startTime: startTimeString,
            endTime: endTimeString,
            initiator: initiator,
            duration: durationInSeconds
        });
    });

    // Organize data by week
    const weeklyData = {};
    const monthlyData = {};

    Object.keys(dailyData).forEach(day => {
        const date = new Date(day);
        const week = getWeekNumber(date);
        const yearWeek = `${date.getFullYear()}-W${week.toString().padStart(2, '0')}`;
        const month = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

        // Weekly data
        if (!weeklyData[yearWeek]) {
            weeklyData[yearWeek] = { 
                year: date.getFullYear(),
                week: week,
                totalCalls: 0, 
                totalDuration: 0, 
                days: {}, 
                daysAboveMin: 0, 
                daysBelowMin: 0,
                isCompliant: false
            };
        }

        weeklyData[yearWeek].totalCalls += dailyData[day].calls;
        weeklyData[yearWeek].totalDuration += dailyData[day].totalDuration;
        weeklyData[yearWeek].days[day] = {
            totalDuration: dailyData[day].totalDuration,
            calls: dailyData[day].calls,
            details: dailyData[day].callDetails
        };

        if (dailyData[day].totalDuration >= durationPerCall) {
            weeklyData[yearWeek].daysAboveMin++;
        } else {
            weeklyData[yearWeek].daysBelowMin++;
        }
        
        // Monthly data
        if (!monthlyData[month]) {
            monthlyData[month] = {
                year: date.getFullYear(),
                month: date.getMonth() + 1,
                totalCalls: 0,
                totalDuration: 0,
                compliantDays: 0,
                nonCompliantDays: 0
            };
        }
        
        monthlyData[month].totalCalls += dailyData[day].calls;
        monthlyData[month].totalDuration += dailyData[day].totalDuration;
        
        if (dailyData[day].totalDuration >= durationPerCall) {
            monthlyData[month].compliantDays++;
        } else {
            monthlyData[month].nonCompliantDays++;
        }
    });

    // Analyze weekly compliance
    Object.keys(weeklyData).forEach(yearWeek => {
        const week = weeklyData[yearWeek];
        
        // Check if week meets requirements
        week.isCompliant = (week.daysAboveMin >= callsPerWeek);
        
        if (week.isCompliant) {
            summaryData.compliantWeeks++;
        } else {
            summaryData.missedWeeks++;
        }

        summaryData.totalCalls += week.totalCalls;
        summaryData.totalDuration += week.totalDuration;
        summaryData.daysBelowMin += week.daysBelowMin;
        summaryData.daysAboveMin += week.daysAboveMin;
    });

    const totalWeeks = Object.keys(weeklyData).length;
    const averageCallsPerWeek = totalWeeks > 0 ? summaryData.totalCalls / totalWeeks : 0;
    const averageDurationPerCall = summaryData.totalCalls > 0 ? summaryData.totalDuration / summaryData.totalCalls : 0;
    const complianceRate = totalWeeks > 0 ? (summaryData.compliantWeeks / totalWeeks) * 100 : 0;

    // Store data for export
    window.exportData = {
        allCalls: allCallData,
        daily: dailyData,
        weekly: weeklyData,
        monthly: monthlyData,
        summary: {
            ...summaryData,
            totalWeeks,
            averageCallsPerWeek,
            averageDurationPerCall,
            complianceRate
        }
    };

    displaySummary(
        averageCallsPerWeek, 
        averageDurationPerCall, 
        summaryData.daysBelowMin, 
        summaryData.daysAboveMin,
        summaryData.compliantWeeks,
        summaryData.missedWeeks,
        complianceRate
    );
    
    displayDetails(weeklyData, monthlyData, timezone);
    
    // Show export button now that we have data
    document.getElementById('exportContainer').style.display = 'block';
}

function getWeekNumber(d) {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 4 - (date.getDay() || 7));
    const yearStart = new Date(date.getFullYear(), 0, 1);
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function displaySummary(averageCallsPerWeek, averageDurationPerCall, daysBelowMin, daysAboveMin, compliantWeeks, missedWeeks, complianceRate) {
    const summaryDiv = document.getElementById('summary');
    summaryDiv.innerHTML = `
        <h2>Summary</h2>
        <div class="summary-grid">
            <div class="summary-card">
                <h3>Call Frequency</h3>
                <p>Average Calls Per Week: <span class="highlight">${averageCallsPerWeek.toFixed(2)}</span></p>
                <p>Total Compliant Weeks: <span class="highlight">${compliantWeeks}</span></p>
                <p>Total Non-Compliant Weeks: <span class="highlight">${missedWeeks}</span></p>
                <p>Compliance Rate: <span class="highlight">${complianceRate.toFixed(2)}%</span></p>
            </div>
            <div class="summary-card">
                <h3>Call Duration</h3>
                <p>Average Duration Per Call: <span class="highlight">${formatDuration(averageDurationPerCall)}</span></p>
                <p>Days Below Minimum Duration: <span class="highlight">${daysBelowMin}</span></p>
                <p>Days Above Minimum Duration: <span class="highlight">${daysAboveMin}</span></p>
            </div>
        </div>
        <div id="chartContainer">
            <canvas id="complianceChart"></canvas>
            <canvas id="durationChart"></canvas>
        </div>
    `;
    
    // Create charts if Chart.js is loaded
    if (typeof Chart !== 'undefined') {
        createComplianceChart(compliantWeeks, missedWeeks);
        createDurationChart(daysBelowMin, daysAboveMin);
    }
}

function displayDetails(weeklyData, monthlyData, timezone) {
    const detailsDiv = document.getElementById('details');
    detailsDiv.innerHTML = '';
    
    // Create tabs
    const tabsDiv = document.createElement('div');
    tabsDiv.className = 'tabs';
    
    const weeklyTab = document.createElement('button');
    weeklyTab.className = 'tab-button active';
    weeklyTab.textContent = 'Weekly View';
    weeklyTab.onclick = () => switchTab('weekly');
    
    const monthlyTab = document.createElement('button');
    monthlyTab.className = 'tab-button';
    monthlyTab.textContent = 'Monthly View';
    monthlyTab.onclick = () => switchTab('monthly');
    
    tabsDiv.appendChild(weeklyTab);
    tabsDiv.appendChild(monthlyTab);
    detailsDiv.appendChild(tabsDiv);
    
    // Create content containers
    const weeklyContent = document.createElement('div');
    weeklyContent.id = 'weeklyContent';
    weeklyContent.className = 'tab-content';
    
    const monthlyContent = document.createElement('div');
    monthlyContent.id = 'monthlyContent';
    monthlyContent.className = 'tab-content';
    monthlyContent.style.display = 'none';
    
    // Populate weekly content
    weeklyContent.innerHTML = '<h2>Weekly Details</h2>';
    
    // Sort weeks chronologically
    const sortedWeeks = Object.keys(weeklyData).sort();
    
    sortedWeeks.forEach(yearWeek => {
        const week = weeklyData[yearWeek];
        const button = document.createElement('button');
        button.className = 'collapsible';
        
        // Add compliance indicator
        const complianceClass = week.isCompliant ? 'compliant' : 'non-compliant';
        
        button.innerHTML = `
            <span class="week-label">Week ${week.week}, ${week.year}</span>
            <span class="week-summary">
                <span class="calls-count">${week.totalCalls} calls</span>
                <span class="duration-total">${formatDuration(week.totalDuration)}</span>
                <span class="compliance-indicator ${complianceClass}">
                    ${week.isCompliant ? '✓' : '✗'}
                </span>
            </span>
        `;
        
        button.addEventListener('click', function() {
            this.classList.toggle('active');
            const content = this.nextElementSibling;
            if (content.style.display === 'block') {
                content.style.display = 'none';
            } else {
                content.style.display = 'block';
            }
        });

        const content = document.createElement('div');
        content.className = 'content';
        
        // Sort days chronologically
        const sortedDays = Object.keys(week.days).sort((a, b) => new Date(a) - new Date(b));
        
        sortedDays.forEach(day => {
            const dayData = week.days[day];
            const dayDiv = document.createElement('div');
            dayDiv.className = 'day-entry';
            
            const isCompliant = dayData.totalDuration >= window.durationPerCall;
            const complianceClass = isCompliant ? 'day-compliant' : 'day-non-compliant';
            
            dayDiv.innerHTML = `
                <div class="day-header ${complianceClass}">
                    <span class="day-date">${new Date(day).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                    <span class="day-duration">${formatDuration(dayData.totalDuration)}</span>
                    <span class="day-calls">${dayData.calls} call${dayData.calls !== 1 ? 's' : ''}</span>
                </div>
            `;
            
            // Always show call details, even for single calls
            const detailsList = document.createElement('ul');
            detailsList.className = 'call-details-list';
            
            dayData.details.forEach(call => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span class="call-time">${call.startTime} - ${call.endTime}</span>
                    <span class="call-initiator">${call.initiator}</span>
                    <span class="call-duration">${formatDuration(call.duration)}</span>
                `;
                detailsList.appendChild(li);
            });
            
            dayDiv.appendChild(detailsList);
            
            content.appendChild(dayDiv);
        });

        weeklyContent.appendChild(button);
        weeklyContent.appendChild(content);
    });
    
    // Populate monthly content
    monthlyContent.innerHTML = '<h2>Monthly Details</h2>';
    
    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyData).sort();
    
    sortedMonths.forEach(monthKey => {
        const month = monthlyData[monthKey];
        const monthName = new Date(month.year, month.month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        const monthDiv = document.createElement('div');
        monthDiv.className = 'month-card';
        
        const totalDays = month.compliantDays + month.nonCompliantDays;
        const complianceRate = totalDays > 0 ? (month.compliantDays / totalDays) * 100 : 0;
        
        monthDiv.innerHTML = `
            <h3>${monthName}</h3>
            <div class="month-stats">
                <p>Total Calls: <span class="highlight">${month.totalCalls}</span></p>
                <p>Total Duration: <span class="highlight">${formatDuration(month.totalDuration)}</span></p>
                <p>Compliant Days: <span class="highlight">${month.compliantDays}</span></p>
                <p>Non-Compliant Days: <span class="highlight">${month.nonCompliantDays}</span></p>
                <p>Compliance Rate: <span class="highlight">${complianceRate.toFixed(2)}%</span></p>
            </div>
            <div class="month-chart-container">
                <canvas id="month-${monthKey}" width="200" height="100"></canvas>
            </div>
        `;
        
        monthlyContent.appendChild(monthDiv);
    });
    
    detailsDiv.appendChild(weeklyContent);
    detailsDiv.appendChild(monthlyContent);
    
    // Initialize month charts if Chart.js is loaded
    if (typeof Chart !== 'undefined') {
        sortedMonths.forEach(monthKey => {
            const month = monthlyData[monthKey];
            createMonthChart(monthKey, month.compliantDays, month.nonCompliantDays);
        });
    }
}

function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected tab content and mark button as active
    document.getElementById(`${tabName}Content`).style.display = 'block';
    document.querySelector(`.tab-button:nth-child(${tabName === 'weekly' ? 1 : 2})`).classList.add('active');
}

function createComplianceChart(compliantWeeks, missedWeeks) {
    const ctx = document.getElementById('complianceChart').getContext('2d');
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Compliant Weeks', 'Non-Compliant Weeks'],
            datasets: [{
                data: [compliantWeeks, missedWeeks],
                backgroundColor: ['#4CAF50', '#f44336'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Weekly Compliance'
                },
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function createDurationChart(daysBelowMin, daysAboveMin) {
    const ctx = document.getElementById('durationChart').getContext('2d');
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Days Above Minimum Duration', 'Days Below Minimum Duration'],
            datasets: [{
                data: [daysAboveMin, daysBelowMin],
                backgroundColor: ['#4CAF50', '#f44336'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Call Duration Compliance'
                },
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function createMonthChart(monthKey, compliantDays, nonCompliantDays) {
    const ctx = document.getElementById(`month-${monthKey}`).getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Compliant Days', 'Non-Compliant Days'],
            datasets: [{
                data: [compliantDays, nonCompliantDays],
                backgroundColor: ['#4CAF50', '#f44336'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function formatDuration(seconds) {
    if (!seconds) return '0s';
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + 'h ' : ''}${mins > 0 ? mins + 'm ' : ''}${secs}s`;
}

// CSV Export functionality
function exportToCSV() {
    if (!window.exportData) {
        alert('No data to export. Please process call data first.');
        return;
    }
    
    const exportType = document.getElementById('exportType').value;
    let csvContent = '';
    
    switch (exportType) {
        case 'all-calls':
            csvContent = exportAllCalls();
            break;
        case 'daily-summary':
            csvContent = exportDailySummary();
            break;
        case 'weekly-summary':
            csvContent = exportWeeklySummary();
            break;
        case 'monthly-summary':
            csvContent = exportMonthlySummary();
            break;
        default:
            alert('Please select an export type');
            return;
    }
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `messenger-calls-${exportType}-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportAllCalls() {
    const calls = window.exportData.allCalls;
    const headers = ['Date', 'Start Time', 'End Time', 'Initiator', 'Role', 'Duration (seconds)', 'Duration'];
    
    let csvContent = headers.join(',') + '\n';
    
    calls.forEach(call => {
        const row = [
            `"${call.date}"`,
            `"${call.startTime}"`,
            `"${call.endTime}"`,
            `"${call.initiator}"`,
            `"${call.initiatorRole}"`,
            call.durationSeconds,
            `"${call.durationFormatted}"`
        ];
        csvContent += row.join(',') + '\n';
    });
    
    return csvContent;
}

function exportDailySummary() {
    const dailyData = window.exportData.daily;
    const headers = ['Date', 'Number of Calls', 'Total Duration (seconds)', 'Total Duration', 'Meets Minimum Duration'];
    
    let csvContent = headers.join(',') + '\n';
    
    Object.keys(dailyData).sort().forEach(date => {
        const day = dailyData[date];
        const meetsMinimum = day.totalDuration >= window.durationPerCall ? 'Yes' : 'No';
        
        const row = [
            `"${date}"`,
            day.calls,
            day.totalDuration,
            `"${formatDuration(day.totalDuration)}"`,
            `"${meetsMinimum}"`
        ];
        csvContent += row.join(',') + '\n';
    });
    
    return csvContent;
}

function exportWeeklySummary() {
    const weeklyData = window.exportData.weekly;
    const headers = ['Year', 'Week', 'Total Calls', 'Total Duration (seconds)', 'Total Duration', 
                    'Days Above Minimum', 'Days Below Minimum', 'Compliant'];
    
    let csvContent = headers.join(',') + '\n';
    
    Object.keys(weeklyData).sort().forEach(yearWeek => {
        const week = weeklyData[yearWeek];
        
        const row = [
            week.year,
            week.week,
            week.totalCalls,
            week.totalDuration,
            `"${formatDuration(week.totalDuration)}"`,
            week.daysAboveMin,
            week.daysBelowMin,
            week.isCompliant ? 'Yes' : 'No'
        ];
        csvContent += row.join(',') + '\n';
    });
    
    return csvContent;
}

function exportMonthlySummary() {
    const monthlyData = window.exportData.monthly;
    const headers = ['Year', 'Month', 'Total Calls', 'Total Duration (seconds)', 'Total Duration', 
                    'Compliant Days', 'Non-Compliant Days', 'Compliance Rate (%)'];
    
    let csvContent = headers.join(',') + '\n';
    
    Object.keys(monthlyData).sort().forEach(monthKey => {
        const month = monthlyData[monthKey];
        const totalDays = month.compliantDays + month.nonCompliantDays;
        const complianceRate = totalDays > 0 ? (month.compliantDays / totalDays) * 100 : 0;
        
        const row = [
            month.year,
            month.month,
            month.totalCalls,
            month.totalDuration,
            `"${formatDuration(month.totalDuration)}"`,
            month.compliantDays,
            month.nonCompliantDays,
            complianceRate.toFixed(2)
        ];
        csvContent += row.join(',') + '\n';
    });
    
    return csvContent;
}

function showLoadingIndicator() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }
}

function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}
