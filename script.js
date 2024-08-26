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
    const participants = new Set();
    data.messages.forEach(message => {
        message.participants.forEach(participant => {
            participants.add(participant.name);
        });
    });

    const participantsSelect = document.getElementById('participantsSelect');
    participantsSelect.innerHTML = '';
    participants.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        participantsSelect.appendChild(option);
    });
}

document.getElementById('processButton').addEventListener('click', function() {
    const participantsSelect = document.getElementById('participantsSelect');
    const selectedParticipants = Array.from(participantsSelect.selectedOptions).map(option => option.value);
    
    const startDate = new Date(document.getElementById('startDate').value);
    const endDate = new Date(document.getElementById('endDate').value);
    
    const callsPerWeek = parseInt(document.getElementById('callsPerWeek').value);
    const durationPerCall = parseInt(document.getElementById('durationPerCall').value) * 60; // Convert minutes to seconds

    processData(selectedParticipants, startDate, endDate, callsPerWeek, durationPerCall);
});

function processData(selectedParticipants, startDate, endDate, callsPerWeek, durationPerCall) {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files[0]) {
        alert('Please upload a JSON file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = JSON.parse(e.target.result);
        const callRecords = data.messages.filter(message => message.call_duration && 
            selectedParticipants.some(participant => message.participants.some(p => p.name === participant)) &&
            new Date(message.timestamp_ms) >= startDate &&
            new Date(message.timestamp_ms) <= endDate
        );

        analyzeCalls(callRecords, callsPerWeek, durationPerCall);
    };
    reader.readAsText(fileInput.files[0]);
}

function analyzeCalls(callRecords, callsPerWeek, durationPerCall) {
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
        const dateString = date.toISOString().split('T')[0];

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
    displayDetails(weeklyData);
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
        <p>Average Duration Per Call: ${(averageDurationPerCall / 60).toFixed(2)} minutes</p>
        <p>Days Below Minimum Duration: ${daysBelowMin}</p>
        <p>Days Above Minimum Duration: ${daysAboveMin}</p>
    `;
}

function displayDetails(weeklyData) {
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
            p.textContent = `${day}: ${(weeklyData[week][day].totalDuration / 60).toFixed(2)} minutes`;
            content.appendChild(p);
        });

        detailsDiv.appendChild(button);
        detailsDiv.appendChild(content);
    });
}
