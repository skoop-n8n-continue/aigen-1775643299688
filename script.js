document.addEventListener('DOMContentLoaded', () => {
    const cityInput = document.getElementById('city-input');
    const searchBtn = document.getElementById('search-btn');
    const locationBtn = document.getElementById('location-btn');
    const mainContent = document.getElementById('main-content');
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error-message');
    const welcomeEl = document.getElementById('welcome-message');

    // UI Elements
    const cityNameEl = document.getElementById('city-name');
    const currentDateEl = document.getElementById('current-date');
    const temperatureEl = document.getElementById('temperature');
    const descriptionEl = document.getElementById('weather-description');
    const iconEl = document.getElementById('weather-icon-large');
    const feelsLikeEl = document.getElementById('feels-like');
    const humidityEl = document.getElementById('humidity');
    const windSpeedEl = document.getElementById('wind-speed');
    const uvIndexEl = document.getElementById('uv-index');
    const forecastContainer = document.getElementById('forecast-container');

    // Initialize
    const lastCity = localStorage.getItem('last_city');
    if (lastCity) {
        fetchWeather(lastCity);
    } else {
        loadingEl.classList.add('hidden');
    }

    // Event Listeners
    searchBtn.addEventListener('click', () => {
        const city = cityInput.value.trim();
        if (city) fetchWeather(city);
    });

    locationBtn.addEventListener('click', () => {
        if (navigator.geolocation) {
            showStatus('loading');
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    fetchWeatherByCoords(position.coords.latitude, position.coords.longitude);
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    alert('Could not get your location. Please search manually.');
                    showStatus('welcome');
                }
            );
        } else {
            alert('Geolocation is not supported by your browser.');
        }
    });

    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const city = cityInput.value.trim();
            if (city) fetchWeather(city);
        }
    });

    async function fetchWeatherByCoords(lat, lon) {
        showStatus('loading');
        try {
            // Reverse Geocoding to get city name
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/get?latitude=${lat}&longitude=${lon}`, { cache: 'no-store' });
            // Note: Open-Meteo doesn't have a direct reverse geocoding API in their free geocoding service
            // but we can just use the coordinates directly for weather and fetch city name from another source if needed.
            // For simplicity, we'll use the coordinates for weather and show "Your Location"

            await fetchWeatherData(lat, lon, "Your Location", "UTC"); // Default timezone or we can try to guess
            showStatus('content');
        } catch (error) {
            console.error('Weather fetch error:', error);
            showStatus('error');
        }
    }

    async function fetchWeather(city) {
        showStatus('loading');

        try {
            // 1. Geocoding
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`, { cache: 'no-store' });
            const geoData = await geoRes.json();

            if (!geoData.results || geoData.results.length === 0) {
                throw new Error('City not found');
            }

            const { latitude, longitude, name, country, timezone } = geoData.results[0];
            const fullName = `${name}, ${country}`;

            await fetchWeatherData(latitude, longitude, fullName, timezone);
            localStorage.setItem('last_city', city);
            showStatus('content');
        } catch (error) {
            console.error('Weather fetch error:', error);
            showStatus('error');
        }
    }

    async function fetchWeatherData(latitude, longitude, fullName, timezone) {
        // 2. Weather Forecast
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max&timezone=${encodeURIComponent(timezone)}`;

        const weatherRes = await fetch(weatherUrl, { cache: 'no-store' });
        const weatherData = await weatherRes.json();

        updateUI(fullName, weatherData);
    }

    function updateUI(city, data) {
        const current = data.current;
        const daily = data.daily;

        // Header Info
        cityNameEl.textContent = city;
        currentDateEl.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Current Weather
        temperatureEl.textContent = Math.round(current.temperature_2m);
        const weatherInfo = getWeatherInfo(current.weather_code, current.is_day);
        descriptionEl.textContent = weatherInfo.description;
        iconEl.innerHTML = `<span style="font-size: 64px;">${weatherInfo.icon}</span>`;

        // Details
        feelsLikeEl.textContent = `${Math.round(current.apparent_temperature)}°C`;
        humidityEl.textContent = `${current.relative_humidity_2m}%`;
        windSpeedEl.textContent = `${current.wind_speed_10m} km/h`;
        uvIndexEl.textContent = daily.uv_index_max[0];

        // Forecast
        forecastContainer.innerHTML = '';
        for (let i = 1; i < 8; i++) {
            const date = new Date(daily.time[i]);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const info = getWeatherInfo(daily.weather_code[i], 1);

            const forecastItem = document.createElement('div');
            forecastItem.className = 'forecast-item';
            forecastItem.innerHTML = `
                <span class="day">${dayName}</span>
                <span class="icon" style="font-size: 32px; display: block; margin: 10px 0;">${info.icon}</span>
                <div class="temp-range">
                    <span class="max-temp">${Math.round(daily.temperature_2m_max[i])}°</span>
                    <span class="min-temp">${Math.round(daily.temperature_2m_min[i])}°</span>
                </div>
            `;
            forecastContainer.appendChild(forecastItem);
        }
    }

    function showStatus(status) {
        loadingEl.classList.toggle('hidden', status !== 'loading');
        errorEl.classList.toggle('hidden', status !== 'error');
        welcomeEl.classList.toggle('hidden', status !== 'welcome' && status !== 'loading' && status !== 'error' && status !== 'content');

        if (status === 'content') {
            mainContent.classList.remove('hidden');
            welcomeEl.classList.add('hidden');
        } else {
            mainContent.classList.add('hidden');
        }
    }

    /**
     * WMO Weather interpretation codes (WW)
     * https://open-meteo.com/en/docs
     */
    function getWeatherInfo(code, isDay) {
        const mapping = {
            0: { description: 'Clear sky', icon: isDay ? '☀️' : '🌙' },
            1: { description: 'Mainly clear', icon: isDay ? '🌤️' : '🌙' },
            2: { description: 'Partly cloudy', icon: isDay ? '⛅' : '☁️' },
            3: { description: 'Overcast', icon: '☁️' },
            45: { description: 'Fog', icon: '🌫️' },
            48: { description: 'Depositing rime fog', icon: '🌫️' },
            51: { description: 'Light drizzle', icon: '🌦️' },
            53: { description: 'Moderate drizzle', icon: '🌦️' },
            55: { description: 'Dense drizzle', icon: '🌦️' },
            56: { description: 'Light freezing drizzle', icon: '❄️' },
            57: { description: 'Dense freezing drizzle', icon: '❄️' },
            61: { description: 'Slight rain', icon: '🌧️' },
            63: { description: 'Moderate rain', icon: '🌧️' },
            65: { description: 'Heavy rain', icon: '🌧️' },
            66: { description: 'Light freezing rain', icon: '❄️' },
            67: { description: 'Heavy freezing rain', icon: '❄️' },
            71: { description: 'Slight snow fall', icon: '🌨️' },
            73: { description: 'Moderate snow fall', icon: '🌨️' },
            75: { description: 'Heavy snow fall', icon: '🌨️' },
            77: { description: 'Snow grains', icon: '🌨️' },
            80: { description: 'Slight rain showers', icon: '🌦️' },
            81: { description: 'Moderate rain showers', icon: '🌦️' },
            82: { description: 'Violent rain showers', icon: '🌧️' },
            85: { description: 'Slight snow showers', icon: '🌨️' },
            86: { description: 'Heavy snow showers', icon: '🌨️' },
            95: { description: 'Thunderstorm', icon: '⛈️' },
            96: { description: 'Thunderstorm with light hail', icon: '⛈️' },
            99: { description: 'Thunderstorm with heavy hail', icon: '⛈️' }
        };

        return mapping[code] || { description: 'Unknown', icon: '❓' };
    }
});
