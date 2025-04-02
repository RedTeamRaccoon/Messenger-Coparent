# Messenger Co-Parent Call Tracker

Available at:
https://redteamraccoon.github.io/Messenger-Coparent/

A privacy-focused web application that helps parents in co-parenting arrangements analyze Facebook Messenger video call history to track compliance with custody agreements.

## Overview

This tool allows parents to upload their Facebook Messenger JSON data file and analyze video call patterns between a child and parent. It processes the data entirely client-side to ensure privacy, with no information being sent to any server.

## Features

- **Privacy-First Design**: All data processing happens in your browser - no data is uploaded to any server
- **Call Duration Analysis**: Tracks call durations and compares them against required minimums
- **Compliance Tracking**: Identifies compliant and non-compliant weeks based on custody agreement requirements
- **Detailed Reports**: Provides weekly and monthly breakdowns of call patterns
- **Data Visualization**: Visual charts showing compliance rates and call statistics
- **CSV Export**: Export detailed call data for record-keeping or legal proceedings
- **Responsive Design**: Works on desktop and mobile devices

## How to Use

1. **Download Your Facebook Messenger Data**
   - Go to [Facebook Download Your Information](https://www.facebook.com/dyi/)
   - Select JSON format when downloading
   - Request only the messages from the conversation with your co-parent

2. **Upload the JSON File**
   - Once you receive your data from Facebook, locate the messages.json file for the conversation
   - Upload this file using the file selector on the application

3. **Configure Analysis Settings**
   - Select your timezone
   - Set the date range for analysis
   - Specify required calls per week and minimum duration per call based on your custody agreement
   - Assign roles (child/adult) to conversation participants

4. **Analyze the Data**
   - Click "Analyze Call Data" to process the information
   - Review the summary statistics and detailed breakdowns
   - Use the weekly and monthly views to examine specific time periods

5. **Export Results**
   - Select the type of data you want to export
   - Click "Export to CSV" to download the data for record-keeping or legal proceedings

## Privacy Notice

This application processes all data locally in your browser. No information is uploaded to any server, ensuring your private conversations remain private. The tool is specifically designed to help parents document call patterns for custody arrangements while maintaining complete data privacy.

## Legal Disclaimer

This tool is provided for informational purposes only. The data and analysis should be reviewed by your legal counsel before being used in legal proceedings. The developers make no guarantees about the accuracy or completeness of the analysis.

## Technical Details

- Built with vanilla JavaScript, HTML, and CSS
- Uses Chart.js for data visualization
- Processes Facebook Messenger JSON format
- All processing happens client-side for maximum privacy
