// Ruta al archivo JSON de rutas
const dataURL = "consolidated_data.json";

// Elementos del DOM
const driverSelect = document.getElementById("driver-select");
const dateInput = document.getElementById("date-input");
const monthInput = document.getElementById("month-input");
const dateFilterRadios = document.getElementsByName("date-filter-type");
const tableBody = document.getElementById("data-table-body");
const averageTimeDisplay = document.getElementById("average-time");
const visitedClientsDisplay = document.getElementById("visited-clients");
const clockDisplay = document.getElementById("clock");
const weatherDiv = document.getElementById("weather");

// Canvas para los gráficos
const chartDistanceCanvas = document.getElementById("chartDistance");
const chartAdherenceCanvas = document.getElementById("chartAdherence");

let data = []; // Datos de rutas
let chartDistance, chartAdherence; // Variables para almacenar los gráficos

// Variable global para guardar el estado de ordenación
let sortState = {
  column: null,      // Índice de la columna actualmente ordenada (0 a 8)
  ascending: true    // true: ascendente, false: descendente
};

// Función auxiliar para formatear fecha (de "YYYY-MM-DD" a "DD-MM-AAAA")
function formatDate(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// Función para formatear segundos a "HH:MM:SS"
function formatSecondsToHHMMSS(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// Función para actualizar el fondo según la hora (día: 6-18, noche: 18-6)
function updateBackground() {
  const now = new Date();
  const hour = now.getHours();
  if (hour >= 6 && hour < 18) {
    document.body.classList.remove("night");
  } else {
    document.body.classList.add("night");
  }
}

// Función para actualizar el reloj y el fondo
function startClock() {
  function updateClock() {
    const now = new Date();
    const formattedTime = now.toLocaleTimeString("es-ES");
    const formattedDate = now.toLocaleDateString("es-ES");
    clockDisplay.textContent = `${formattedDate} - ${formattedTime}`;
    updateBackground();
  }
  updateClock();
  setInterval(updateClock, 1000);
}

// Función para poblar el selector de conductores
function populateDriverSelect() {
  const drivers = [...new Set(data.map(item => item["Driver Name"]))];
  driverSelect.innerHTML = '<option value="">Todos</option>';
  drivers.forEach(driver => {
    if (driver) {
      const option = document.createElement("option");
      option.value = driver;
      option.textContent = driver;
      driverSelect.appendChild(option);
    }
  });
}

// Función para obtener el modo de filtrado (día o mes)
function getDateFilterMode() {
  for (const radio of dateFilterRadios) {
    if (radio.checked) {
      return radio.value;
    }
  }
  return "day";
}

// Mostrar/ocultar inputs según el modo seleccionado
function updateDateInputsVisibility() {
  const mode = getDateFilterMode();
  if (mode === "day") {
    dateInput.style.display = "inline-block";
    monthInput.style.display = "none";
  } else {
    dateInput.style.display = "none";
    monthInput.style.display = "inline-block";
  }
}

// Función para actualizar la tabla, resúmenes y gráficos según los filtros
function updateTable() {
  const selectedDriver = driverSelect.value;
  const mode = getDateFilterMode();
  let selectedDate = mode === "day" ? dateInput.value : monthInput.value;
  
  // Filtrar los datos según chofer y fecha
  const filteredData = data.filter(item => {
    const matchesDriver = selectedDriver === "" || item["Driver Name"] === selectedDriver;
    let matchesDate = true;
    if (selectedDate !== "") {
      if (mode === "day") {
        matchesDate = item["Planned Route Start Date"] === selectedDate;
      } else {
        matchesDate = item["Planned Route Start Date"].startsWith(selectedDate);
      }
    }
    return matchesDriver && matchesDate;
  });
  
  // Si hay una columna seleccionada para ordenar, aplicamos la ordenación
  if (sortState.column !== null) {
    filteredData.sort((a, b) => {
      let valueA, valueB;
      switch(sortState.column) {
        case 0: // Chofer
          valueA = a["Driver Name"] || "";
          valueB = b["Driver Name"] || "";
          break;
        case 1: // Fecha
          valueA = a["Planned Route Start Date"] || "";
          valueB = b["Planned Route Start Date"] || "";
          valueA = new Date(valueA);
          valueB = new Date(valueB);
          break;
        case 2: // Hora de Salida
          valueA = a["Actual Route Departure Time"] || "";
          valueB = b["Actual Route Departure Time"] || "";
          valueA = timeStringToSeconds(valueA);
          valueB = timeStringToSeconds(valueB);
          break;
        case 3: // Hora de Llegada
          valueA = a["Actual Route Arrival Time"] || "";
          valueB = b["Actual Route Arrival Time"] || "";
          valueA = timeStringToSeconds(valueA);
          valueB = timeStringToSeconds(valueB);
          break;
        case 4: // Distancia (km) - Total Driven Meters
          valueA = a["Total Driven Meters"] || 0;
          valueB = b["Total Driven Meters"] || 0;
          break;
        case 5: // Adherencia Click - Driver Click Score
          valueA = a["Driver Click Score"] || 0;
          valueB = b["Driver Click Score"] || 0;
          break;
        case 6: // Adherencia Secuencia - Sequence Adherence
          valueA = a["Sequence Adherence"] || 0;
          valueB = b["Sequence Adherence"] || 0;
          break;
        case 7: // Duración de Visita (minutos) - Total Stop Time Seconds / 60
          valueA = a["Total Stop Time Seconds"] ? a["Total Stop Time Seconds"] / 60 : 0;
          valueB = b["Total Stop Time Seconds"] ? b["Total Stop Time Seconds"] / 60 : 0;
          break;
        case 8: // Clientes Visitados - Total Visited Customers Count
          valueA = a["Total Visited Customers Count"] || 0;
          valueB = b["Total Visited Customers Count"] || 0;
          break;
        default:
          valueA = "";
          valueB = "";
      }
      if (valueA < valueB) return sortState.ascending ? -1 : 1;
      if (valueA > valueB) return sortState.ascending ? 1 : -1;
      return 0;
    });
  }
  
  // Calcular y mostrar promedio de tiempo en ruta
  const averageTimeInSeconds = calculateAverageRouteTime(filteredData);
  averageTimeDisplay.textContent = averageTimeInSeconds ? formatSecondsToHHMMSS(averageTimeInSeconds) : "";
  
  // Calcular y mostrar clientes visitados
  const visitedClients = filteredData.reduce((sum, item) => sum + (item["Total Visited Customers Count"] || 0), 0);
  visitedClientsDisplay.textContent = visitedClients || "";
  
  // Vaciar la tabla y rellenarla con los datos filtrados y ordenados
  tableBody.innerHTML = "";
  filteredData.forEach(item => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item["Driver Name"] || ""}</td>
      <td class="table-date">${formatDate(item["Planned Route Start Date"]) || ""}</td>
      <td>${item["Actual Route Departure Time"] && item["Actual Route Departure Time"] !== "00:00:00" ? item["Actual Route Departure Time"] : ""}</td>
      <td>${item["Actual Route Arrival Time"] && item["Actual Route Arrival Time"] !== "00:00:00" ? item["Actual Route Arrival Time"] : ""}</td>
      <td>${item["Total Driven Meters"] ? (item["Total Driven Meters"] / 1000).toFixed(2) : ""}</td>
      <td>${item["Driver Click Score"] ? (item["Driver Click Score"] * 100).toFixed(2) + "%" : ""}</td>
      <td>${item["Sequence Adherence"] ? (item["Sequence Adherence"] * 100).toFixed(2) + "%" : ""}</td>
      <td>${item["Total Stop Time Seconds"] ? (item["Total Stop Time Seconds"] / 60).toFixed(2) : ""}</td>
      <td>${item["Total Visited Customers Count"] || ""}</td>
    `;
    tableBody.appendChild(row);
  });
  
  updateCharts(filteredData);
}

// Función para convertir una cadena "HH:MM:SS" a segundos
function timeStringToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  if (parts.length !== 3) return 0;
  return (+parts[0] * 3600) + (+parts[1] * 60) + (+parts[2]);
}

// Función para calcular el promedio de tiempo en ruta (en segundos) usando "Total Journey Seconds"
function calculateAverageRouteTime(filteredData) {
  const times = filteredData
    .map(item => item["Total Journey Seconds"])
    .filter(time => time != null);
  if (times.length === 0) return null;
  const totalSeconds = times.reduce((sum, time) => sum + time, 0);
  return totalSeconds / times.length;
}

// Para los gráficos, forzamos que el texto sea siempre negro.
function getChartTextColor() {
  return "#000000";
}

// Función para actualizar los gráficos usando Chart.js
function updateCharts(filteredData) {
  const chartTextColor = getChartTextColor();
  if (chartDistance) chartDistance.destroy();
  if (chartAdherence) chartAdherence.destroy();
  
  const ctxDistance = chartDistanceCanvas.getContext("2d");
  chartDistance = new Chart(ctxDistance, {
    type: "bar",
    data: {
      labels: filteredData.map(item => item["Driver Name"]),
      datasets: [{
        label: "Distancia (km)",
        data: filteredData.map(item => item["Total Driven Meters"] ? (item["Total Driven Meters"] / 1000).toFixed(2) : 0),
        backgroundColor: "blue"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: chartTextColor } },
        y: { ticks: { color: chartTextColor } }
      },
      plugins: {
        legend: { labels: { color: chartTextColor } }
      }
    }
  });
  
  const ctxAdherence = chartAdherenceCanvas.getContext("2d");
  chartAdherence = new Chart(ctxAdherence, {
    type: "bar",
    data: {
      labels: filteredData.map(item => item["Driver Name"]),
      datasets: [
        {
          label: "Adherencia Click (%)",
          data: filteredData.map(item => item["Driver Click Score"] ? (item["Driver Click Score"] * 100).toFixed(2) : 0),
          backgroundColor: "green"
        },
        {
          label: "Adherencia Secuencia (%)",
          data: filteredData.map(item => item["Sequence Adherence"] ? (item["Sequence Adherence"] * 100).toFixed(2) : 0),
          backgroundColor: "red"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: chartTextColor } },
        y: { ticks: { color: chartTextColor } }
      },
      plugins: {
        legend: { labels: { color: chartTextColor } }
      }
    }
  });
}

// ===================================================
// Funciones de Clima con Meteosource
// ===================================================

// ===================================================
// Funciones de Clima con Open-Meteo
// ===================================================

// Función para obtener el pronóstico del clima usando Open-Meteo
function fetchWeather() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(position => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
      
      fetch(url)
        .then(response => response.json())
        .then(data => displayWeather(data))
        .catch(error => {
          console.error("Error al obtener el clima:", error);
          weatherDiv.innerHTML = "<p>No se pudo obtener el clima.</p>";
        });
    }, error => {
      console.error("Error al obtener la ubicación:", error);
      weatherDiv.innerHTML = "<p>No se pudo obtener la ubicación.</p>";
    });
  } else {
    weatherDiv.innerHTML = "<p>La geolocalización no está soportada.</p>";
  }
}

// Función que mapea el weather code a un emoji representativo según Open-Meteo
function getWeatherEmoji(code) {
  if (code === 0) return "☀️"; // Soleado
  if (code >= 1 && code <= 3) return "🌤️"; // Parcialmente nublado
  if (code >= 45 && code <= 48) return "🌫️"; // Neblina
  if (code >= 51 && code <= 67) return "🌧️"; // Lluvia ligera
  if (code >= 71 && code <= 77) return "❄️"; // Nieve
  if (code >= 80 && code <= 82) return "🌦️"; // Chubascos
  if (code >= 95) return "⛈️"; // Tormenta
  return "🌈"; // Desconocido
}

// Función para mostrar el widget del clima con pronóstico de 5 días usando Open-Meteo
function displayWeather(weatherData) {
  if (!weatherData.daily) {
    weatherDiv.innerHTML = "<p>No se pudo obtener el clima.</p>";
    return;
  }
  
  const dates = weatherData.daily.time;
  const tempMax = weatherData.daily.temperature_2m_max;
  const tempMin = weatherData.daily.temperature_2m_min;
  const weatherCodes = weatherData.daily.weathercode;
  
  let html = `<div class="weather-widget"><h3>Clima 5 días</h3>`;
  for (let i = 0; i < 5; i++) {
    const emoji = getWeatherEmoji(weatherCodes[i]);
    html += `<div class="weather-day">
      <span class="weather-date">${dates[i]}</span>
      <span class="weather-emoji">${emoji}</span>
      <span class="weather-temp">Max: ${tempMax[i]}°C</span>
      <span class="weather-temp">Min: ${tempMin[i]}°C</span>
    </div>`;
  }
  html += `</div>`;
  weatherDiv.innerHTML = html;
}

// Llamar a la función para obtener el clima
fetchWeather();


// ===================================================
// Carga de Datos y Inicialización
// ===================================================

// Cargar datos de rutas desde el archivo JSON
fetch(dataURL)
  .then(response => response.json())
  .then(jsonData => {
    // Ajuste: Usar "analytics" en lugar de "route"
    data = jsonData.analytics;
    populateDriverSelect();
    updateTable();
  })
  .catch(error => console.error("Error al cargar los datos del JSON:", error));

// Inicializar funciones y listeners
updateDateInputsVisibility();
startClock();
fetchWeather();

// Event listeners para filtros
driverSelect.addEventListener("change", updateTable);
dateInput.addEventListener("input", updateTable);
monthInput.addEventListener("input", updateTable);
dateFilterRadios.forEach(radio => {
  radio.addEventListener("change", () => {
    updateDateInputsVisibility();
    updateTable();
  });
});

// Agregar event listeners a las cabeceras de la tabla para ordenar al hacer click
const thElements = document.querySelectorAll(".data-table th");
thElements.forEach((th, index) => {
  th.addEventListener("click", () => {
    // Si se hace click en la misma columna, se alterna el orden.
    if (sortState.column === index) {
      sortState.ascending = !sortState.ascending;
    } else {
      // Si se selecciona una columna distinta, se ordena ascendentemente.
      sortState.column = index;
      sortState.ascending = true;
    }
    updateTable();
  });
});
