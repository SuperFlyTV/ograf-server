# OGraf Simple Rendering System

<img src="./packages/server/public/assets/ograf_logo_colour_draft.svg" width="300"/>

## What is this?

This is a web server that provides:

- An **OGraf Renderer** (a web page) to be loaded in a HTML renderer (such as CasparCG, OBS, Vmix, etc),
- An API where **OGraf Graphics** can be uploaded and managed.
- An API that can be used by a **Controller** to control the OGraf graphics.
- A simple **Controller web page** to control OGraf graphics.

## How to use

- Clone or [download this repository](https://github.com/SuperFlyTV/ograf-server/archive/refs/heads/main.zip)
- Install [Node.js](https://nodejs.org/en/download) 20 or later
- Open a console and run:

```bash
  # Prerequisite: yarn
  corepack enable

  # Install dependencies
  yarn

  # Build libraries
  yarn build

  # Run in dev mode
  yarn dev
    # Then access the main app on http://localhost:8080
      # The main app exposes the built versions of the GUI apps. you'll have to run `yarn build` for them to be updated.
      # OR you can view the vite-dev version of the GUI apps:
      # * Docs: http://localhost:8082
      # * Controller: http://localhost:8083
      # * Renderer-Layer: http://localhost:8084

  # Run in production mode
  yarn start
    # Then access the app on http://localhost:8080

```

## Disclaimer

The control API exposed by this server is NOT stable yet, it is based on early drafts of the **OGraf Server API**.
