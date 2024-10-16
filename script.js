'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

const sideBar = document.querySelector('.sidebar');
const workoutSpeedSort = document.querySelector('.speed__sorting');
const workoutFilter = document.querySelector('.form__input--filter');
const workoutList = document.querySelector('.workouts__data');
const workoutEdit = document.querySelector('.workout__edit');
const workoutDeleteAll = document.querySelector('.delete__btn');
const workoutHeading = document.querySelector('.workout__heading');
const overlayWindow = document.querySelector('.overlay');
const modelWindow = document.querySelector('model__window');
const errorMessage = document.querySelector('.message');
const errorButton = document.querySelector('.confirm__button');
let map, mapEvent;
class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;
  constructor(coords, distance, duration) {
    // this.date = ... used in old js version
    // this.id = ...
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
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
  constructor(coords, duration, distance, cadence) {
    super(coords, duration, distance);
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
}
class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, duration, distance, elevationGain) {
    super(coords, duration, distance);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }
  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
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
  editObject = '';
  isSorted = false;
  sortedWorkout = [];
  constructor() {
    // get users's position
    this._getPosition(); // run when page load when object created
    // get data from local storage
    this._getLocalStorage();
    this.sortedWorkout = JSON.parse(JSON.stringify(this.#workouts));

    //attach event handlers

    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    workoutHeading.addEventListener('click', this._sortingWorkout.bind(this));
    errorButton.addEventListener('click', this._hideErrorMessage);
    overlayWindow.addEventListener('click', this._hideErrorMessage.bind(this));
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
  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    // console.log(`https://www.google.com/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomlevel);
    //   console.log(map);
    L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);
    // Handling  clicks on map
    this.#map.on('click', this._showForm.bind(this));

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
    // run when edit is true
    if (this.#editWorkout) {
      e.preventDefault();
      this._renderModifiedWorkout();
      return;
    }
    // run when editWorkout is false
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);
    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;

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
      )
        return this._renderErrorMessage();
      workout = new Running([lat, lng], distance, duration, cadence);
    }
    // If workout cycling , create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return this._renderErrorMessage();
      workout = new Cycling([lat, lng], distance, duration, elevation);
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
  }

  // * My methods -----------------------------------------------------------------------------
  _deleteWorkout() {
    const workoutId = document.querySelector('.workout__delete').dataset.id;

    if (workoutId) {
      const marker = this.#markers.get(workoutId);
      if (marker) marker.remove(this.#map);

      const workoutElement = document.querySelector(`[data-id="${workoutId}"]`);
      if (workoutElement) workoutElement.remove();

      const workoutIndex = this.#workouts.findIndex(
        workout => workout.id === workoutId
      );
      if (workoutIndex > -1) this.#workouts.splice(workoutIndex, 1);

      this._setLocalStorage();
      workoutList.innerHTML = '';
      this._getLocalStorage();
    }
  }
  _editWorkout(id) {
    this.#editWorkout = true;
    this.editObject = this.#workouts.find(items => items.id === id);
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
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords).addTo(this.#map);
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
    console.log(this.editObject);
    this.#workouts.splice(workoutIndex, 1, this.editObject);
    console.log(this.#workouts);
    this._hideForm();
    this._renderWorkout(this.#workouts);
    this._setLocalStorage();
    workoutList.innerHTML = '';
    this._getLocalStorage();
    this.#editWorkout = false;
  }

  //*SORTING EVENT ------------------------------------
  _sortingWorkout(e) {
    e.stopPropagation();
    const clickedButton =
      e.target.closest('button') || e.target.closest('select');
    if (!clickedButton) return;
    if (clickedButton.dataset.sorting === 'distance') {
      this.sortedWorkout = this._sorting(
        this.sortedWorkout,
        'distance',
        `${this.isSorted ? 'desc' : 'asc'}`
      );
    }
    if (clickedButton.dataset.sorting === 'duration') {
      this.sortedWorkout = this._sorting(
        this.sortedWorkout,
        'duration',
        `${this.isSorted ? 'desc' : 'asc'}`
      );
    }
    if (clickedButton.dataset.sorting === 'filter') {
      let cloneArray = JSON.parse(JSON.stringify(this.#workouts));
      if (workoutFilter.value === 'cycling') {
        this.sortedWorkout = cloneArray.filter(item => item.type === 'cycling');
        workoutSpeedSort.classList.remove('hidden__input');
        console.log(workoutSpeedSort);
      }

      if (workoutFilter.value === 'running') {
        this.sortedWorkout = cloneArray.filter(item => item.type === 'running');
        workoutSpeedSort.classList.remove('hidden__input');
      }

      if (workoutFilter.value === 'all') {
        this.sortedWorkout = this.#workouts;
        workoutSpeedSort.classList.add('hidden__input');
      }
    }
    if (clickedButton.dataset.sorting === 'speed') {
      console.log(workoutFilter.value);

      this.sortedWorkout = this._sorting(
        this.sortedWorkout,
        workoutFilter.value === 'running' ? 'pace' : 'speed',
        `${this.isSorted ? 'desc' : 'asc'}`
      );
      console.log(this.sortedWorkout);
    }
    workoutList.innerHTML = '';
    this.sortedWorkout.forEach(work => {
      this._renderWorkout(work);
    });
  }
  _sorting(array, sortBy, order) {
    array.sort((a, b) =>
      order === 'desc' ? b[sortBy] - a[sortBy] : a[sortBy] - b[sortBy]
    );
    this.isSorted = !this.isSorted;
    return array; // Return the sorted array
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <h2 class="workout__title">${workout.description}</h2>
      <div class="workout__action">
      <button class='workout__edit icon__btns' data-id=${workout.id}>
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>
      </button>
       <button class='workout__delete icon__btns' data-id=${workout.id}>
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
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
    </li>`;
    }
    workoutList.insertAdjacentHTML('afterbegin', html);
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
    // console.log(workout);

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
    // only use for small data
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }
  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;
    this.sortedWorkout = JSON.parse(JSON.stringify(this.#workouts));

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
  _renderErrorMessage() {
    overlayWindow.classList.remove('hidden');
    console.log(errorMessage);
    document.querySelector('.message').textContent =
      'The input must be a positive. Negative numbers, strings, symbols, and non-numeric characters are not allowed.';
  }
  _hideErrorMessage(e) {
    if (e.target.tagName === 'BUTTON') {
      overlayWindow.classList.add('hidden');
      return;
    }
  
    const modalWindow = e.target.closest('.model__window');
    if (modalWindow) return; 
  
    overlayWindow.classList.add('hidden');
  }
}
const app = new App();
//get current location from browser

// *coding challenges
/*
*must do
// Ability to delete all workouts
// Ability to sort workouts by a certain field(eg. distance)
Re-build Running and cycling object coming from Local Storage
// More realistic error and confirmation messages

*hard challenges 

Ability to position the map to show all workouts 
Ability to draw lines and shapes instead of just points.
Geocode location from coordinates ("Run in Faro, Portugal")
Display weather data for workout time and place
*/
