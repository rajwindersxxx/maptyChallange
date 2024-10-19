('use strict');
import icons from './data.js';
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const inputLocation = document.querySelector('.form__input--location');

const workoutHeading = document.querySelector('.workout__heading');
const workoutSpeedSort = document.querySelector('.speed__sorting');
const workoutFilter = document.querySelector('.form__input--filter');
const workoutList = document.querySelector('.workouts__data');
const workoutDeleteAll = document.querySelector('.deleteAll__btn');
const workoutAdd = document.querySelector('.add__btns');

const overlayWindow = document.querySelector('.overlay');

// model windows buttons
const allErrorButtons = document.querySelectorAll('.confirm__button');
const errorButton = document.querySelector('.confirm__ok');
const confirmButton = document.querySelector('.confirm__yes');
const cancelButton = document.querySelector('.confirm__no');
const weatherBlock = document.querySelector('.current__weather');
//Test button
const testButton = document.querySelector('.test');

let map, mapEvent;
class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;
  constructor(coords, distance, duration, address, weather) {
    // this.date = ... used in old js version
    // this.id = ...
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
    this.address = address;
    this.weather = weather;
  }
  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, duration, distance, cadence, address, weather) {
    super(coords, duration, distance, address, weather);
    this.cadence = cadence;
    //when we call function inside , we do not need return keyword
    this.calcPace();
    this._setDescription();
  }
  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
  static rebuildFromStorage(data) {
    const obj = new Running([0, 0], 0, 0, 0);
    obj.date = data.date;
    obj.id = data.id;
    obj.clicks = data.clicks;
    obj.coords = data.coords;
    obj.duration = data.duration;
    obj.distance = data.distance;
    obj.cadence = data.cadence;
    obj.pace = data.pace;
    obj.description = data.description;
    obj.address = data.address;
    obj.weather = data.weather;
    return obj;
  }
}
class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, duration, distance, elevationGain, address, weather) {
    super(coords, duration, distance, address, weather);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }
  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
  static rebuildFromStorage(data) {
    const obj = new Cycling([0, 0], 0, 0, 0);
    obj.date = data.date;
    obj.id = data.id;
    obj.clicks = data.clicks;
    obj.coords = data.coords;
    obj.duration = data.duration;
    obj.distance = data.distance;
    obj.speed = data.speed;
    obj.elevationGain = data.elevationGain;
    obj.description = data.description;
    obj.address = data.address;
    obj.weather = data.weather;
    return obj;
  }
}

// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycling1 = new Cycling([39, -12], 27, 95, 523);
// console.log(run1, cycling1);

////////////////////////////////////////////////////////////
//APPLICATION ARCHITECTURE
class App {
  #map;
  #mapZoomlevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = new Map();
  #editWorkout = false;
  #markersArray = [];
  editObject = '';
  isSorted = false;
  sortedWorkout = [];
  currentWeather;
  constructor() {
    this._getPosition(); // run when page load when object created
    this._getLocalStorage();
    this.sortedWorkout = JSON.parse(JSON.stringify(this.#workouts));

    //attach event handlers

    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    workoutHeading.addEventListener('click', this._sortingWorkout.bind(this));
    overlayWindow.addEventListener('click', this._hideErrorMessage.bind(this));
    workoutAdd.addEventListener('click', this._showForm.bind(this));
    errorButton.addEventListener('click', this._hideErrorMessage.bind(this));
    cancelButton.addEventListener('click', this._hideErrorMessage.bind(this));
    confirmButton.addEventListener('click', this._hideErrorMessage.bind(this));
    workoutDeleteAll.addEventListener(
      'click',
      this._deleteAllWorkout.bind(this)
    );
    //Event for testing
    testButton.addEventListener('click', this._fitAllMarkers.bind(this));
  }
  //* my event listeners------------------------------------------------------------------------------
  _workoutActionEvents(button) {
    if (button.classList.contains('workout__delete'))
      this._deleteWorkout(button.dataset.id);
    if (button.classList.contains('workout__edit'))
      this._editWorkout(button.dataset.id);
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this), //here we bind this keyword to access in function as it return undefined
        function () {
          alert('Could not get your position');
        }
      );
    }
  }
  _fitAllMarkers(e) {
    e.stopPropagation();
    let group = new L.featureGroup(this.#markersArray);
    this.#map.fitBounds(group.getBounds(), {
      padding: [50, 50],
    });
  }
  async _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    // console.log(`https://www.google.com/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];
    this.currentWeather = await this._getWeather(coords);
    this._renderWeatherData();
    console.log(this.currentWeather);

    this.#map = L.map('map', {
      worldCopyJump: false,
    }).setView(coords, this.#mapZoomlevel);

    const southWest = L.latLng(-90, -180);
    const northEast = L.latLng(90, 180);
    const bounds = L.latLngBounds(southWest, northEast);
    this.#map.setMaxBounds(bounds);
    this.#map.on('drag', () => {
      this.#map.panInsideBounds(bounds, { animate: false });
    });
    this.#map.setMinZoom(2);
    this.#map.setMaxZoom(18);
    //   console.log(map);
    L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);
    // Handling  clicks on map
    this.#map.on('click', async map => {
      this._showForm(map);
      const { lat, lng } = map.latlng;
      inputLocation.value = await this._getAddress([lat, lng]);
      this.currentWeather = await this._getWeather([lat, lng]);
      this._renderWeatherData();
      console.log(this.currentWeather);
    });
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }
  _showForm(mapE) {
    inputDistance.value =
      inputDuration.value =
      inputElevation.value =
      inputCadence.value =
        '';
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }
  _hideForm() {
    //Empty input
    inputDistance.value =
      inputDuration.value =
      inputElevation.value =
      inputCadence.value =
      inputLocation.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }
  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }
  _newWorkout(e) {
    // if statement when call for edit
    e.preventDefault();
    if (this.#editWorkout) {
      // it render new list of workouts
      this._renderModifiedWorkout();
      return;
    }
    // return error if location not choose form map
    if (!this.#mapEvent.latlng) {
      errorButton.classList.remove('hidden__input');
      return this._renderErrorMessage('Please choose location from map');
    }
    // run when editWorkout is false
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    const address = inputLocation.value;
    const weatherDetails = this.currentWeather;
    let workout;
    // Check if data is valid
    // If activity running , create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      if (
        // /!Number.isFinite(distance) ||
        // /!Number.isFinite(duration) ||
        // /!Number.isFinite(cadence)
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        errorButton.classList.remove('hidden__input');
        return this._renderErrorMessage(
          'The input must be a positive.non-numeric ,symbols and special character not allowed'
        );
      }

      workout = new Running(
        [lat, lng],
        distance,
        duration,
        cadence,
        address,
        weatherDetails
      );
    }
    // If workout cycling , create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        errorButton.classList.remove('hidden__input');
        return this._renderErrorMessage(
          'The input must be a positive.non-numeric ,symbols and special character not allowed'
        );
      }
      workout = new Cycling(
        [lat, lng],
        distance,
        duration,
        elevation,
        address,
        weatherDetails
      );
    }
    // add new object to workout array
    this.#workouts.push(workout);

    this.sortedWorkout = JSON.parse(JSON.stringify(this.#workouts));

    // Render workout on map as marker
    this._renderWorkout(workout);

    //clear input fields
    this._hideForm();
    //Display the marker
    this._renderWorkoutMarker(workout);

    //Set local storage to all workouts
    this._setLocalStorage();

    //* testing
    console.log(this.#workouts);
  }

  // * My methods -----------------------------------------------------------------------------
  _deleteWorkout(workoutId) {
    
    if (workoutId) {
      const marker = this.#markers.get(workoutId);

      if (marker) marker.remove(this.#map);

      const workoutElement = document.querySelector(`[data-id="${workoutId}"]`);
      if (workoutElement) workoutElement.remove();

      const workoutIndex = this.#workouts.findIndex(
        workout => workout.id === workoutId
      );

      const markerIndex = this.#markersArray.findIndex(
        marker => marker.options.id === workoutId
      );
      console.log(markerIndex);
      if (workoutIndex > -1) this.#workouts.splice(workoutIndex, 1);
      if (markerIndex > -1) this.#markersArray.splice(markerIndex, 1);
      this._setLocalStorage();
      workoutList.innerHTML = '';
      this._getLocalStorage();
    }
  }
  _deleteAllWorkout() {
    confirmButton.classList.remove('hidden__input');
    cancelButton.classList.remove('hidden__input');
    this._renderErrorMessage('Do you want to delete all workouts');
    confirmButton.addEventListener('click', () => {
      this.#workouts = [];
      this.#markersArray.forEach(marker => marker.remove());
      this.#markersArray = [];
      this._setLocalStorage();
      this._getLocalStorage();
      this._hideErrorMessage();
    });
  }

  _editWorkout(id) {
    // run while edit workout
    this.#editWorkout = true;
    this.editObject = this.#workouts.find(items => items.id === id);
    //show form and rendered required fields
    this._showForm();
    if (this.editObject.type === 'cycling') {
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
    }
    if (this.editObject.type === 'running') {
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
    }
    inputType.value = this.editObject.type;
    inputDistance.value = this.editObject.distance;
    inputCadence.value = this.editObject.cadence;
    inputDuration.value = this.editObject.duration;
    inputElevation.value = this.editObject.elevationGain;

    //when press Enter , _newWorkout function render which edit true
  }

  _renderWorkoutMarker(workout) {
    let marker = L.marker(workout.coords, { id: workout.id }).addTo(this.#map);
    this.#markersArray.push(marker);
    marker
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    this.#markers.set(workout.id, marker);
  }
  _renderModifiedWorkout() {
    const workoutIndex = this.#workouts.findIndex(
      workout => workout.id === this.editObject.id
    );

    this.editObject.type = inputType.value;
    this.editObject.distance = +inputDistance.value;
    this.editObject.duration = +inputDuration.value;
    //*Modify this code later---------------------x
    if (this.editObject.type === 'cycling') {
      this.editObject.elevationGain = inputElevation.value;
      this.editObject.pace =
        this.editObject.duration / this.editObject.distance;
    }
    if (this.editObject.type === 'running') {
      this.editObject.cadence = +inputCadence.value;
      this.editObject.speed =
        this.editObject.distance / (this.editObject.duration / 60);
    }
    this.#workouts.splice(workoutIndex, 1, this.editObject);

    this._hideForm();

    this._setLocalStorage();
    this._getLocalStorage();
    this.#editWorkout = false;
  }

  //*SORTING EVENT ------------------------------------
  _sortingWorkout(e) {
    e.stopPropagation();
    const clickedButton =
      e.target.closest('button') || e.target.closest('select');
    if (!clickedButton) return;

    const sortType = clickedButton.dataset.sorting;
    let cloneArray = JSON.parse(JSON.stringify(this.#workouts)); // Use this for filtering

    switch (sortType) {
      case 'distance':
      case 'duration':
      case 'speed':
        const sortBy =
          sortType === 'speed'
            ? workoutFilter.value === 'running'
              ? 'pace'
              : 'speed'
            : sortType;
        this.sortedWorkout = this._sorting(
          this.sortedWorkout,
          sortBy,
          `${this.isSorted ? 'desc' : 'asc'}`
        );
        break;

      case 'filter':
        this._filterWorkouts(cloneArray);
        break;

      default:
        return;
    }

    // Clear and re-render the workout list
    workoutList.innerHTML = '';
    this.sortedWorkout.forEach(work => {
      this._renderWorkout(work);
    });
  }

  _filterWorkouts(workouts) {
    switch (workoutFilter.value) {
      case 'cycling':
        this.sortedWorkout = workouts.filter(item => item.type === 'cycling');
        workoutSpeedSort.classList.remove('hidden__input');
        break;
      case 'running':
        this.sortedWorkout = workouts.filter(item => item.type === 'running');
        workoutSpeedSort.classList.remove('hidden__input');
        break;
      case 'all':
        this.sortedWorkout = workouts;
        workoutSpeedSort.classList.add('hidden__input');
        break;
    }
  }

  _sorting(array, sortBy, order) {
    array.sort((a, b) =>
      order === 'desc' ? b[sortBy] - a[sortBy] : a[sortBy] - b[sortBy]
    );
    this.isSorted = !this.isSorted;
    return array; // Return the sorted array
  }

  _moveToPopup(e) {
    const buttonClicked = e.target.closest('.icon__btns');
    if (buttonClicked) {
      this._workoutActionEvents(buttonClicked);
      e.stopPropagation();
      return;
    }

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomlevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
    //using the public interface
    // workout.click();
  }
  // using the storage api
  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }
  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    let rebuildObject;
    data.map((item, index) => {
      if (item.type === 'running')
        rebuildObject = Running.rebuildFromStorage(item);
      if (item.type === 'cycling')
        rebuildObject = Cycling.rebuildFromStorage(item);
      this.#workouts.splice(index, 1, rebuildObject);
    });

    this.sortedWorkout = JSON.parse(JSON.stringify(this.#workouts));
    workoutList.innerHTML = '';

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
  _renderErrorMessage(message) {
    overlayWindow.classList.remove('hidden__message');
    document.querySelector('.message').textContent = message;
  }
  _hideErrorMessage(e) {
    if (e.target.tagName === 'BUTTON') {
      overlayWindow.classList.add('hidden__message');
      allErrorButtons.forEach(button => {
        button.classList.add('hidden__input');
      });
      return;
    }
    const modalWindow = e.target.closest('.model__window');
    if (modalWindow) return;
    //hide all inputs
    overlayWindow.classList.add('hidden__message');
    allErrorButtons.forEach(button => {
      button.classList.add('hidden__input');
    });
  }

  // All Api block ------------------------------------------
  async _getCoordinates() {
    const address = encodeURIComponent(inputLocation.value);
    try {
      const response = await fetch(
        `https://api.opencagedata.com/geocode/v1/json?q=${address}&key=f531fc1a5c0847ffac7ec0bea351a739`
      );
      if (!response.ok) {
        if (!response.ok) {
          throw new Error(`Error fetching address: ${response.statusText}`);
        }
      }
      const data = await response.json();
      const { geometry } = data.results[0]; // Get the first result's geometry
      const coordinates = [geometry.lat, geometry.lng];
      console.log(coordinates);
      return coordinates;
    } catch (error) {
      console.error(error.message);
      return null;
    }
  }
  async _getAddress(coords) {
    console.log(coords);
    const [lat, lng] = coords;
    const query = encodeURIComponent(`${lat} ${lng}`);
    try {
      const response = await fetch(
        `https://api.opencagedata.com/geocode/v1/json?q=${query}&key=f531fc1a5c0847ffac7ec0bea351a739`
      );
      if (!response.ok) {
        throw new Error(`Error fetching address: ${response.statusText}`);
      }
      const data = await response.json();

      const address = data.results[0]?.formatted || 'Address not found';
      const formatAddress = [
        ...new Set(
          address
            .split(',')
            .map(item => item.trim())
            .filter(
              item => item !== 'unnamed road' && item !== '' && !/\d/.test(item)
            ) // Filter out unwanted items
        ),
      ].join(',');
      return formatAddress;
    } catch (err) {
      console.error(err.message);
      return null;
    }
  }
  async _getWeather(coords) {
    const [log, lat] = coords;
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${log}&longitude=${lat}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m`
      );
      const data = await response.json();
      const address = await this._getAddress([log, lat]);
      const day_Night = data.current.is_day === 1 ? 'day' : 'day'; //always light icon
      const weather_code = data.current.weather_code;
      const weatherData = {
        time: data.current.time,
        temperature: `${data.current.temperature_2m} ${data.current_units.temperature_2m}`,
        humidity: `${data.current.relative_humidity_2m} ${data.current_units.relative_humidity_2m}`,
        wind: `${data.current.wind_speed_10m} ${data.current_units.wind_speed_10m}`,
        weatherCode: weather_code,
        dayNight: day_Night,
        description: icons[weather_code][day_Night].description,
        icon: icons[weather_code][day_Night].image,
        address: address,
      };

      return weatherData;
    } catch (error) {
      console.log(error);
    }
  }
  // all html blocks -----------------------------------------------
  _renderWeatherData() {
    weatherBlock.innerHTML = '';
    const markup = `
        <div class="weather__location">${this.currentWeather.address}</div>
        <div class="weather__icon">
          <img
            src="${this.currentWeather.icon}"
            alt="weather icon"
          />
          <p>${this.currentWeather.description}</p>
        </div>
        <div class="weather__description">
          <div class="weather__details"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path d="M460-160q-50 0-85-35t-35-85h80q0 17 11.5 28.5T460-240q17 0 28.5-11.5T500-280q0-17-11.5-28.5T460-320H80v-80h380q50 0 85 35t35 85q0 50-35 85t-85 35ZM80-560v-80h540q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43h-80q0-59 40.5-99.5T620-840q59 0 99.5 40.5T760-700q0 59-40.5 99.5T620-560H80Zm660 320v-80q26 0 43-17t17-43q0-26-17-43t-43-17H80v-80h660q59 0 99.5 40.5T880-380q0 59-40.5 99.5T740-240Z"/></svg> ${this.currentWeather.wind}</div>
          <div class="weather__details"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path d="M491-200q12-1 20.5-9.5T520-230q0-14-9-22.5t-23-7.5q-41 3-87-22.5T343-375q-2-11-10.5-18t-19.5-7q-14 0-23 10.5t-6 24.5q17 91 80 130t127 35ZM480-80q-137 0-228.5-94T160-408q0-100 79.5-217.5T480-880q161 137 240.5 254.5T800-408q0 140-91.5 234T480-80Zm0-80q104 0 172-70.5T720-408q0-73-60.5-165T480-774Q361-665 300.5-573T240-408q0 107 68 177.5T480-160Zm0-320Z"/></svg> ${this.currentWeather.humidity}</div>
          <div class="weather__details"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path d="M480-120q-83 0-141.5-58.5T280-320q0-48 21-89.5t59-70.5v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q38 29 59 70.5t21 89.5q0 83-58.5 141.5T480-120Zm0-80q50 0 85-35t35-85q0-29-12.5-54T552-416l-32-24v-280q0-17-11.5-28.5T480-760q-17 0-28.5 11.5T440-720v280l-32 24q-23 17-35.5 42T360-320q0 50 35 85t85 35Zm0-120Z"/></svg> ${this.currentWeather.temperature}</div>
        </div>
      </div>
    `;
    weatherBlock.insertAdjacentHTML('afterbegin', markup);
  }
  
  _renderWorkout(workout) {
    let addressMarkup = `
    <div class='workout__details workout__address'>
     <h2 class="workout__location">On ${workout.address}</h2>
     </div>
     <div class="weather__details">
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height="24px"
    viewBox="0 -960 960 960"
    width="24px"
    fill="#e8eaed"
  >
    <path
      d="M460-160q-50 0-85-35t-35-85h80q0 17 11.5 28.5T460-240q17 0 28.5-11.5T500-280q0-17-11.5-28.5T460-320H80v-80h380q50 0 85 35t35 85q0 50-35 85t-85 35ZM80-560v-80h540q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43h-80q0-59 40.5-99.5T620-840q59 0 99.5 40.5T760-700q0 59-40.5 99.5T620-560H80Zm660 320v-80q26 0 43-17t17-43q0-26-17-43t-43-17H80v-80h660q59 0 99.5 40.5T880-380q0 59-40.5 99.5T740-240Z"
    />
  </svg>
  ${workout.weather.wind}
</div>
<div class="weather__details">
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height="24px"
    viewBox="0 -960 960 960"
    width="24px"
    fill="#e8eaed"
  >
    <path
      d="M491-200q12-1 20.5-9.5T520-230q0-14-9-22.5t-23-7.5q-41 3-87-22.5T343-375q-2-11-10.5-18t-19.5-7q-14 0-23 10.5t-6 24.5q17 91 80 130t127 35ZM480-80q-137 0-228.5-94T160-408q0-100 79.5-217.5T480-880q161 137 240.5 254.5T800-408q0 140-91.5 234T480-80Zm0-80q104 0 172-70.5T720-408q0-73-60.5-165T480-774Q361-665 300.5-573T240-408q0 107 68 177.5T480-160Zm0-320Z"
    />
  </svg>
  ${workout.weather.humidity}
</div>
<div class="weather__details">
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height="24px"
    viewBox="0 -960 960 960"
    width="24px"
    fill="#e8eaed"
  >
    <path
      d="M480-120q-83 0-141.5-58.5T280-320q0-48 21-89.5t59-70.5v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q38 29 59 70.5t21 89.5q0 83-58.5 141.5T480-120Zm0-80q50 0 85-35t35-85q0-29-12.5-54T552-416l-32-24v-280q0-17-11.5-28.5T480-760q-17 0-28.5 11.5T440-720v280l-32 24q-23 17-35.5 42T360-320q0 50 35 85t85 35Zm0-120Z"
    />
  </svg>
  ${workout.weather.temperature}
</div>
<div class="weather__details weather__icon--list">
${workout.weather.description}
          <img
            src="${workout.weather.icon}"
            alt="weather icon"
          />
</div>
    `;
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <h2 class="workout__title">${
        workout.description
      } at ${workout.weather.time.slice(11, 16)}</h2>
      <div class="workout__action">
      <button class="workout__edit icon__btns" data-id="${workout.id}">
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height="24px"
    viewBox="0 -960 960 960"
    width="24px"
    fill="#e8eaed"
  >
    <path
      d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"
    />
  </svg>
</button>
<button class="workout__delete icon__btns" data-id="${workout.id}">
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height="24px"
    viewBox="0 -960 960 960"
    width="24px"
    fill="#e8eaed"
  >
    <path
      d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"
    />
  </svg>
</button>
      </div>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>
          `;

    if (workout.type === 'running')
      html += `
    <div class="workout__details">
      <span class="workout__icon">⚡️</span>
      <span class="workout__value">${workout.pace.toFixed(1)}</span>
      <span class="workout__unit">min/km</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">🦶🏼</span>
      <span class="workout__value">${workout.cadence}</span>
      <span class="workout__unit">spm</span>
    </div>
    ${addressMarkup}
  
  </li>
  `;
    if (workout.type === 'cycling') {
      html += `
    <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.speed.toFixed(1)}</span>        
        <span class="workout__unit">km/h</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⛰</span>
        <span class="workout__value">${workout.elevationGain}</span>
        <span class="workout__unit">m</span>
      </div>
    ${addressMarkup}   
    </li>`;
    }
    workoutList.insertAdjacentHTML('afterbegin', html);
  }
}

const app = new App();
//get current location from browser

// *coding challenges
/*
*must do
// Ability to delete all workouts
// Ability to sort workouts by a certain field(eg. distance)
// Re-build Running and cycling object coming from Local Storage
// More realistic error and confirmation messages

*hard challenges 

// Ability to position the map to show all workouts 
Ability to draw lines and shapes instead of just points.
// Geocode location from coordinates ("Run in Faro, Portugal")
Display weather data for workout time and place
*/
