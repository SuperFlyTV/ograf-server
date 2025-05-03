# OGraf Simple Rendering System

[![Badge OSC](https://img.shields.io/badge/Evaluate-24243B?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcl8yODIxXzMxNjcyKSIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI3IiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIiLz4KPGRlZnM%2BCjxsaW5lYXJHcmFkaWVudCBpZD0icGFpbnQwX2xpbmVhcl8yODIxXzMxNjcyIiB4MT0iMTIiIHkxPSIwIiB4Mj0iMTIiIHkyPSIyNCIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSIjQzE4M0ZGIi8%2BCjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzREQzlGRiIvPgo8L2xpbmVhckdyYWRpZW50Pgo8L2RlZnM%2BCjwvc3ZnPgo%3D)](https://app.osaas.io/browse/superflytv-ograf-server)

<img src="./server/public/assets/ograf_logo_colour_draft.svg" width="300"/>

## What is this?

This is a web server that provides:

- An **OGraf Renderer** (a web page) to be loaded in a HTML renderer (such as CasparCG, OBS, Vmix, etc),
- An API where **OGraf Graphics** can be uploaded and managed.
- An API that can be used by a **Controller** to control the OGraf graphics.
- A simple **Controller web page** to control OGraf graphics.

## How to use

- Clone or [download this repository](https://github.com/SuperFlyTV/ograf-server/archive/refs/heads/main.zip)
- Install [Node.js](https://nodejs.org/en/download)
- Open a console and run:

  ```bash
  # Install dependencies
  npm i

  # Build libraries
  npm run build

  # Run in dev mode
  npm run dev

  # Run in production mode
  npm run start
  ```

## Disclaimer

The control API exposed by this server is NOT intended to be stable.
The API is intended to eventually be replaced the upcoming (stable) **OGraf Server API**.
