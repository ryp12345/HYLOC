# Calendar UI Documentation

## Overview

This document outlines the Calendar UI features available in the Hyloc-PMS system. The calendar provides a visual representation of events and activities with multiple view modes.

---

## Calendar View Modes

### 1. Monthly View

The default calendar view that displays an entire month in a grid format.

#### Features:

- **Grid Layout**: 7 columns (days of week) × 5-6 rows (weeks)
- **Navigation Controls**:
  - Previous Month button (left arrow)
  - "Today" button - jumps to current date
  - Next Month button (right arrow)
  - Month/Year display at the top center
- **Day Headers**: Sun, Mon, Tue, Wed, Thu, Fri, Sat
- **Day Cells**:
  - Date number displayed in top-left
  - Current day highlighted with blue border
  - Past dates shown with reduced opacity (80%)
  - Empty cells for days outside current month (gray background)
  - Each cell has minimum height of 80px
- **Visual Indicators**:
  - "Today" label appears on current date in blue italic text
  - Hover effect on valid dates (background changes to gray-50)

#### Navigation Restrictions:

- **Past Limit**: Can navigate back to employee join date/month
- **Future Limit**: Can navigate up to 12 months ahead
- Navigation buttons are disabled when limits are reached

---

### 2. Weekly View

Displays a single week (7 consecutive days) with more space per day.

#### Features:

- **Grid Layout**: 7 columns (one per day of the week)
- **Navigation Controls**:
  - Previous Week button (left arrow)
  - "Today" button - jumps to current week
  - Next Week button (right arrow)
  - Week range display showing start and end dates
- **Day Headers**: Sun, Mon, Tue, Wed, Thu, Fri, Sat with dates
- **Day Cells**:
  - Full date number displayed (e.g., "29")
  - Current day highlighted with blue border
  - Past dates shown with reduced opacity
  - Larger cell size for better visibility
- **Week Calculation**:
  - Week starts on Sunday (day 0)
  - Week ends on Saturday (day 6)
  - Initial load shows current week

#### Navigation Restrictions:

- **Past Limit**: Cannot navigate to weeks before employee join date
- **Future Limit**: Can navigate up to 1 year ahead
- Navigation buttons disabled at limits

---

### 3. Daily View

*Note: Daily view is not currently implemented as a separate view mode. The system uses Month and Week views with date selection capabilities.*

---

## View Mode Toggle

### Implementation:

- Button group in calendar header
- Two options available:
  1. **Month** button - switches to monthly view
  2. **Week** button - switches to weekly view
- Active view button is highlighted with darker blue background
- Toggle persists during navigation
- View mode can be changed via `onViewModeChange` callback

---

## Common Calendar Features

### Color Coding and Visual Design:

- **Calendar Background**: White with subtle shadows
- **Header Background**: Blue gradient (from-blue-600 to-blue-700)
- **Header Text**: White color
- **Current Day**: 2px blue border
- **Past Dates**: 80% opacity
- **Empty Cells**: Gray-50 background
- **Day Names Header**: Light blue background (blue-100) with blue text

### Responsive Behavior:

- Grid layout maintains 7-column structure
- Cell heights adapt to content
- Buttons include hover states for better UX
- All dates have consistent spacing and padding

### Date Selection:

- Clicking on a valid date triggers `handleDayClick` function
- Past dates can be clicked but interactions are limited
- Future dates are interactive for calendar operations

---

## Technical Components

### Main Component: `EmployeeCalendar.jsx`

- Located at: `client/src/pages/employee/leaves/EmployeeCalendar.jsx`
- Total lines: 1,563 lines of code
- Handles both month and week view rendering

### Supporting Component: `CalendarLoader.jsx`

- Located at: `client/src/pages/common/calendar/CalendarLoader.jsx`
- Provides loading states and data fetching wrapper
- Shows spinner animation during data load
- Includes error handling with retry button

### Parent Page: `LeavesPage.jsx`

- Located at: `client/src/pages/employee/leaves/LeavesPage.jsx`
- Integrates calendar with leave management functionality
- Manages calendar state and data flow

---

## Props and Configuration

### EmployeeCalendar Component Props:

| Prop                 | Type     | Description                                |
| -------------------- | -------- | ------------------------------------------ |
| `currentMonth`     | Date     | Currently displayed month                  |
| `onMonthChange`    | Function | Callback for month navigation              |
| `viewMode`         | String   | Current view mode ('month' or 'week')      |
| `onViewModeChange` | Function | Callback to switch view modes              |
| `joinDate`         | Date     | Employee join date (for navigation limits) |

---

## User Interactions

### Month View Navigation:

1. Click **Previous** arrow to go to previous month (if within limits)
2. Click **Today** button to jump to current month
3. Click **Next** arrow to go to next month (if within limits)
4. Click **Week** toggle to switch to weekly view

### Week View Navigation:

1. Click **Previous** arrow to go to previous week (if within limits)
2. Click **Today** button to jump to current week
3. Click **Next** arrow to go to next week (if within limits)
4. Click **Month** toggle to switch to monthly view

### General:

- Click any valid date cell to select it
- Disabled navigation buttons show reduced opacity and display tooltips explaining the limit
- All transitions have smooth hover effects

---

## Calendar Date Calculations

### Month View:

- Calculates first day of month
- Determines starting day of week
- Pads beginning with empty cells
- Fills 35-42 cells (5-6 weeks) for consistent layout

### Week View:

- Calculates current week start (Sunday)
- Creates array of 7 consecutive dates
- Maintains week boundaries across navigation

---

## Future Enhancements (Potential)

The calendar is designed with extensibility in mind. Future implementations could include:

1. **Daily View**: A detailed single-day view with hourly breakdown
2. **Multi-Month View**: Display 3 or 6 months at once
3. **Year View**: Annual overview with month thumbnails
4. **Custom Date Ranges**: Filter and view specific date ranges
5. **Print Functionality**: Export calendar views to PDF
6. **Keyboard Navigation**: Arrow keys for date navigation
7. **Mini Calendar**: Compact date picker widget
8. **Timezone Support**: Multi-timezone calendar display

---

## Styling and Theme

### Current Theme:

- **Primary Color**: Blue (various shades: 100, 400, 600, 700, 800)
- **Borders**: Gray-400
- **Text Colors**:
  - Headers: Blue-800
  - Dates: Gray-700
  - Current Day: Blue-600
- **Backgrounds**:
  - Main: White
  - Headers: Blue gradient
  - Empty cells: Gray-50
  - Day names: Blue-100

### CSS Classes Used:

- Tailwind CSS utility classes
- Responsive grid system
- Hover and transition effects
- Custom color combinations

---

## Accessibility Considerations

### Current Implementation:

- Button titles (tooltips) for navigation controls
- Disabled state styling for unavailable actions
- Visual feedback on hover
- Clear color contrast for text readability

### Recommendations:

- Add ARIA labels for screen readers
- Implement keyboard navigation support
- Add focus indicators for accessibility
- Ensure color-blind friendly palette options

---

## Browser Compatibility

The calendar uses modern CSS and JavaScript features:

- CSS Grid for layout
- Flexbox for alignment
- Date object for calculations
- SVG icons for UI elements

Recommended browsers: Chrome, Firefox, Safari, Edge (latest versions)

---

## Performance Considerations

- Calendar renders efficiently with React hooks
- Date calculations are memoized where possible
- View mode switching is instant with state management
- No unnecessary re-renders on navigation

---

*Last Updated: January 29, 2026*
*Version: 1.0*