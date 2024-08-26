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

    processData(participantsRoles, timezone, startDate, endDate, callsPerWeek, durationPerCall);
});

function processData(participantsRoles, timezone, startDate, endDate, callsPerWeek, durationPerCall) {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files[0]) {
        alert('Please upload a JSON file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = JSON.parse(e.target.result);
        const callRecords = data.messages.filter(message => message.call_duration && 
            new Date(message.timestamp_ms) >= startDate &&
            new Date(message.timestamp_ms) <= endDate
        );

        analyzeCalls(callRecords, participantsRoles, timezone, callsPerWeek, durationPerCall);
    };
    reader.readAsText(fileInput.files[0]);
}

function analyzeCalls(callRecords, participantsRoles, timezone, callsPerWeek, durationPerCall) {
    const weeklyData = {};
    const summaryData = {
        totalCalls: 0,
        totalDuration: 0,
        daysBelowMin: 0,
        daysAboveMin: 0
    };

    callRecords.forEach(call => {
        const date = new Date(call.timestamp_ms);
        const week = getWeekNumber(date);
        const dateString = new Date(date).toLocaleString('en-US', { timeZone: timezone });

        if (!weeklyData[week]) {
            weeklyData[week] = {};
        }

        if (!weeklyData[week][dateString]) {
            weeklyData[week][dateString] = { totalDuration: 0, calls: 0 };
        }

        weeklyData[week][dateString].totalDuration += call.call_duration;
        weeklyData[week][dateString].calls = 1;
    });

    Object.keys(weeklyData).forEach(week => {
        Object.keys(weeklyData[week]).forEach(day => {
            summaryData.totalCalls += weeklyData[week][day].calls;
            summaryData.totalDuration += weeklyData[week][day].totalDuration;

            if (weeklyData[week][day].totalDuration < durationPerCall) {
                summaryData.daysBelowMin++;
            } else {
                summaryData.daysAboveMin++;
            }
        });
    });

    const totalWeeks = Object.keys(weeklyData).length;
    const averageCallsPerWeek = summaryData.totalCalls / totalWeeks;
    const averageDurationPerCall = summaryData.totalDuration / summaryData.totalCalls;

    displaySummary(averageCallsPerWeek, averageDurationPerCall, summaryData.daysBelowMin, summaryData.daysAboveMin);
    displayDetails(weeklyData, timezone);
}

function getWeekNumber(d) {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 4 - (date.getDay() || 7));
    const yearStart = new Date(date.getFullYear(), 0, 1);
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function displaySummary(averageCallsPerWeek, averageDurationPerCall, daysBelowMin, daysAboveMin) {
    const summaryDiv = document.getElementById('summary');
    summaryDiv.innerHTML = `
        <h2>Summary</h2>
        <p>Average Calls Per Week: ${averageCallsPerWeek.toFixed(2)}</p>
        <p>Average Duration Per Call: ${formatDuration(averageDurationPerCall)}</p>
        <p>Days Below Minimum Duration: ${daysBelowMin}</p>
        <p>Days Above Minimum Duration: ${daysAboveMin}</p>
    `;
}

function displayDetails(weeklyData, timezone) {
    const detailsDiv = document.getElementById('details');
    detailsDiv.innerHTML = '<h2>Details</h2>';

    Object.keys(weeklyData).forEach(week => {
        const button = document.createElement('button');
        button.className = 'collapsible';
        button.textContent = `Week ${week}`;
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

        Object.keys(weeklyData[week]).forEach(day => {
            const p = document.createElement('p');
            p.textContent = `${day}: ${formatDuration(weeklyData[week][day].totalDuration)}`;
            content.appendChild(p);
        });

        detailsDiv.appendChild(button);
        detailsDiv.appendChild(content);
    });
}

function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + 'h ' : ''}${mins > 0 ? mins + 'm ' : ''}${secs}s`;
}
