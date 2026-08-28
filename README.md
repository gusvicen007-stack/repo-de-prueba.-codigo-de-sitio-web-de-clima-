# European Weather Forecast

An interactive web application for searching weather forecasts for cities across Europe.

## Overview

This project is a weather forecast web application built with HTML, CSS, and JavaScript.

Users can search for European cities and retrieve weather forecast information using geographic coordinates and external weather APIs.

## Features

- Search for European cities
- City autocomplete suggestions
- 7-day weather forecast
- Current temperature information
- Minimum and maximum temperatures
- Maximum wind speed
- Weather condition icons
- Dynamic city backgrounds
- Loading and error states
- Last searched city stored locally

## Technologies

- HTML5
- CSS3
- JavaScript
- REST APIs
- Fetch API
- CSV
- LocalStorage
- Git
- GitHub

## APIs

This project uses:

- **7Timer API** — Weather forecast data
- **Wikimedia API** — City images
- **Unsplash Source** — Fallback city images

## How It Works

1. The user enters the name of a city.
2. JavaScript searches the city dataset stored in a CSV file.
3. The application retrieves the city's geographic coordinates.
4. The coordinates are sent to the 7Timer API.
5. The weather data is retrieved asynchronously.
6. JavaScript dynamically renders the forecast on the page.
7. A city background image is loaded using external image sources.
8. The selected city is stored locally for future visits.

## Project Structure

```text
.
├── css/
│   └── master.css
├── images/
├── js/
│   └── main.js
├── city_coordinates.csv
└── index.html
