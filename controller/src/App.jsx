import * as React from "react";
import { Button, Form, Dropdown, ButtonGroup } from "react-bootstrap";
import { getDefaultDataFromSchema } from "./GDD/gdd/data.js";
import { GDDGUI } from "./GDD/gdd-gui.jsx";

const SERVER_API_URL = "http://localhost:8080";

export function App() {
  const [serverApiUrl, setServerApiUrl] = React.useState(SERVER_API_URL);
  const [serverData, setServerData] = React.useState({});

  const reloadServerData = React.useCallback(() => {
    console.log("Loading server data...");
    retrieveServerData(serverApiUrl)
      .then((data) => {
        console.log("server data loaded", data);
        setServerData(data);
      })
      .catch((err) => {
        console.error(err);
      });
  }, [serverApiUrl]);
  React.useEffect(() => {
    reloadServerData();
  }, []);

  return (
    <div className="container-md">
      <div>
        <h1>OGraf Simple Controller</h1>
      </div>
      <Form>
        <div className="mb-3">
          <label className="form-label" htmlFor="serverApiUrl">
            Server Url
          </label>
          <input
            type="text"
            id="serverApiUrl"
            className="form-control"
            placeholder="Server URL"
            value={serverApiUrl}
            onChange={(e) => setServerApiUrl(e.target.value)}
          />
        </div>
      </Form>
      <div className="mb-3">
        <Button onClick={() => reloadServerData()}> Reload Server Data </Button>
      </div>
      <div>
        <h2>Upload Graphics</h2>
        <form
          action={`${serverApiUrl}/serverApi/internal/graphics/graphic`}
          method="post"
          encType="multipart/form-data"
        >
          Upload Graphic (zip file): <br />
          <input type="file" id="graphic" name="graphic" accept=".zip" />
          <input type="submit" label="Upload" />
        </form>
      </div>
      <div>
        <h2>Control</h2>

        <div>
          {(serverData.renderers ?? []).map((renderer) => (
            <Renderer
              key={renderer.id}
              serverApiUrl={serverApiUrl}
              renderer={renderer}
              serverData={serverData}
            />
          ))}
        </div>

        {/* <GDDExample /> */}
      </div>
    </div>
  );
}

async function retrieveServerData(serverApiUrl) {
  const data = {
    graphics: [],
    renderers: [],
    rendererManifests: {},
  };
  {
    const response = await fetch(
      `${serverApiUrl}/serverApi/internal/graphics/list`
    );
    if (response.status >= 300)
      throw new Error(
        `HTTP response error: [${response.status}] ${JSON.stringify(
          response.body
        )}`
      );
    const responseData = await response.json();
    if (!responseData.graphics)
      throw new Error(`Invalid response data: ${JSON.stringify(responseData)}`);
    data.graphics = responseData.graphics;
  }
  {
    const response = await fetch(
      `${serverApiUrl}/serverApi/internal/renderers/list`
    );
    if (response.status >= 300)
      throw new Error(
        `HTTP response error: [${response.status}] ${JSON.stringify(
          response.body
        )}`
      );
    const responseData = await response.json();
    if (!responseData.renderers)
      throw new Error(`Invalid response data: ${JSON.stringify(responseData)}`);
    data.renderers = responseData.renderers;
  }

  for (const renderer of data.renderers) {
    const response = await fetch(
      `${serverApiUrl}/serverApi/internal/renderers/renderer/${renderer.id}/manifest`
    );
    if (response.status >= 300)
      throw new Error(
        `HTTP response error: [${response.status}] ${JSON.stringify(
          response.body
        )}`
      );

    const responseData = await response.json();
    if (!responseData.rendererManifest)
      throw new Error(`Invalid response data: ${JSON.stringify(responseData)}`);
    data.rendererManifests[renderer.id] = responseData.rendererManifest;
  }

  return data;
}

function Renderer({ serverApiUrl, serverData, renderer }) {
  const rendererManifest = serverData.rendererManifests[renderer.id];
  return (
    <div className="card">
      <div className="card-body">
        <h3 className="card-title">{renderer.name}</h3>
        <i className="card-subtitle">{rendererManifest.description}</i>
        <div>
          <h4>Render Targets</h4>
          <div>
            {rendererManifest.renderTargets.map((rt) => (
              <RenderTarget
                key={rt.id}
                serverApiUrl={serverApiUrl}
                serverData={serverData}
                renderer={renderer}
                renderTarget={rt}
              />
            ))}
          </div>
        </div>
        <div>
          <GraphicPlaylist
            serverApiUrl={serverApiUrl}
            serverData={serverData}
            renderer={renderer}
          />
        </div>
      </div>
    </div>
  );
}

function RenderTarget({ serverApiUrl, serverData, renderer, renderTarget }) {
  return (
    <div className="card" style={{ width: "10em", display: "inline-block" }}>
      <div className="card-body">
        <h4 className="card-title">{renderTarget.name || renderTarget.id}</h4>
        <i className="card-subtitle">{renderTarget.description}</i>
        <div>
          <Button
            onClick={() => {
              fetch(
                `${serverApiUrl}/serverApi/internal/renderers/renderer/${renderer.id}/clear`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    filters: { renderTargetId: renderTarget.id },
                  }),
                }
              )
                .then((response) => {
                  if (response.status >= 300)
                    throw new Error(
                      `HTTP response error: [${
                        response.status
                      }] ${JSON.stringify(response.body)}`
                    );
                })
                .catch(console.error);
            }}
          >
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}

function GraphicPlaylist({ serverApiUrl, serverData, renderer }) {
  const [graphicQueue, setGraphicQueue] = React.useState([]);
  console.log("graphicQueue", graphicQueue);
  console.log("serverData.graphics");

  return (
    <div>
      <div>
        {graphicQueue.map((graphic, index) => (
          <QueuedGraphic
            key={index}
            serverApiUrl={serverApiUrl}
            serverData={serverData}
            renderer={renderer}
            graphic={graphic}
          />
        ))}
      </div>

      <Dropdown>
        <Dropdown.Toggle variant="success" id="dropdown-basic">
          Add Graphic
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {serverData.graphics.map((graphic) => {
            return (
              <Dropdown.Item
                key={`${graphic.id}-${graphic.version}`}
                onClick={() => {
                  setGraphicQueue([...graphicQueue, graphic]);
                }}
              >
                {graphic.name}
              </Dropdown.Item>
            );
          })}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}
function QueuedGraphic({ serverApiUrl, serverData, renderer, graphic }) {
  const rendererManifest = serverData.rendererManifests[renderer.id];

  const [renderTarget, setRenderTarget] = React.useState(
    rendererManifest.renderTargets[0]
  );

  const manifest = getGraphicManifest(serverApiUrl, graphic);

  const onAction = (actionName, params) => {
    fetch(
      `${serverApiUrl}/serverApi/internal/renderers/renderer/${renderer.id}/target/${renderTarget.id}/${actionName}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: {
            graphic: { id: graphic.id, version: graphic.version },
          },
          params: params,
        }),
      }
    )
      .then((response) => {
        if (response.status >= 300)
          throw new Error(
            `HTTP response error: [${response.status}] ${JSON.stringify(
              response.body
            )}`
          );
      })
      .catch(console.error);
  };

  return (
    <div>
      <h4>{graphic.name}</h4>
      <div>
        <Form>
          <div className="mb-3">
            <label className="form-label">RenderTarget</label>
            <Dropdown>
              <Dropdown.Toggle variant="success" id="dropdown-basic">
                {renderTarget.name || renderTarget.id}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                {rendererManifest.renderTargets.map((rt) => {
                  return (
                    <Dropdown.Item
                      key={rt.id}
                      onClick={() => {
                        setRenderTarget(rt);
                      }}
                    >
                      {rt.name || rt.id}
                    </Dropdown.Item>
                  );
                })}
              </Dropdown.Menu>
            </Dropdown>
          </div>
          <div className="mb-3">
            <Button
              onClick={() => {
                fetch(
                  `${serverApiUrl}/serverApi/internal/renderers/renderer/${renderer.id}/target/${renderTarget.id}/load`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      graphic: { id: graphic.id, version: graphic.version },
                    }),
                  }
                )
                  .then((response) => {
                    if (response.status >= 300)
                      throw new Error(
                        `HTTP response error: [${
                          response.status
                        }] ${JSON.stringify(response.body)}`
                      );
                  })
                  .catch(console.error);
              }}
            >
              Load
            </Button>
          </div>
          <div>
            {manifest && (
              <GraphicsDefaultActions
                schema={manifest.schema}
                onAction={onAction}
              />
            )}
          </div>
          <div>
            {manifest && (
              <div>
                {(manifest.customActions || []).map((action) => {
                  return (
                    <div
                      key={action.id}
                      className="card"
                      style={{ width: "30em", display: "inline-block" }}
                    >
                      <div className="card-body">
                        <GraphicsCustomAction
                          action={action}
                          onAction={onAction}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Form>
      </div>
    </div>
  );
}

const graphicsManifestCache = {};
function getGraphicManifest(serverApiUrl, graphic) {
  console.log("graphic", graphic);
  const [manifest, setManifest] = React.useState(
    graphicsManifestCache[graphic.id]
  );

  React.useEffect(() => {
    if (!manifest) {
      fetch(
        `${serverApiUrl}/serverApi/internal/graphics/graphic/${graphic.id}/${graphic.version}/manifest`
      )
        .then((response) => {
          if (response.status >= 300)
            throw new Error(
              `HTTP response error: [${response.status}] ${JSON.stringify(
                response.body
              )}`
            );
          return response.json();
        })
        .then((responseData) => {
          if (!responseData.graphicManifest)
            throw new Error(
              `Invalid response data: ${JSON.stringify(responseData)}`
            );

          graphicsManifestCache[graphic.id] = responseData.graphicManifest;
          setManifest(responseData.graphicManifest);
        })
        .catch(console.error);
    }
  }, []);

  // use cache?
  if (manifest) return manifest;

  return;
}

function GraphicsDefaultActions({ schema, onAction }) {
  const initialData = schema ? getDefaultDataFromSchema(schema) : {};

  const [data, setData] = React.useState(initialData);

  const onDataSave = (d) => {
    setData(JSON.parse(JSON.stringify(d)));
  };

  return (
    <div>
      <div>
        {schema && <GDDGUI schema={schema} data={data} setData={onDataSave} />}
      </div>
      <div>
        <ButtonGroup>
          <Button
            onClick={() => {
              onAction("updateAction", {
                data: data,
              });
            }}
          >
            Update
          </Button>
          <Button
            onClick={() => {
              onAction("playAction", {
                delta: undefined,
                // goto: undefined,
                // skipAnimation: undefined
              });
            }}
          >
            Play
          </Button>
          <Button
            onClick={() => {
              onAction("stopAction", {
                // skipAnimation: undefined
              });
            }}
          >
            Stop
          </Button>
        </ButtonGroup>
      </div>
    </div>
  );
}
function GraphicsCustomAction({ action, onAction }) {
  const initialData = action.schema
    ? getDefaultDataFromSchema(action.schema)
    : {};
  const schema = action.schema;

  const [data, setData] = React.useState(initialData);

  const onDataSave = (d) => {
    setData(JSON.parse(JSON.stringify(d)));
  };

  return (
    <div>
      <div>
        {schema && <GDDGUI schema={schema} data={data} setData={onDataSave} />}
      </div>
      <Button
        onClick={() => {
          // Invoke action:
          onAction("customAction", {
            id: action.id,
            payload: data,
          });
        }}
      >
        {action.name || action.id}
      </Button>
    </div>
  );
}
