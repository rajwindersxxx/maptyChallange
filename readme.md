# Must-Do Challenges

- Delete All Workouts: Users can delete all workouts with a confirmation prompt. All data, including map markers, is cleared from both the UI and local storage.
- Edit workout: Users can modify workout distance , duration and time
- Sort Workouts: Users can sort workouts by various fields such as distance, duration, and speed in ascending or descending order.
- Restore Workouts from Local Storage: Workouts are reconstructed from local storage on app reload, ensuring persistent data for both running and cycling.
- Error and Confirmation Messages: User-friendly messages are displayed for errors and confirmations, enhancing the user experience.

## Other Challenges

- Map Zoom to Fit All Workouts: Automatically adjusts the map to display all logged workouts on screen.
- Geoder Locations: Converts workout coordinates into readable addresses using OpenCage, showing the location where the workout took place (e.g., "Run in Faro, Portugal").

## Technologies Used

- Leaflet.js for interactive maps and geolocation.
- JavaScript (ES6) with modern features such as classes and template literals.
- LocalStorage for saving and persisting workouts.
- APIs for geocoding (OpenCage) and real-time weather data.

### pending challage

- Draw Workout Routes: Instead of just placing markers, the app now draws routes for workouts, providing a visual path of the workout.
- Weather Data: Fetches and displays real-time weather data for the specific time and location of the workout using openWeatherApi